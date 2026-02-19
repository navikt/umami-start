import express from 'express';
import { authenticateUser } from '../../middleware/authenticateUser.js';
import { loadOasis } from '../../middleware/authUtils.js';

export function createBackendProxyRouter({ BACKEND_BASE_URL }) {
  const router = express.Router();
  const apiBaseUrl = new URL('/api/', BACKEND_BASE_URL);
  const isLocalBackend = ['localhost', '127.0.0.1', '::1'].includes(apiBaseUrl.hostname);
  const backendClientId =
    process.env.BACKEND_CLIENT_ID
    || process.env.START_UMAMI_BACKEND_CLIENT_ID
    || null;
  const naisCluster = process.env.NAIS_CLUSTER_NAME || null;
  const naisNamespace = process.env.NAIS_NAMESPACE || null;
  const backendServiceName = apiBaseUrl.hostname.split('.')[0] || null;
  const derivedNaisOboScope =
    naisCluster && naisNamespace && backendServiceName
      ? `api://${naisCluster}.${naisNamespace}.${backendServiceName}/.default`
      : null;

  const tokenUrl = process.env.BACKEND_TOKEN_URL
    || (isLocalBackend ? new URL('/issueissue/token', BACKEND_BASE_URL).toString() : null);
  const tokenClientId = process.env.BACKEND_TOKEN_CLIENT_ID || (isLocalBackend ? 'start-umami' : null);
  const tokenClientSecret = process.env.BACKEND_TOKEN_CLIENT_SECRET || (isLocalBackend ? 'unused' : null);
  const tokenAudience = process.env.BACKEND_TOKEN_AUDIENCE || (isLocalBackend ? 'start-umami' : null);
  const oboScope =
    process.env.BACKEND_OBO_SCOPE
    || derivedNaisOboScope
    || (backendClientId ? `api://${backendClientId}/.default` : null);

  console.info('[BackendProxy] init', {
    backendBaseUrl: apiBaseUrl.origin,
    isLocalBackend,
    hasBackendClientId: Boolean(backendClientId),
    hasOboScope: Boolean(oboScope),
    hasServiceTokenConfig: Boolean(tokenUrl && tokenClientId && tokenClientSecret && tokenAudience),
  });

  let cachedToken = null;
  let cachedTokenExpiresAt = 0;

  const getServiceToken = async () => {
    const now = Date.now();
    if (cachedToken && cachedTokenExpiresAt > now + 10000) {
      return cachedToken;
    }

    if (!tokenUrl || !tokenClientId || !tokenClientSecret || !tokenAudience) {
      console.warn('[BackendProxy] service token config missing');
      return null;
    }

    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: tokenClientId,
      client_secret: tokenClientSecret,
      audience: tokenAudience,
    });

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {'Content-Type': 'application/x-www-form-urlencoded'},
      body: body.toString(),
    });

    const payload = await response.json();
    if (!response.ok || !payload?.access_token) {
      console.error('[BackendProxy] service token request failed', {
        status: response.status,
        hasAccessToken: Boolean(payload?.access_token),
      });
      throw new Error(`Failed to fetch backend token (${response.status})`);
    }

    const expiresIn = Number(payload.expires_in ?? 60);
    cachedToken = String(payload.access_token);
    cachedTokenExpiresAt = Date.now() + Math.max(expiresIn - 10, 5) * 1000;
    return cachedToken;
  };

  const getOboToken = async (req) => {
    if (!oboScope) return null;

    const { oasis } = await loadOasis();
    if (
      !oasis
      || typeof oasis.requestOboToken !== 'function'
      || typeof oasis.getToken !== 'function'
      || typeof oasis.validateToken !== 'function'
    ) {
      console.warn('[BackendProxy] oasis missing for OBO');
      return null;
    }

    const userToken = oasis.getToken(req);
    if (!userToken) {
      console.warn('[BackendProxy] no user token available for OBO exchange');
      return null;
    }

    const validation = await oasis.validateToken(userToken);
    if (!validation.ok) {
      console.error('[BackendProxy] user token validation failed before OBO');
      return null;
    }

    const result = await oasis.requestOboToken(userToken, oboScope);
    if (!result.ok || !result.token) {
      console.error('[BackendProxy] OBO token exchange failed', {
        hasScope: Boolean(oboScope),
      });
      throw new Error('Failed to exchange OBO token for backend');
    }

    return result.token;
  };

  router.use('/', authenticateUser, async (req, res) => {
    try {
      const targetPath = req.url.startsWith('/') ? req.url.slice(1) : req.url;
      const targetUrl = new URL(targetPath, apiBaseUrl);
      const oboToken = await getOboToken(req);
      const serviceToken = !req.headers.authorization && !oboToken ? await getServiceToken() : null;
      const authMode = oboToken
        ? 'obo'
        : serviceToken
          ? 'service-token'
          : req.headers.authorization
            ? 'forwarded-user-token'
            : 'none';
      const resolvedAuthorization = oboToken
        ? `Bearer ${oboToken}`
        : req.headers.authorization || (serviceToken ? `Bearer ${serviceToken}` : undefined);

      if (authMode !== 'obo') {
        console.warn(`[BackendProxy] auth mode=${authMode}; consider setting BACKEND_OBO_SCOPE or BACKEND_CLIENT_ID`);
      }
      console.info('[BackendProxy] forwarding request', {
        method: req.method,
        path: targetUrl.pathname,
        authMode,
        hasAuthHeader: Boolean(resolvedAuthorization),
      });

      const forwardHeaders = {
        accept: req.headers.accept,
        authorization: resolvedAuthorization,
        'content-type': req.headers['content-type'],
      };

      const hasBody = req.method !== 'GET' && req.method !== 'HEAD';
      const response = await fetch(targetUrl, {
        method: req.method,
        headers: forwardHeaders,
        body: hasBody ? JSON.stringify(req.body) : undefined,
      });

      const data = await response.text();

      if (response.status === 401) {
        console.error('[BackendProxy] backend returned 401', {
          method: req.method,
          path: targetUrl.pathname,
          authMode,
          wwwAuthenticate: response.headers.get('www-authenticate'),
        });
      }

      res.status(response.status);
      response.headers.forEach((value, key) => {
        res.setHeader(key, value);
      });
      res.send(data);
    } catch (err) {
      console.error('Backend proxy error:', err);
      res.status(500).json({
        error: 'Backend proxy error',
        details: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  });

  return router;
}

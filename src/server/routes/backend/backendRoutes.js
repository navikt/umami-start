import express from 'express';
import { authenticateUser } from '../../middleware/authenticateUser.js';

export function createBackendProxyRouter({ BACKEND_BASE_URL }) {
  const router = express.Router();
  const apiBaseUrl = new URL('/api/', BACKEND_BASE_URL);
  const isLocalBackend = ['localhost', '127.0.0.1', '::1'].includes(apiBaseUrl.hostname);

  const tokenUrl = process.env.BACKEND_TOKEN_URL
    || (isLocalBackend ? new URL('/issueissue/token', BACKEND_BASE_URL).toString() : null);
  const tokenClientId = process.env.BACKEND_TOKEN_CLIENT_ID || (isLocalBackend ? 'start-umami' : null);
  const tokenClientSecret = process.env.BACKEND_TOKEN_CLIENT_SECRET || (isLocalBackend ? 'unused' : null);
  const tokenAudience = process.env.BACKEND_TOKEN_AUDIENCE || (isLocalBackend ? 'start-umami' : null);

  let cachedToken = null;
  let cachedTokenExpiresAt = 0;

  const getServiceToken = async () => {
    const now = Date.now();
    if (cachedToken && cachedTokenExpiresAt > now + 10000) {
      return cachedToken;
    }

    if (!tokenUrl || !tokenClientId || !tokenClientSecret || !tokenAudience) {
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
      throw new Error(`Failed to fetch backend token (${response.status})`);
    }

    const expiresIn = Number(payload.expires_in ?? 60);
    cachedToken = String(payload.access_token);
    cachedTokenExpiresAt = Date.now() + Math.max(expiresIn - 10, 5) * 1000;
    return cachedToken;
  };

  router.use('/', authenticateUser, async (req, res) => {
    try {
      const targetPath = req.url.startsWith('/') ? req.url.slice(1) : req.url;
      const targetUrl = new URL(targetPath, apiBaseUrl);
      const serviceToken = !req.headers.authorization ? await getServiceToken() : null;

      const forwardHeaders = {
        accept: req.headers.accept,
        authorization: req.headers.authorization || (serviceToken ? `Bearer ${serviceToken}` : undefined),
        'content-type': req.headers['content-type'],
      };

      const hasBody = req.method !== 'GET' && req.method !== 'HEAD';
      const response = await fetch(targetUrl, {
        method: req.method,
        headers: forwardHeaders,
        body: hasBody ? JSON.stringify(req.body) : undefined,
      });

      const data = await response.text();

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

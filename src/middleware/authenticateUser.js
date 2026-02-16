/* Extracted from original server.js */

async function authenticateUser(req, res, next) {
    try {
        // Try to import @navikt/oasis
        let oasis;
        try {
            oasis = await import('@navikt/oasis');
        } catch (importError) {
            // In local dev, oasis might not be available
            // Check for mock ident
            if (process.env.MOCK_NAV_IDENT) {
                console.log('[Auth] Using MOCK_NAV_IDENT:', process.env.MOCK_NAV_IDENT);
                req.user = {
                    navIdent: process.env.MOCK_NAV_IDENT,
                    name: 'Mock User',
                    email: 'mock.user@nav.no'
                };
                return next();
            }

            console.log('[Auth] @navikt/oasis not available and no MOCK_NAV_IDENT set');
            req.user = { navIdent: 'LOCAL_DEV' }; // Fallback for local development
            return next();
        }

        // Check for mock ident even if oasis is available (for local testing with installed deps)
        if (process.env.MOCK_NAV_IDENT) {
            console.log('[Auth] Using MOCK_NAV_IDENT (override):', process.env.MOCK_NAV_IDENT);
            req.user = {
                navIdent: process.env.MOCK_NAV_IDENT,
                name: 'Mock User',
                email: 'mock.user@nav.no'
            };
            return next();
        }

        const { getToken, validateToken, parseAzureUserToken } = oasis;

        // Extract token from request
        const token = getToken(req);

        if (!token) {
            return res.status(401).json({ error: 'Ingen autentiseringstoken' });
        }

        // Validate the token
        const validation = await validateToken(token);

        if (!validation.ok) {
            return res.status(401).json({
                error: 'Ugyldig token',
                details: validation.error?.message || 'Token-validering feilet'
            });
        }

        // Parse the Azure token to get user information
        const parsed = parseAzureUserToken(token);

        if (!parsed.ok) {
            return res.status(500).json({ error: 'Kunne ikke parse token' });
        }

        // Add user information to request object for audit logging
        // Format name as "Firstname Lastname" (Norwegian convention)
        let name = parsed.name || '';

        // Fix potential encoding issues
        if (name.includes('Ã')) {
            try {
                name = Buffer.from(name, 'latin1').toString('utf-8');
            } catch (e) { console.warn('[Auth] Failed to fix encoding:', name); }
        }

        const nameParts = name.split(', ');
        const formattedName = nameParts.length === 2
            ? `${nameParts[1]} ${nameParts[0]}`
            : name;

        req.user = {
            navIdent: parsed.NAVident,
            name: formattedName,
            email: parsed.preferred_username
        };

        console.log(`[Auth] User authenticated: ${parsed.NAVident}`);
        next();

    } catch (error) {
        console.error('[Auth] Authentication error:', error);
        return res.status(500).json({
            error: 'Autentisering feilet',
            details: error.message
        });
    }
}

export { authenticateUser };

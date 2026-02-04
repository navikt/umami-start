// Authentication middleware and NAV ident extraction
// This file contains the authentication logic using @navikt/oasis

// To install @navikt/oasis, you need a GitHub token with package read access:
// 1. Create a GitHub Personal Access Token with 'read:packages' scope
// 2. Set it as environment variable: export GITHUB_TOKEN=your_token_here
// 3. Run: yarn add @navikt/oasis

// Example implementation:

import { getToken, validateToken, parseAzureUserToken } from '@navikt/oasis';

// Middleware to validate and extract user information
export async function authenticateUser(req, res, next) {
    try {
        // Extract token from request
        const token = getToken(req);

        if (!token) {
            return res.status(401).json({ error: 'No authentication token provided' });
        }

        // Validate the token
        const validation = await validateToken(token);

        if (!validation.ok) {
            return res.status(401).json({ error: 'Invalid token', details: validation.error });
        }

        // Parse the Azure token to get user information
        const parsedToken = parseAzureUserToken(token);

        if (parsedToken.ok) {
            // Add user information to request object
            req.user = {
                navIdent: parsedToken.NAVident,
                name: parsedToken.name,
                preferredUsername: parsedToken.preferred_username,
                email: parsedToken.preferred_username // Usually email in Azure AD
            };

            console.log(`Authenticated user: ${parsedToken.preferred_username} (${parsedToken.NAVident})`);
        } else {
            return res.status(401).json({ error: 'Failed to parse token' });
        }

        next();
    } catch (error) {
        console.error('Authentication error:', error);
        return res.status(500).json({ error: 'Authentication failed', details: error.message });
    }
}

// Example: Protected endpoint that returns user info
export function getUserInfo(req, res) {
    if (!req.user) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    res.json({
        navIdent: req.user.navIdent,
        name: req.user.name,
        email: req.user.email
    });
}

// Usage in server.js:
// import { authenticateUser, getUserInfo } from './auth.js';
// 
// // Protect routes that need authentication
// app.get('/api/user/me', authenticateUser, getUserInfo);
// 
// // Or apply to all /api routes:
// app.use('/api', authenticateUser);

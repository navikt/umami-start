# Authentication Setup with @navikt/oasis

This project uses `@navikt/oasis` for Azure AD authentication and extracting NAV ident from users.

## Installation

### Prerequisites

The `@navikt/oasis` package is hosted on GitHub NPM registry. You need a GitHub Personal Access Token to install it.

### Steps:

1. **Create a GitHub Personal Access Token:**
   - Go to [GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)](https://github.com/settings/tokens)
   - Click "Generate new token (classic)"
   - Select the `read:packages` scope
   - Generate the token and copy it

2. **Set the token as environment variable:**
   ```bash
   export GITHUB_TOKEN=your_token_here
   ```

3. **Install the package:**
   ```bash
   yarn install
   ```

   Or if that doesn't work:
   ```bash
   yarn add @navikt/oasis
   ```

## Usage

### Getting User NAV Ident

The `auth.js` file contains middleware for authenticating users and extracting their NAV ident.

#### Basic Example:

```javascript
import { authenticateUser, getUserInfo } from './auth.js';

// Protected endpoint that returns user information
app.get('/api/user/me', authenticateUser, getUserInfo);
```

#### Manual Token Extraction:

```javascript
import { getToken, validateToken, parseAzureUserToken } from '@navikt/oasis';

app.get('/api/some-protected-route', async (req, res) => {
    const token = getToken(req);
    
    if (!token) {
        return res.status(401).json({ error: 'No token' });
    }
    
    const validation = await validateToken(token);
    
    if (!validation.ok) {
        return res.status(401).json({ error: 'Invalid token' });
    }
    
    const parsed = parseAzureUserToken(token);
    
    if (parsed.ok) {
        console.log(`User: ${parsed.preferred_username} (${parsed.NAVident})`);
        // Use parsed.NAVident here
    }
});
```

### Protecting All API Routes:

Apply authentication middleware to all `/api` routes:

```javascript
import { authenticateUser } from './auth.js';

// Apply to all API routes
app.use('/api', authenticateUser);

// Now all /api/* routes will have req.user populated
app.get('/api/data', (req, res) => {
    console.log('Logged in user:', req.user.navIdent);
    // Your logic here
});
```

## NAIS Configuration

Make sure your NAIS configuration has Azure enabled (already done in `.nais/nais-dev.yaml` and `.nais/nais-prod.yaml`):

```yaml
azure:
  application:
    enabled: true
    allowAllUsers: true
  sidecar:
    autoLogin: true
    enabled: true
```

## Environment Variables

In NAIS, these are automatically set:
- `AZURE_OPENID_CONFIG_ISSUER` - Azure AD issuer URL
- `AZURE_OPENID_CONFIG_JWKS_URI` - JWKS endpoint for token validation
- `AZURE_APP_CLIENT_ID` - Your app's client ID

## Token Structure

The parsed Azure token contains:

```typescript
{
  ok: true,
  NAVident: string,        // e.g., "A123456"
  name: string,            // Full name
  preferred_username: string, // Usually email
  // ... other Azure AD claims
}
```

## Troubleshooting

### Package installation fails

If installation fails with "Package not found", ensure:
1. You have a valid GitHub token with `read:packages` scope
2. The token is set as `GITHUB_TOKEN` environment variable
3. The `.npmrc` file is correctly configured

### Token validation fails

In development, the Azure AD authentication won't work locally without proper setup. For local development, you might want to:
1. Mock the authentication
2. Use a development token
3. Test in the NAIS dev environment

## References

- [@navikt/oasis Documentation](https://github.com/navikt/oasis)
- [NAIS Azure AD Guide](https://doc.nais.io/auth/entra-id/)

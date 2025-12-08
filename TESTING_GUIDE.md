# NAV Ident Authentication - Testing Guide

## 🎯 Where to Test

Once deployed to NAIS, you can test the authentication at these URLs:

### Development Environment
- **API Endpoint:** https://startumami-dev.ansatt.nav.no/api/user/me
- **UI Page:** https://startumami-dev.ansatt.nav.no/profil

### Production Environment
- **API Endpoint:** https://startumami.ansatt.nav.no/api/user/me
- **UI Page:** https://startumami.ansatt.nav.no/profil

## 📋 What You'll See

### API Response (`/api/user/me`)
```json
{
  "navIdent": "A123456",
  "name": "Ola Nordmann",
  "email": "ola.nordmann@nav.no",
  "authenticated": true,
  "message": "Successfully authenticated as A123456"
}
```

### UI Page (`/profil`)
A nice visual display showing:
- ✅ Your NAV ident (big and prominent)
- 👤 Your full name
- ✉️ Your email address
- 🎉 Success message confirming authentication

## 🚀 How It Works

1. **NAIS Azure Sidecar** intercepts the request
2. **Azure AD** authenticates you (auto-login is enabled)
3. **Token** is injected into the request headers
4. **@navikt/oasis** extracts and validates the token
5. **Server** parses the token to get your NAV ident
6. **Response** contains your user information

## 🔧 Local Development

The authentication **won't work locally** because:
- `@navikt/oasis` requires Azure AD environment variables
- Azure AD sidecar only runs in NAIS
- GitHub NPM registry authentication needed for the package

If you try to access the endpoints locally, you'll get:
```json
{
  "error": "Authentication not available in local dev",
  "message": "Deploy to NAIS to test authentication"
}
```

## 📦 Deployment

The package will be automatically installed in NAIS because:
1. NAIS has access to GitHub NPM registry
2. Azure AD environment variables are automatically set
3. The sidecar is configured in `.nais/nais-dev.yaml` and `.nais/nais-prod.yaml`

## 💡 Using NAV Ident in Other Endpoints

You can protect any endpoint with authentication:

```javascript
app.get('/api/some-protected-route', async (req, res) => {
    try {
        const oasis = await import('@navikt/oasis');
        const { getToken, validateToken, parseAzureUserToken } = oasis;
        
        const token = getToken(req);
        if (!token) {
            return res.status(401).json({ error: 'Not authenticated' });
        }
        
        const validation = await validateToken(token);
        if (!validation.ok) {
            return res.status(401).json({ error: 'Invalid token' });
        }
        
        const parsed = parseAzureUserToken(token);
        if (parsed.ok) {
            const navIdent = parsed.NAVident;
            
            // Use navIdent in your query/logic
            console.log(`User ${navIdent} accessed this endpoint`);
            
            // Your logic here...
        }
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
});
```

## ✅ Checklist

Before deploying, make sure:
- [x] `.nais/nais-dev.yaml` has Azure enabled (done)
- [x] `.nais/nais-prod.yaml` has Azure enabled (done)
- [x] `package.json` has @navikt/oasis (done)
- [x] `.npmrc` is configured for GitHub registry (done)
- [x] `/api/user/me` endpoint is implemented (done)
- [x] `/profil` UI page is created (done)

## 🎉 Ready to Test!

Just deploy to NAIS and visit:
- **https://startumami-dev.ansatt.nav.no/profil** (for a nice UI)
- **https://startumami-dev.ansatt.nav.no/api/user/me** (for JSON response)

Your NAV ident will be displayed! 🚀

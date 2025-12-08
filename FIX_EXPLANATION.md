# Fixed: @navikt/oasis Installation in NAIS

## The Problem
The package `@navikt/oasis` was not being installed in NAIS, causing the error:
```
"Cannot find package '@navikt/oasis' imported from /app/server.js"
```

## The Solution

### 1. **Moved package to regular dependencies**
Changed from `optionalDependencies` to `dependencies` in `package.json` so it's required during build.

### 2. **Updated Dockerfile**
Added support for GitHub NPM registry authentication:
- Added `ARG GITHUB_TOKEN` to receive the token during build
- Copy `.npmrc` file to configure the registry
- Set up authentication before `npm install`
- Remove `.npmrc` after installation for security

### 3. **Updated GitHub Actions Workflow**
Added `build_args` to the Docker build step to pass the GitHub token:
```yaml
build_args: |
  GITHUB_TOKEN=${{ secrets.GITHUB_TOKEN }}
```

## How It Works Now

1. **GitHub Actions** runs the build workflow
2. **GITHUB_TOKEN** (automatically available in Actions) is passed as a build argument
3. **Dockerfile** uses the token to authenticate with GitHub NPM registry
4. **npm install** successfully installs `@navikt/oasis`
5. **Token is removed** from the image for security
6. **Package is available** at runtime in NAIS

## What to Do Next

1. **Commit and Push** all the changes
2. **Wait for GitHub Actions** to build and deploy
3. **Test the endpoint**: https://startumami-dev.ansatt.nav.no/api/user/me
4. **Visit the UI**: https://startumami-dev.ansatt.nav.no/profil

## Files Changed

- ✅ `package.json` - Moved @navikt/oasis to dependencies
- ✅ `Dockerfile` - Added GitHub token support for both stages
- ✅ `.github/workflows/deploy.yaml` - Added GITHUB_TOKEN build arg
- ✅ `server.js` - Added /api/user/me endpoint
- ✅ `src/pages/UserProfile.tsx` - Added UI page for user profile
- ✅ `src/routes.tsx` - Added /profil route

## Security Notes

- The GitHub token is only used during build time
- It's removed from the final image with `RUN rm -f .npmrc`
- The token is automatically provided by GitHub Actions (no manual setup needed)
- No sensitive data is exposed in the runtime container

## Expected Result

After deployment, visiting `/api/user/me` should return:
```json
{
  "navIdent": "A123456",
  "name": "Your Name",
  "email": "your.email@nav.no",
  "authenticated": true,
  "message": "Successfully authenticated as A123456"
}
```

Instead of the previous error! 🎉

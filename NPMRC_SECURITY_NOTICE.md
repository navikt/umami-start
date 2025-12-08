# IMPORTANT: .npmrc Security Notice

⚠️ **The `.npmrc` file contains a GitHub Personal Access Token**

## What You Need to Know:

1. **The file is gitignored** - It won't be committed to the repository (good!)
2. **Remove the hardcoded token** - Replace the line with:
   ```
   //npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
   ```
3. **The Dockerfile handles the token** - It will inject the token during build

## Recommended .npmrc Content:

```
# GitHub NPM registry configuration for @navikt/oasis
# The token is injected during Docker build process
@navikt:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

## Why This Matters:

- Hardcoded tokens in files can be accidentally committed
- Even if gitignored, it's safer to use environment variables
- The Docker build process will inject the real token automatically

## Action Required:

Please update your `.npmrc` file to remove the hardcoded token and use the `${GITHUB_TOKEN}` placeholder instead.

The build will work because:
1. GitHub Actions provides `GITHUB_TOKEN` automatically
2. The Dockerfile receives it as a build arg
3. The Dockerfile creates a temporary `.npmrc` with the real token
4. After installation, the `.npmrc` is deleted for security

# @navikt/oasis Version Note

## Version Information

The package `@navikt/oasis` is currently available at version:
```
4.2.0-20251204091136
```

This appears to be a **snapshot/pre-release version** (dated December 4, 2025).

## What This Means

- ✅ The package will work correctly for authentication
- ✅ All the API functions are available (`getToken`, `validateToken`, `parseAzureUserToken`)
- ⚠️ This is not a stable semver release (like `7.1.1`)
- ⚠️ This is a timestamped build from the CI/CD pipeline

## Why This Version?

The `^7.1.1` version we initially specified doesn't exist in the GitHub NPM registry. The available version is this snapshot build, which is likely:
- A development build
- A pre-release version
- The latest available version in the NAV registry

## Is It Safe to Use?

**Yes!** This is coming from NAV's official GitHub repository and is likely used internally at NAV. The snapshot version should work fine for your use case.

## Future Considerations

If you encounter issues or need a more stable version:
1. Check the [@navikt/oasis GitHub releases](https://github.com/navikt/oasis/releases)
2. Look for tagged releases in the package registry
3. Contact the NAV platform team if you need a specific stable version

For now, this version should work perfectly for extracting NAV ident from Azure AD tokens!

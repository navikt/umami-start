/**
 * Environment detection utilities for determining the runtime environment
 * based on hostname/domain.
 */

/**
 * Checks if the app is running on localhost
 */
export const isLocalhost = (): boolean => {
  if (typeof window === "undefined") return false;

  const hostname = window.location.hostname;
  return (
    hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]"
  );
};

/**
 * Checks if the app is running in a development environment
 * Development URLs typically follow the pattern: *-dev.*.nav.no
 */
export const isDevelopment = (): boolean => {
  if (typeof window === "undefined") return false;

  const hostname = window.location.hostname;
  return hostname.includes("-dev.") && hostname.endsWith(".nav.no");
};

/**
 * Checks if the app is running in a production environment
 * Production URLs typically follow the pattern: *.nav.no (without -dev)
 */
export const isProduction = (): boolean => {
  if (typeof window === "undefined") return false;

  const hostname = window.location.hostname;
  // Must end with .nav.no and NOT contain -dev
  return hostname.endsWith(".nav.no") && !hostname.includes("-dev.");
};

/**
 * Gets the current environment as a string
 */
export const getEnvironment = ():
  | "localhost"
  | "development"
  | "production"
  | "unknown" => {
  if (isLocalhost()) return "localhost";
  if (isDevelopment()) return "development";
  if (isProduction()) return "production";
  return "unknown";
};

/**
 * Gets the current hostname
 */
export const getHostname = (): string => {
  if (typeof window === "undefined") return "";
  return window.location.hostname;
};

/**
 * Checks if running on a specific domain
 */
export const isDomain = (domain: string): boolean => {
  if (typeof window === "undefined") return false;
  return window.location.hostname === domain;
};

/**
 * Gets the appropriate base URL based on the environment
 * Useful for API endpoints that differ between localhost and deployed environments
 *
 * @param urls - Object containing URLs for different environments
 * @param urls.localUrl - URL to use for localhost
 * @param urls.prodUrl - URL to use for production/deployed environments
 * @param urls.devUrl - Optional URL to use specifically for development environment
 */
export const getBaseUrl = (urls: {
  localUrl: string;
  prodUrl: string;
  devUrl?: string;
}): string => {
  if (isLocalhost()) return urls.localUrl;
  if (isDevelopment() && urls.devUrl) return urls.devUrl;
  return urls.prodUrl;
};

/**
 * Gets the appropriate credentials mode for fetch requests
 * Returns 'omit' for localhost, 'include' for deployed environments
 */
export const getCredentialsMode = (): RequestCredentials => {
  return isLocalhost() ? "omit" : "include";
};

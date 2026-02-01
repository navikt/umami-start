import { useMemo } from 'react';
import teamsData from '../data/teamsData.json';

interface TeamData {
    teamName: string;
    teamDomain: string;
    teamSiteimproveSite: number | false;
    supportsMarketing?: boolean;
}

/**
 * Normalize a domain by removing protocol, www, and trailing slashes
 */
function normalizeDomain(domain: string): string {
    return domain
        .replace(/^https?:\/\//, '')
        .replace(/^www\./, '')
        .replace(/\/$/, '')
        .toLowerCase();
}

/**
 * Find a team by domain (exact match only)
 */
function findTeamByDomain(domain: string | null | undefined): TeamData | undefined {
    if (!domain) return undefined;

    const normalizedDomain = normalizeDomain(domain);

    return (teamsData as TeamData[]).find(t => {
        const teamDomain = normalizeDomain(t.teamDomain);
        return teamDomain === normalizedDomain;
    });
}

/**
 * Check if a domain supports Siteimprove based on teamsData.json
 * @param domain - The domain to check (e.g., "nav.no" or "https://www.nav.no")
 * @returns boolean - true if Siteimprove is supported, false otherwise
 */
export function hasSiteimproveSupport(domain: string | null | undefined): boolean {
    const team = findTeamByDomain(domain);
    return team ? team.teamSiteimproveSite !== false : false;
}

/**
 * Check if a domain is a dev environment (not production)
 * Dev environments typically have patterns like "-dev." or ".dev." in subdomain
 */
function isDevEnvironment(domain: string | null | undefined): boolean {
    if (!domain) return false;
    const normalized = normalizeDomain(domain);
    // Check for common dev environment patterns in domain
    return normalized.includes('-dev.') ||
        normalized.includes('.dev.') ||   // e.g., aksel.dev.nav.no
        normalized.includes('.dev-') ||
        normalized.includes('-dev-') ||
        normalized.startsWith('dev.') ||
        normalized.startsWith('dev-') ||
        // Also check for patterns at end of subdomain parts
        /\.dev$/i.test(normalized) ||     // ends with .dev
        /-dev$/i.test(normalized);        // ends with -dev (unlikely but just in case)
}

/**
 * Check if a website name indicates a dev environment
 */
function isDevWebsiteName(name: string | null | undefined): boolean {
    if (!name) return false;
    const normalized = name.toLowerCase();
    return normalized.includes(' - dev') ||
        normalized.includes('-dev') ||
        normalized.includes('(dev)') ||
        normalized.endsWith(' dev') ||
        normalized.startsWith('dev ') ||
        normalized.startsWith('dev-');
}

/**
 * Check if a domain supports Marketing Analysis based on teamsData.json
 * @param domain - The domain to check
 * @param websiteName - Optional website name for additional dev environment checking
 * @returns boolean - true if Marketing Analysis is supported (default: true unless explicitly set to false or is dev environment)
 */
export function hasMarketingSupport(domain: string | null | undefined, websiteName?: string | null): boolean {
    // Dev environments don't support marketing analysis
    if (isDevEnvironment(domain)) return false;

    // Also check website name for dev patterns
    if (isDevWebsiteName(websiteName)) return false;

    const team = findTeamByDomain(domain);
    // Only show if explicitly set to true in teamsData.json
    return team ? team.supportsMarketing === true : false;
}

/**
 * React hook to check Siteimprove support for a domain
 * @param domain - The domain to check
 * @returns boolean - true if Siteimprove is supported
 */
export function useSiteimproveSupport(domain: string | null | undefined): boolean {
    return useMemo(() => hasSiteimproveSupport(domain), [domain]);
}

/**
 * React hook to check Marketing Analysis support for a domain
 * @param domain - The domain to check
 * @param websiteName - Optional website name for dev environment detection
 * @returns boolean - true if Marketing Analysis is supported
 */
export function useMarketingSupport(domain: string | null | undefined, websiteName?: string | null): boolean {
    return useMemo(() => hasMarketingSupport(domain, websiteName), [domain, websiteName]);
}

export default useSiteimproveSupport;

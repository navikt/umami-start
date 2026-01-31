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
 * Check if a domain supports Marketing Analysis based on teamsData.json
 * @param domain - The domain to check
 * @returns boolean - true if Marketing Analysis is supported (default: true unless explicitly set to false)
 */
export function hasMarketingSupport(domain: string | null | undefined): boolean {
    const team = findTeamByDomain(domain);
    // Default to true if not specified, only hide if explicitly set to false
    return team ? team.supportsMarketing !== false : true;
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
 * @returns boolean - true if Marketing Analysis is supported
 */
export function useMarketingSupport(domain: string | null | undefined): boolean {
    return useMemo(() => hasMarketingSupport(domain), [domain]);
}

export default useSiteimproveSupport;

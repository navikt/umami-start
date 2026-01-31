import { useMemo } from 'react';
import teamsData from '../data/teamsData.json';

interface TeamData {
    teamName: string;
    teamDomain: string;
    teamSiteimproveSite: number | false;
}

/**
 * Check if a domain supports Siteimprove based on teamsData.json
 * @param domain - The domain to check (e.g., "nav.no" or "https://www.nav.no")
 * @returns boolean - true if Siteimprove is supported, false otherwise
 */
export function hasSiteimproveSupport(domain: string | null | undefined): boolean {
    if (!domain) return false;

    // Normalize the domain - remove protocol, www, and trailing slashes
    const normalizedDomain = domain
        .replace(/^https?:\/\//, '')
        .replace(/^www\./, '')
        .replace(/\/$/, '')
        .toLowerCase();

    const team = (teamsData as TeamData[]).find(t => {
        const teamDomain = t.teamDomain
            .replace(/^https?:\/\//, '')
            .replace(/^www\./, '')
            .replace(/\/$/, '')
            .toLowerCase();

        // Exact match only - subdomains don't inherit Siteimprove support
        return teamDomain === normalizedDomain;
    });

    return team ? team.teamSiteimproveSite !== false : false;
}

/**
 * React hook to check Siteimprove support for a domain
 * @param domain - The domain to check
 * @returns boolean - true if Siteimprove is supported
 */
export function useSiteimproveSupport(domain: string | null | undefined): boolean {
    return useMemo(() => hasSiteimproveSupport(domain), [domain]);
}

export default useSiteimproveSupport;

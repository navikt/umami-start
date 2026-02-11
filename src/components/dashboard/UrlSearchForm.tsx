import { Search, Alert, BodyShort, Link, ReadMore, List, Skeleton } from "@navikt/ds-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

interface Website {
    id: string;
    name: string;
    domain: string;
    shareId: string;
    teamId: string;
    createdAt: string;
}

interface UrlSearchFormProps {
    children?: React.ReactNode;
}

function UrlSearchForm({ children }: UrlSearchFormProps) {
    const navigate = useNavigate();
    const [filteredData, setFilteredData] = useState<Website[] | null>(null);
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [alertVisible, setAlertVisible] = useState<boolean>(false);
    const [hasLoadedData, setHasLoadedData] = useState<boolean>(false);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [searchError, setSearchError] = useState<string | null>(null);

    const normalizeDomain = (domain: string) => {
        const cleaned = domain
            .trim()
            .toLowerCase()
            .replace(/^https?:\/\//, "")
            .replace(/\.$/, "")
            .replace(/^www\./, "");
        return cleaned === "nav.no" ? "www.nav.no" : cleaned;
    };

    const navigateToTrafficAnalysis = (website: Website, path: string) => {
        navigate(
            `/trafikkanalyse?websiteId=${website.id}&domain=${website.domain}&urlPath=${encodeURIComponent(path)}`
        );
    };

    const fetchWebsites = async (): Promise<Website[]> => {
        // If we already have data, return it
        if (hasLoadedData && filteredData) {
            return filteredData;
        }

        setIsLoading(true);
        const baseUrl = ''; // Use relative path for local API

        try {
            const response = await fetch(`${baseUrl}/api/bigquery/websites`);
            const json = await response.json();
            const websitesData = json.data || [];

            // Filter for prod websites (Team ResearchOps and maybe others if needed)
            // Umami.jsx looks for:
            // aa113c34-e213-4ed6-a4f0-0aea8a503e6b (Team ResearchOps?)
            // bceb3300-a2fb-4f73-8cec-7e3673072b30 (Another team?)

            const isDevEnvironment =
                typeof window !== "undefined" &&
                window.location.hostname.includes(".dev.nav.no");

            const relevantTeams = isDevEnvironment
                ? ['1937013f-f915-4e73-a12a-fc325b23c7fc']
                : [
                    'aa113c34-e213-4ed6-a4f0-0aea8a503e6b',
                    'bceb3300-a2fb-4f73-8cec-7e3673072b30'
                ];

            const prodWebsites = websitesData.filter((website: Website) =>
                relevantTeams.includes(website.teamId)
            );

            // Filter out exactly "nav.no" if desired, though logic below handles matching
            const filteredItems = prodWebsites.filter((item: Website) => item.domain !== "nav.no");

            // Deduplicate by domain
            const uniqueWebsites = filteredItems.filter((website: Website, index: number, self: Website[]) =>
                index === self.findIndex((w) => w.domain === website.domain)
            );

            // Sort by domain
            uniqueWebsites.sort((a: Website, b: Website) => a.domain.localeCompare(b.domain));

            setFilteredData(uniqueWebsites);
            setHasLoadedData(true);
            setIsLoading(false);
            return uniqueWebsites;
        } catch (error) {
            console.error("Error fetching data:", error);
            setIsLoading(false);
            throw error;
        }
    };

    const loadWebsitesData = () => {
        fetchWebsites().catch(() => { });
    };

    const handleReadMoreToggle = (open: boolean) => {
        if (open && !hasLoadedData) {
            loadWebsitesData();
        }
    };

    const handleSearchChange = (value: string) => {
        setSearchQuery(value);
        setAlertVisible(false);
        setSearchError(null);
    };

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!searchQuery) {
            setSearchError("Du må sette inn en URL-adresse.");
            return;
        }
        setSearchError(null);
        setAlertVisible(false);

        let inputUrl = searchQuery;
        if (!inputUrl.startsWith('http://') && !inputUrl.startsWith('https://')) {
            inputUrl = 'https://' + inputUrl;
        }

        try {
            let urlObj = new URL(inputUrl);

            // Normalize nav.no to www.nav.no for matching consistency,
            // copying logic from Umami.jsx
            if (urlObj.hostname === "nav.no") {
                inputUrl = inputUrl.replace("://nav.no", "://www.nav.no");
                urlObj = new URL(inputUrl);
            }

            const websites = await fetchWebsites();

            const inputDomain = urlObj.hostname;
            const normalizedInputDomain = normalizeDomain(inputDomain);

            // Find best match: prefer exact match, then longest suffix match (most specific subdomain)
            const matchedWebsite = websites.reduce<Website | null>((best, item) => {
                const normalizedDomain = normalizeDomain(item.domain);

                // Exact match wins immediately
                if (normalizedDomain === normalizedInputDomain) {
                    return item;
                }

                // Suffix match: input is a subdomain of this website's domain
                if (normalizedInputDomain.endsWith(`.${normalizedDomain}`)) {
                    // Keep the longer (more specific) domain
                    if (!best) return item;
                    const bestLen = normalizeDomain(best.domain).length;
                    return normalizedDomain.length > bestLen ? item : best;
                }

                return best;
            }, null);

            if (matchedWebsite) {
                navigateToTrafficAnalysis(
                    matchedWebsite,
                    decodeURIComponent(urlObj.pathname)
                );
            } else {
                setAlertVisible(true);
            }

        } catch (error) {
            setSearchError("Ugyldig URL-format eller feil ved oppslag.");
            console.error("Error:", error);
        }
    };

    return (
        <div>
            <form role="search" onSubmit={handleSubmit}>
                <div style={{ maxWidth: "600px" }}>
                    <Search
                        label="Lim inn URL for å se webstatistikk"
                        hideLabel={false}
                        variant="primary"
                        value={searchQuery}
                        error={searchError}
                        onChange={handleSearchChange}
                        onClear={() => setSearchQuery("")}
                    />
                    {alertVisible && <Alert style={{ marginTop: "20px" }} variant="warning">Denne siden har ikke fått støtte for Umami enda. Fortvil ikke — kontakt Team ResearchOps for å få lagt den til :)</Alert>}
                </div>
                {children}
                <ReadMore size="small" style={{ marginTop: "24px" }} header="Hvilke nettsider / apper støttes?" onOpenChange={handleReadMoreToggle}>
                    {isLoading ? (
                        <List as="ul">
                            {[...Array(3)].map((_, index) => (
                                <List.Item key={`skeleton-${index}`}>
                                    <Skeleton variant="text" width="60%" />
                                </List.Item>
                            ))}
                        </List>
                    ) : (
                        <List as="ul">
                            {filteredData && filteredData.map(item => (
                                <List.Item key={item.id}>
                                    <Link
                                        href={`/trafikkanalyse?websiteId=${item.id}&domain=${item.domain}&urlPath=%2F`}
                                        onClick={(event) => {
                                            event.preventDefault();
                                            navigateToTrafficAnalysis(item, "/");
                                        }}
                                    >
                                        {item.domain}
                                    </Link>
                                </List.Item>
                            ))}
                        </List>
                    )}
                    <BodyShort className="mt-4 mb-2">
                        Savner du en nettside eller app? <Link href="/komigang">Følg kom-i-gang-guiden!</Link>
                    </BodyShort>
                </ReadMore>
            </form>
        </div>
    );
}

export default UrlSearchForm;

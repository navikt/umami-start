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
        if (domain === "www.nav.no") return domain;
        return domain.replace(/^www\./, "");
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

            const relevantTeams = [
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

            const matchedWebsite = websites.find(
                (item) =>
                    normalizeDomain(item.domain) === normalizedInputDomain ||
                    normalizedInputDomain.endsWith(`.${normalizeDomain(item.domain)}`)
            );

            if (matchedWebsite) {
                // Navigate to dashboard
                // Pass domain/path info if useful
                navigate(`/dashboard?websiteId=${matchedWebsite.id}&domain=${matchedWebsite.domain}&name=${encodeURIComponent(matchedWebsite.name)}&path=${encodeURIComponent(urlObj.pathname)}`);
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
                                    {item.domain}
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
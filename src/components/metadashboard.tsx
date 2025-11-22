import { Search, Alert, BodyShort, Link, ReadMore, List, Skeleton } from "@navikt/ds-react";
import { useState } from "react";

interface Website {
    id: string;
    name: string;
    domain: string;
    shareId: string;
    teamId: string;
    createdAt: string;
}

function Metadashboard() {
    const [filteredData, setFilteredData] = useState<Website[] | null>(null);
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [alertVisible, setAlertVisible] = useState<boolean>(false);
    const [hasLoadedData, setHasLoadedData] = useState<boolean>(false);
    const [isLoading, setIsLoading] = useState<boolean>(false);

    const loadWebsitesData = () => {
        if (hasLoadedData) return; // Avoid redundant fetches

        setIsLoading(true);
        const baseUrl = ''; // Use relative path for local API

        fetch(`${baseUrl}/api/bigquery/websites`)
            .then(response => response.json())
            .then((response) => {
                const websitesData = response.data || [];

                // Filter for prod websites only
                const prodWebsites = websitesData.filter((website: Website) =>
                    website.teamId === 'aa113c34-e213-4ed6-a4f0-0aea8a503e6b'
                );

                // Filter out exactly "nav.no"
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
            })
            .catch(error => {
                console.error("Error fetching data:", error);
                setIsLoading(false);
            });
    };

    const handleReadMoreToggle = (open: boolean) => {
        if (open && !hasLoadedData) {
            loadWebsitesData();
        }
    };

    const handleSearchChange = (value: string) => {
        setSearchQuery(value);
        setAlertVisible(false);
    };

    const [searchError, setSearchError] = useState<string | null>(null);

    const handleSubmit = (event: React.FormEvent) => {
        event.preventDefault();
        if (!searchQuery) {
            setSearchError("Du må sette inn en URL-adresse.");
            return;
        }
        setSearchError(null);

        let inputUrl = searchQuery;
        if (!inputUrl.startsWith('http://') && !inputUrl.startsWith('https://')) {
            inputUrl = 'https://' + inputUrl;
        }

        try {
            const url = new URL(inputUrl);
            const normalizedUrl = url.href;
            // Always redirect to felgen with encoded URL as q param in same tab
            const felgenUrl = `https://felgen.ansatt.nav.no/?q=${encodeURIComponent(normalizedUrl)}`;
            window.location.assign(felgenUrl);
        } catch (error) {
            setSearchError("Ugyldig URL-format");
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
                <ReadMore style={{ marginTop: "10px" }} header="Hvilke nettsider / apper støttes?" onOpenChange={handleReadMoreToggle}>
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
                    <BodyShort>
                        Savner du en nettside eller app? <Link href="/komigang">Følg kom-i-gang-guiden!</Link>
                    </BodyShort>
                </ReadMore>
            </form>
        </div>
    );
}

export default Metadashboard;
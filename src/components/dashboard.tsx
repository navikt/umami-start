import {Search, Alert, BodyShort, Link, ReadMore, List} from "@navikt/ds-react";
import { useState, useEffect } from "react";

interface Website {
    id: string;
    name: string;
    domain: string;
    shareId: string;
    teamId: string;
    createdAt: string;
}

function Dashboard() {
    const baseUrl = window.location.hostname === 'localhost' ? 'https://reops-proxy.intern.nav.no' : 'https://reops-proxy.ansatt.nav.no';
    const [filteredData, setFilteredData] = useState<Website[] | null>(null);
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [alertVisible, setAlertVisible] = useState<boolean>(false);

    useEffect(() => {
        Promise.all([
            fetch(`${baseUrl}/umami/api/teams/aa113c34-e213-4ed6-a4f0-0aea8a503e6b/websites`, {
                credentials: window.location.hostname === 'localhost' ? 'omit' : 'include'
            }).then(response => response.json()),
            fetch(`${baseUrl}/umami/api/teams/bceb3300-a2fb-4f73-8cec-7e3673072b30/websites`, {
                credentials: window.location.hostname === 'localhost' ? 'omit' : 'include'
            }).then(response => response.json())
        ])
            .then(([data1, data2]) => {
                const combinedData = [...data1.data, ...data2.data];
                combinedData.sort((a, b) => a.domain.localeCompare(b.domain));

                setFilteredData(combinedData.filter(item => item.teamId === 'aa113c34-e213-4ed6-a4f0-0aea8a503e6b'));
            })
            .catch(error => console.error("Error fetching data:", error));
    }, []);

    const handleSearchChange = (value: string) => {
        setSearchQuery(value);
        setAlertVisible(false);
    };

    const [searchError, setSearchError] = useState<string | null>(null);

    const handleSubmit = async (event: React.FormEvent) => {
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
        const url = new URL(inputUrl);
        const domain = url.hostname;
        const path = encodeURIComponent(url.pathname);

        try {
            const [data1, data2] = await Promise.all([
                fetch(`${baseUrl}/umami/api/teams/aa113c34-e213-4ed6-a4f0-0aea8a503e6b/websites`, {
                    credentials: window.location.hostname === 'localhost' ? 'omit' : 'include'
                }).then(response => response.json()),
                fetch(`${baseUrl}/umami/api/teams/bceb3300-a2fb-4f73-8cec-7e3673072b30/websites`, {
                    credentials: window.location.hostname === 'localhost' ? 'omit' : 'include'
                }).then(response => response.json())
            ]);

            const combinedData = [...data1.data, ...data2.data];
            combinedData.sort((a, b) => a.domain.localeCompare(b.domain));

            const filteredData = combinedData.filter(item => item.teamId === 'aa113c34-e213-4ed6-a4f0-0aea8a503e6b');
            const matchedWebsite = filteredData.find(item => item.domain === domain);

            if (matchedWebsite) {
                const umamiUrl = `https://umami.ansatt.nav.no/share/${matchedWebsite.shareId}/${domain}?url=${path}`;
                window.location.href = umamiUrl;
            } else {
                setAlertVisible(true);
            }
        } catch (error) {
            console.error("Error fetching data:", error);
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
                <ReadMore style={{ marginTop: "10px" }} header="Hvilke nettsider / apper støttes?">
                    <List as="ul">
                        {filteredData && filteredData.map(item => (
                            <List.Item key={item.id}>
                                {item.domain}
                            </List.Item>
                        ))}
                    </List>
                    <BodyShort>
                        Savner du en nettside eller app? <Link href="/komigang">Følg kom-i-gang-guiden!</Link>
                    </BodyShort>
                </ReadMore>
            </form>
        </div>
    );
}

export default Dashboard;
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

    const normalizeDomain = (domain: string) => {
        return domain.replace(/^www\./, '');
    };

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
                const team1Data = data1.data.filter(item => 
                    item.teamId === 'aa113c34-e213-4ed6-a4f0-0aea8a503e6b'
                );
                const team2Data = data2.data.filter(item => 
                    item.teamId === 'bceb3300-a2fb-4f73-8cec-7e3673072b30' && 
                    item.id === 'c44a6db3-c974-4316-b433-214f87e80b4d'
                );
                
                const combinedData = [...team1Data, ...team2Data];
                combinedData.sort((a, b) => a.domain.localeCompare(b.domain));
                setFilteredData(combinedData);
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

        try {
            const url = new URL(inputUrl);
            const domain = url.hostname;
            const path = url.pathname;

            const [data1, data2] = await Promise.all([
                fetch(`${baseUrl}/umami/api/teams/aa113c34-e213-4ed6-a4f0-0aea8a503e6b/websites`, {
                    credentials: window.location.hostname === 'localhost' ? 'omit' : 'include'
                }).then(response => response.json()),
                fetch(`${baseUrl}/umami/api/teams/bceb3300-a2fb-4f73-8cec-7e3673072b30/websites`, {
                    credentials: window.location.hostname === 'localhost' ? 'omit' : 'include'
                }).then(response => response.json())
            ]);

            // Type guard to ensure data has the correct structure
            if (!data1?.data || !data2?.data || !Array.isArray(data1.data) || !Array.isArray(data2.data)) {
                throw new Error('Invalid data structure received from API');
            }

            const team1Data = data1.data.filter((item: Website) => 
                item.teamId === 'aa113c34-e213-4ed6-a4f0-0aea8a503e6b'
            );
            const team2Data = data2.data.filter((item: Website) => 
                item.teamId === 'bceb3300-a2fb-4f73-8cec-7e3673072b30' && 
                item.id === 'c44a6db3-c974-4316-b433-214f87e80b4d'
            );
            
            const combinedData = [...team1Data, ...team2Data];
            combinedData.sort((a, b) => a.domain.localeCompare(b.domain));

            const normalizedInputDomain = normalizeDomain(domain);
            const matchedWebsite = combinedData.find(item => 
                normalizeDomain(item.domain) === normalizedInputDomain ||
                normalizedInputDomain.endsWith(`.${normalizeDomain(item.domain)}`)
            );

            if (matchedWebsite) {
                const umamiUrl = `https://umami.ansatt.nav.no/share/${matchedWebsite.shareId}/${matchedWebsite.domain}?url=${encodeURIComponent(path)}`;
                window.location.href = umamiUrl;
            } else {
                setAlertVisible(true);
            }
        } catch (error) {
            if (error instanceof Error) {
                setSearchError("Ugyldig URL-format");
            }
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
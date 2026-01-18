import { useEffect, useState, useRef } from "react";
import { Table, Button, Tag, Search, Switch } from "@navikt/ds-react";
import SporingsModal from "./SporingsModal";

// Add styles at the top of the file
const styles = {
    container: {
        display: 'flex',
        flexWrap: 'wrap',
        gap: '20px',
        marginBottom: "20px",
        marginTop: "25px"
    },
    searchForm: {
        width: '250px',
        '@media (max-width: 768px)': {
            width: '100%',
            flexBasis: '100%'
        }
    }
} as const;

interface Website {
    id: string;
    name: string;
    domain: string;
    shareId: string;
    teamId: string;
    createdAt: string;
}

function TeamWebsites() {
    const [data, setData] = useState<Website[] | null>(null);
    const [filteredData, setFilteredData] = useState<Website[] | null>(null);
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [selectedItem, setSelectedItem] = useState<{ name: string; id: string }>({ name: '', id: '' });
    const [showDevApps, setShowDevApps] = useState<boolean>(false);
    const ref = useRef<HTMLDialogElement>(null);


    useEffect(() => {
        const baseUrl = ''; // Use relative path for local API

        fetch(`${baseUrl}/api/bigquery/websites`)
            .then(response => response.json())
            .then((response) => {
                const websitesData = response.data || [];

                // Deduplicate by name to avoid key collisions
                const uniqueWebsites = websitesData.filter((website: Website, index: number, self: Website[]) =>
                    index === self.findIndex((w) => w.name === website.name)
                );

                // Sort by teamId (Dev first, then Prod) and then by name
                uniqueWebsites.sort((a: Website, b: Website) => {
                    const teamIdA = a.teamId || '';
                    const teamIdB = b.teamId || '';

                    if (teamIdA === teamIdB) {
                        return a.name.localeCompare(b.name);
                    }
                    return teamIdB.localeCompare(teamIdA);
                });

                setData(uniqueWebsites);
                setFilteredData(uniqueWebsites);
            })
            .catch(error => console.error("Error fetching data:", error));
    }, []);

    useEffect(() => {
        if (data) {
            const filtered = data.filter((website) => {
                // Check if search query exactly matches ID - show regardless of environment
                if (searchQuery !== "") {
                    const searchLower = searchQuery.toLowerCase();
                    if (website.id.toLowerCase() === searchLower) {
                        return true;
                    }
                }

                // Regular environment filtering
                const teamId = website.teamId || '';
                const envMatch = showDevApps
                    ? teamId === 'bceb3300-a2fb-4f73-8cec-7e3673072b30'
                    : teamId === 'aa113c34-e213-4ed6-a4f0-0aea8a503e6b';

                // Then apply other search criteria if there's a search query
                if (searchQuery === "") {
                    return envMatch;
                } else {
                    const searchLower = searchQuery.toLowerCase();
                    const nameMatches = website.name.toLowerCase().includes(searchLower);
                    const domainMatches = website.domain && website.domain.toLowerCase().includes(searchLower);
                    return envMatch && (nameMatches || domainMatches);
                }
            });
            setFilteredData(filtered);
        }
    }, [searchQuery, data, showDevApps]);

    const handleButtonClick = (name: string, id: string) => {
        setSelectedItem({ name, id });
        ref.current?.showModal();
    };

    const handleSearchChange = (value: string) => {
        setSearchQuery(value);
    };

    return (
        <>
            <div className="search-controls" style={styles.container}>
                <form role="search" style={{ width: '250px' }}>
                    <Search
                        label="Søk alle NAV sine sider"
                        variant="simple"
                        value={searchQuery}
                        onChange={handleSearchChange}
                        onClear={() => setSearchQuery("")}
                        size="small"
                    />
                </form>
                <Switch
                    size="small"
                    position="right"
                    checked={showDevApps}
                    onChange={(e) => setShowDevApps(e.target.checked)}
                >
                    Vis dev-sider
                </Switch>
            </div>
            <div style={{ overflowX: 'auto' }} >
                {/* Display the count of websites shown */}
                <div className="my-2 text-md text-[var(--ax-text-default)]">
                    {filteredData?.length || 0} nettsider/apper
                </div>
                <Table zebraStripes={true}>
                    <Table.Header>
                        <Table.Row>
                            <Table.HeaderCell scope="col">Umami-prosjekt</Table.HeaderCell>
                            <Table.HeaderCell scope="col">Miljø</Table.HeaderCell>
                            <Table.HeaderCell scope="col">Hoveddomene</Table.HeaderCell>
                            <Table.HeaderCell scope="col">Opprettet</Table.HeaderCell>
                            <Table.HeaderCell scope="col">Sporingskode</Table.HeaderCell>
                        </Table.Row>
                    </Table.Header>
                    <Table.Body>
                        {filteredData && filteredData.map(({ id, name, domain, createdAt, teamId }) => (
                            <Table.Row key={id}>
                                <Table.HeaderCell scope="row">
                                    {name}
                                </Table.HeaderCell>
                                <Table.DataCell>
                                    <Tag variant={teamId === 'aa113c34-e213-4ed6-a4f0-0aea8a503e6b' ? 'success' : 'alt1'}>
                                        {teamId === 'aa113c34-e213-4ed6-a4f0-0aea8a503e6b' ? 'prod' : 'dev'}
                                    </Tag>
                                </Table.DataCell>
                                <Table.DataCell>{domain}</Table.DataCell>
                                <Table.DataCell>
                                    {(() => {
                                        if (!createdAt) return 'Ukjent dato';

                                        let dateStr;

                                        // Handle BigQuery timestamp format { value: string }
                                        if (typeof createdAt === 'object' && createdAt !== null && 'value' in createdAt) {
                                            dateStr = (createdAt as any).value;
                                        } else {
                                            dateStr = createdAt;
                                        }

                                        const date = new Date(dateStr);

                                        if (isNaN(date.getTime())) {
                                            return 'Ugyldig dato';
                                        }

                                        return date.toLocaleDateString('nb-NO', {
                                            day: '2-digit',
                                            month: '2-digit',
                                            year: 'numeric'
                                        });
                                    })()}
                                </Table.DataCell>
                                <Table.DataCell>
                                    <Button
                                        variant="primary"
                                        size="small"
                                        onClick={() => handleButtonClick(name, id)}
                                    >
                                        Sporingskode
                                    </Button>
                                </Table.DataCell>
                            </Table.Row>
                        ))}
                    </Table.Body>
                </Table>
            </div>
            <SporingsModal ref={ref} selectedItem={selectedItem} />
        </>
    );
}

export default TeamWebsites;


import { useEffect, useState, useRef } from "react";
import { Table, Link, Button, Tag, Search, Switch } from "@navikt/ds-react";
import SporingsModal from "./sporingsmodal";

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
    const baseUrl = window.location.hostname === 'localhost' ? 'https://reops-proxy.intern.nav.no' : 'https://reops-proxy.ansatt.nav.no';

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
                combinedData.sort((a, b) => {
                    if (a.teamId === b.teamId) {
                        return a.name.localeCompare(b.name);
                    }
                    return b.teamId.localeCompare(a.teamId);
                });
                setData(combinedData);
                setFilteredData(combinedData);
            })
            .catch(error => console.error("Error fetching data:", error));
    }, []);

    useEffect(() => {
        if (data) {
            const filtered = data.filter((website) => {
                // First filter by environment (prod/dev)
                const envMatch = showDevApps 
                    ? website.teamId === 'bceb3300-a2fb-4f73-8cec-7e3673072b30'
                    : website.teamId === 'aa113c34-e213-4ed6-a4f0-0aea8a503e6b';

                // Then filter by search query if it exists
                if (searchQuery === "") {
                    return envMatch;
                } else {
                    const searchLower = searchQuery.toLowerCase();
                    const nameMatches = website.name.toLowerCase().includes(searchLower);
                    const domainMatches = website.domain.toLowerCase().includes(searchLower);
                    const idMatches = website.id.toLowerCase().includes(searchLower);
                    return envMatch && (nameMatches || domainMatches || idMatches);
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
            <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-end', marginBottom: "20px", marginTop: "25px" }}>
                <form role="search" style={{ width: "250px" }}>
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
                    Vis apper i dev
                </Switch>
            </div>
            <div style={{ overflowX: 'auto' }} >
            <Table zebraStripes={true}>
                <Table.Header>
                    <Table.Row>
                        <Table.HeaderCell scope="col">Nettside / app</Table.HeaderCell>
                        <Table.HeaderCell scope="col">Miljø</Table.HeaderCell>
                        <Table.HeaderCell scope="col">Domene</Table.HeaderCell>
                        <Table.HeaderCell scope="col">Opprettet</Table.HeaderCell>
                        <Table.HeaderCell scope="col">Sporingskode</Table.HeaderCell>
                    </Table.Row>
                </Table.Header>
                <Table.Body>
                    {filteredData && filteredData.map(({id, name, domain, shareId, createdAt, teamId}) => (
                        <Table.Row key={id}>
                            <Table.HeaderCell scope="row">
                                <Link target="_blank" href={`https://umami.ansatt.nav.no/share/${shareId}/${domain}`}>
                                    {name}
                                </Link>
                            </Table.HeaderCell>
                            <Table.DataCell>
                                <Tag variant={teamId === 'aa113c34-e213-4ed6-a4f0-0aea8a503e6b' ? 'success' : 'alt1'}>
                                    {teamId === 'aa113c34-e213-4ed6-a4f0-0aea8a503e6b' ? 'prod' : 'dev'}
                                </Tag>
                            </Table.DataCell>
                            <Table.DataCell>{domain}</Table.DataCell>
                            <Table.DataCell>
                                {new Date(createdAt).toLocaleDateString('nb-NO', {
                                    day: '2-digit',
                                    month: '2-digit',
                                    year: 'numeric'
                                })}
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
            <SporingsModal ref={ref} selectedItem={selectedItem}/>
        </>
    );
}

export default TeamWebsites;


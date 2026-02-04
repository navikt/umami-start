import React, { useEffect, useState, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { Table, Button, Tag, Search, Select } from "@navikt/ds-react";
import SporingsModal from "./SporingsModal";

const styles = {
    container: {
        display: 'flex',
        flexWrap: 'wrap',
        gap: '20px',
        marginBottom: "20px",
        marginTop: "25px",
        alignItems: 'flex-end'
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

interface GroupedWebsite {
    baseName: string;
    prod?: Website;
    dev?: Website;
    domain: string;
    createdAt: string;
}

type FilterType = 'all' | 'prod-only' | 'dev-only' | 'both';

const PROD_TEAM_ID = 'aa113c34-e213-4ed6-a4f0-0aea8a503e6b';

function getBaseName(name: string): string {
    // Remove " - dev" or " - prod" suffix (handling different dash types: hyphen, en-dash, em-dash)
    // Also handle variations in whitespace
    return name
        .replace(/\s*[-–—]\s*(dev|prod)\s*$/i, '')
        .trim();
}

function isProd(website: Website): boolean {
    return website.teamId === PROD_TEAM_ID;
}

function TeamWebsites() {
    const [searchParams, setSearchParams] = useSearchParams();
    const [data, setData] = useState<Website[] | null>(null);
    const [groupedData, setGroupedData] = useState<GroupedWebsite[]>([]);
    const [filteredData, setFilteredData] = useState<GroupedWebsite[]>([]);
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [selectedItem, setSelectedItem] = useState<{ name: string; id: string; domain?: string; createdAt?: string }>({ name: '', id: '' });
    const [filter, setFilter] = useState<FilterType>('all');
    const [pendingSporingskode, setPendingSporingskode] = useState<string | null>(null);
    const ref = useRef<HTMLDialogElement>(null);

    // Check for sporingskode URL param on mount
    useEffect(() => {
        const sporingskodeId = searchParams.get('sporingskode');
        if (sporingskodeId) {
            setPendingSporingskode(sporingskodeId);
        }
    }, []);

    // Open modal when we have both data and a pending sporingskode
    useEffect(() => {
        if (data && pendingSporingskode) {
            const website = data.find(w => w.id === pendingSporingskode);
            if (website) {
                setSelectedItem({ name: website.name, id: website.id });
                ref.current?.showModal();
            }
            setPendingSporingskode(null);
        }
    }, [data, pendingSporingskode]);

    // Fetch data
    useEffect(() => {
        fetch('/api/bigquery/websites')
            .then(response => response.json())
            .then((response) => {
                const websitesData: Website[] = response.data || [];
                setData(websitesData);
            })
            .catch(error => console.error("Error fetching data:", error));
    }, []);

    // Group websites by base name
    useEffect(() => {
        if (!data) return;

        const groups = new Map<string, GroupedWebsite>();

        data.forEach(website => {
            const baseName = getBaseName(website.name);

            if (!groups.has(baseName)) {
                groups.set(baseName, {
                    baseName,
                    domain: website.domain,
                    createdAt: website.createdAt
                });
            }

            const group = groups.get(baseName)!;

            if (isProd(website)) {
                group.prod = website;
                // Prefer prod domain and date
                group.domain = website.domain;
                group.createdAt = website.createdAt;
            } else {
                group.dev = website;
                // Only use dev domain/date if no prod
                if (!group.prod) {
                    group.domain = website.domain;
                    group.createdAt = website.createdAt;
                }
            }
        });

        // Sort by base name, but feature Nav.no first
        const sorted = Array.from(groups.values()).sort((a, b) => {
            const aIsFeatured = a.baseName.trim().toLowerCase() === 'nav.no';
            const bIsFeatured = b.baseName.trim().toLowerCase() === 'nav.no';

            if (aIsFeatured && !bIsFeatured) return -1;
            if (!aIsFeatured && bIsFeatured) return 1;

            return a.baseName.localeCompare(b.baseName, 'nb');
        });

        setGroupedData(sorted);
    }, [data]);

    // Filter grouped data
    useEffect(() => {
        let filtered = groupedData;

        // Apply environment filter
        switch (filter) {
            case 'prod-only':
                filtered = filtered.filter(g => g.prod && !g.dev);
                break;
            case 'dev-only':
                filtered = filtered.filter(g => g.dev && !g.prod);
                break;
            case 'both':
                filtered = filtered.filter(g => g.prod && g.dev);
                break;
            // 'all' shows everything
        }

        // Apply search filter
        if (searchQuery) {
            const searchLower = searchQuery.toLowerCase();
            filtered = filtered.filter(g => {
                // Check if search matches ID exactly
                if (g.prod?.id.toLowerCase() === searchLower || g.dev?.id.toLowerCase() === searchLower) {
                    return true;
                }
                // Check name and domain
                const nameMatches = g.baseName.toLowerCase().includes(searchLower);
                const domainMatches = g.domain?.toLowerCase().includes(searchLower);
                return nameMatches || domainMatches;
            });
        }

        setFilteredData(filtered);
    }, [groupedData, searchQuery, filter]);

    const handleButtonClick = (name: string, id: string, domain?: string, createdAt?: string) => {
        setSelectedItem({ name, id, domain, createdAt });
        setSearchParams({ sporingskode: id });
        ref.current?.showModal();
    };

    const formatDate = (createdAt: string | { value: string } | null): string => {
        if (!createdAt) return 'Ukjent dato';

        let dateStr: string;
        if (typeof createdAt === 'object' && createdAt !== null && 'value' in createdAt) {
            dateStr = createdAt.value;
        } else {
            dateStr = createdAt;
        }

        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return 'Ugyldig dato';

        return date.toLocaleDateString('nb-NO', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    };

    return (
        <>
            <div className="search-controls" style={styles.container}>
                <form role="search" style={{ width: '250px' }}>
                    <Search
                        label="Søk alle NAV sine sider"
                        variant="simple"
                        value={searchQuery}
                        onChange={setSearchQuery}
                        onClear={() => setSearchQuery("")}
                        size="small"
                    />
                </form>
                <Select
                    label="Filtrer miljø"
                    size="small"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value as FilterType)}
                    style={{ width: '180px' }}
                >
                    <option value="all">Alle</option>
                    <option value="prod-only">Kun prod</option>
                    <option value="dev-only">Kun dev</option>
                </Select>
            </div>
            <div style={{ overflowX: 'auto' }}>
                <div className="my-2 text-md text-[var(--ax-text-default)]">
                    {filteredData.length} nettsider/apper
                </div>
                <Table>
                    <Table.Header>
                        <Table.Row>
                            <Table.HeaderCell scope="col" style={{ width: '20%' }}>Umami-prosjekt</Table.HeaderCell>
                            <Table.HeaderCell scope="col" style={{ width: '10%' }}>Miljø</Table.HeaderCell>
                            <Table.HeaderCell scope="col" style={{ width: '35%' }}>Hoveddomene</Table.HeaderCell>
                            <Table.HeaderCell scope="col" style={{ width: '15%' }}>Opprettet</Table.HeaderCell>
                            <Table.HeaderCell scope="col" style={{ width: '20%' }}>Sporingskode</Table.HeaderCell>
                        </Table.Row>
                    </Table.Header>
                    <Table.Body>
                        {filteredData.map((group) => {
                            const rowCount = (group.prod ? 1 : 0) + (group.dev ? 1 : 0);
                            const isLastRowProd = group.prod && !group.dev;
                            const groupSeparatorStyle = { borderBottom: '2px solid var(--a-border-divider)' };

                            return (
                                <React.Fragment key={group.baseName}>
                                    {group.prod && (
                                        <Table.Row
                                            style={!isLastRowProd ? undefined : groupSeparatorStyle}
                                        >
                                            <Table.HeaderCell scope="row" rowSpan={rowCount} style={{ verticalAlign: 'middle' }}>
                                                {group.baseName}
                                            </Table.HeaderCell>
                                            <Table.DataCell>
                                                <Tag variant="success" size="small">prod</Tag>
                                            </Table.DataCell>
                                            <Table.DataCell>{group.prod.domain}</Table.DataCell>
                                            <Table.DataCell>{formatDate(group.prod.createdAt)}</Table.DataCell>
                                            <Table.DataCell>
                                                <Button
                                                    variant="primary"
                                                    size="small"
                                                    onClick={() => handleButtonClick(group.prod!.name, group.prod!.id, group.prod!.domain, group.prod!.createdAt)}
                                                >
                                                    Sporingskode prod
                                                </Button>
                                            </Table.DataCell>
                                        </Table.Row>
                                    )}
                                    {group.dev && (
                                        <Table.Row
                                            style={groupSeparatorStyle}
                                        >
                                            {!group.prod && (
                                                <Table.HeaderCell scope="row" style={{ verticalAlign: 'middle' }}>
                                                    {group.baseName}
                                                </Table.HeaderCell>
                                            )}
                                            <Table.DataCell>
                                                <Tag variant="alt1" size="small">dev</Tag>
                                            </Table.DataCell>
                                            <Table.DataCell>{group.dev.domain}</Table.DataCell>
                                            <Table.DataCell>{formatDate(group.dev.createdAt)}</Table.DataCell>
                                            <Table.DataCell>
                                                <Button
                                                    variant="secondary"
                                                    size="small"
                                                    onClick={() => handleButtonClick(group.dev!.name, group.dev!.id, group.dev!.domain, group.dev!.createdAt)}
                                                >
                                                    Sporingskode dev
                                                </Button>
                                            </Table.DataCell>
                                        </Table.Row>
                                    )}
                                </React.Fragment>
                            );
                        })}
                    </Table.Body>
                </Table>
            </div>
            <SporingsModal
                ref={ref}
                selectedItem={selectedItem}
                onClose={() => setSearchParams({})}
            />
        </>
    );
}

export default TeamWebsites;

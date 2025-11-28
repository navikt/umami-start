import { useState } from 'react';
import { Button, Alert, Loader, Radio, RadioGroup, Table, Heading, Tabs, Switch } from '@navikt/ds-react';
import ChartLayout from '../components/ChartLayout';
import WebsitePicker from '../components/WebsitePicker';
import { Website } from '../types/chart';

const PrivacyCheck = () => {
    const [selectedWebsite, setSelectedWebsite] = useState<Website | null>(null);
    const [period, setPeriod] = useState<string>('current_month');
    const [data, setData] = useState<any[] | null>(null);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [queryStats, setQueryStats] = useState<any>(null);
    const [activeTab, setActiveTab] = useState<string>('summary');
    const [selectedType, setSelectedType] = useState<string | null>(null);
    const [showEmpty, setShowEmpty] = useState<boolean>(false);

    const fetchData = async () => {
        if (!selectedWebsite) return;

        setLoading(true);
        setError(null);
        setData(null);
        setQueryStats(null);
        setSelectedType(null); // Reset filter on new search

        // Calculate date range based on period
        const now = new Date();
        let startDate: Date;
        let endDate: Date;

        if (period === 'current_month') {
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            endDate = now;
        } else {
            startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            endDate = new Date(now.getFullYear(), now.getMonth(), 0);
        }

        try {
            const response = await fetch('/api/bigquery/privacy-check', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    websiteId: selectedWebsite.id,
                    startDate: startDate.toISOString(),
                    endDate: endDate.toISOString(),
                }),
            });

            if (!response.ok) {
                throw new Error('Kunne ikke hente data');
            }

            const result = await response.json();

            if (result.error) {
                setError(result.error);
            } else {
                setData(result.data);
                setQueryStats(result.queryStats);
            }
        } catch (err) {
            console.error('Error fetching privacy check data:', err);
            setError('Det oppstod en feil ved henting av data.');
        } finally {
            setLoading(false);
        }
    };

    // Get unique match types for tabs
    const matchTypes = data ? Array.from(new Set(data.map(row => row.match_type))) : [];

    const handleExplore = (type: string) => {
        setSelectedType(type);
        setActiveTab('details');
    };

    const filteredData = data
        ? (selectedType ? data.filter(row => row.match_type === selectedType) : data)
        : [];

    const visibleData = filteredData.filter(row => showEmpty || row.count > 0);

    return (
        <ChartLayout
            title="Personvernssjekk"
            description="Søk etter potensielle personopplysninger."
            currentPage="personvern" // Assuming we might add this to AnalyticsPage type later, or just use a dummy
            filters={
                <>
                    <WebsitePicker
                        selectedWebsite={selectedWebsite}
                        onWebsiteChange={setSelectedWebsite}
                        variant="minimal"
                    />

                    <RadioGroup
                        legend="Periode"
                        value={period}
                        onChange={(val: string) => setPeriod(val)}
                    >
                        <Radio value="current_month">Denne måneden</Radio>
                        <Radio value="last_month">Forrige måned</Radio>
                    </RadioGroup>

                    <Button
                        onClick={fetchData}
                        disabled={!selectedWebsite || loading}
                        loading={loading}
                        className="w-full"
                    >
                        Kjør personvernssjekk
                    </Button>
                </>
            }
        >
            {error && (
                <Alert variant="error" className="mb-4">
                    {error}
                </Alert>
            )}

            {loading && (
                <div className="flex justify-center items-center h-full">
                    <Loader size="xlarge" title="Søker etter personopplysninger..." />
                </div>
            )}

            {!loading && data && (
                <>
                    <div className="flex justify-between items-center mb-4">
                        <Heading level="2" size="medium">Resultater</Heading>
                    </div>

                    {data.length === 0 ? (
                        <Alert variant="success">Ingen treff funnet i valgt periode.</Alert>
                    ) : (
                        <Tabs value={activeTab} onChange={setActiveTab}>
                            <Tabs.List>
                                <Tabs.Tab value="summary" label="Oppsummering" />
                                <Tabs.Tab value="details" label="Detaljer" />
                            </Tabs.List>

                            <Tabs.Panel value="summary" className="mt-4">
                                <Table>
                                    <Table.Header>
                                        <Table.Row>
                                            <Table.HeaderCell>Type</Table.HeaderCell>
                                            <Table.HeaderCell>Totalt antall forekomster</Table.HeaderCell>
                                            <Table.HeaderCell>Handling</Table.HeaderCell>
                                        </Table.Row>
                                    </Table.Header>
                                    <Table.Body>
                                        {matchTypes.map(type => {
                                            const totalCount = data
                                                .filter(r => r.match_type === type)
                                                .reduce((sum, r) => sum + r.count, 0);
                                            return (
                                                <Table.Row key={type}>
                                                    <Table.DataCell>{type}</Table.DataCell>
                                                    <Table.DataCell>{totalCount.toLocaleString('no-NO')}</Table.DataCell>
                                                    <Table.DataCell>
                                                        <Button
                                                            size="small"
                                                            variant="secondary"
                                                            onClick={() => handleExplore(type)}
                                                        >
                                                            Utforsk
                                                        </Button>
                                                    </Table.DataCell>
                                                </Table.Row>
                                            );
                                        })}
                                        <Table.Row className="font-bold">
                                            <Table.DataCell>Totalt</Table.DataCell>
                                            <Table.DataCell>
                                                {data.reduce((sum, r) => sum + r.count, 0).toLocaleString('no-NO')}
                                            </Table.DataCell>
                                            <Table.DataCell></Table.DataCell>
                                        </Table.Row>
                                    </Table.Body>
                                </Table>
                            </Tabs.Panel>

                            <Tabs.Panel value="details" className="mt-4">
                                <div className="flex justify-between items-end mb-4">
                                    {selectedType ? (
                                        <div className="flex items-center gap-4 bg-blue-50 p-2 px-4 rounded-md border border-blue-100">
                                            <div>
                                                Viser detaljer for: <strong>{selectedType}</strong>
                                            </div>
                                            <Button
                                                size="small"
                                                variant="tertiary"
                                                onClick={() => setSelectedType(null)}
                                            >
                                                Vis alle
                                            </Button>
                                        </div>
                                    ) : <div></div>}

                                    <Switch
                                        checked={showEmpty}
                                        onChange={() => setShowEmpty(!showEmpty)}
                                        size="small"
                                    >
                                        Vis rader uten treff
                                    </Switch>
                                </div>

                                <div className="overflow-x-auto">
                                    <Table>
                                        <Table.Header>
                                            <Table.Row>
                                                <Table.HeaderCell>Tabell</Table.HeaderCell>
                                                <Table.HeaderCell>Kolonne</Table.HeaderCell>
                                                <Table.HeaderCell>Type</Table.HeaderCell>
                                                <Table.HeaderCell>Antall</Table.HeaderCell>
                                                <Table.HeaderCell>Eksempel</Table.HeaderCell>
                                            </Table.Row>
                                        </Table.Header>
                                        <Table.Body>
                                            {visibleData.map((row, index) => (
                                                <Table.Row key={index}>
                                                    <Table.DataCell>{row.table_name}</Table.DataCell>
                                                    <Table.DataCell>{row.column_name}</Table.DataCell>
                                                    <Table.DataCell>{row.match_type}</Table.DataCell>
                                                    <Table.DataCell>{row.count.toLocaleString('no-NO')}</Table.DataCell>
                                                    <Table.DataCell className="font-mono text-sm whitespace-nowrap">{row.example}</Table.DataCell>
                                                </Table.Row>
                                            ))}
                                        </Table.Body>
                                    </Table>
                                </div>
                            </Tabs.Panel>
                        </Tabs>
                    )}

                    {queryStats && (
                        <div className="mt-8 pt-4 border-t border-gray-200 text-sm text-gray-500 flex justify-between">
                            <div>
                                Data prosessert (Dry Run): {queryStats.totalBytesProcessedGB} GB
                            </div>
                            <div>
                                Estimert kostnad: ${queryStats.estimatedCostUSD}
                            </div>
                        </div>
                    )}
                </>
            )}
        </ChartLayout>
    );
};

export default PrivacyCheck;

import { useState } from 'react';
import { Heading, TextField, Button, Alert, Loader, Select, Tabs } from '@navikt/ds-react';
import { SankeyChart, IChartProps } from '@fluentui/react-charting';
import WebsitePicker from '../components/WebsitePicker';
import { Website } from '../types/chart';

const UserJourney = () => {
    const [selectedWebsite, setSelectedWebsite] = useState<Website | null>(null);
    const [startUrl, setStartUrl] = useState<string>('/');
    const [steps, setSteps] = useState<number>(3);
    const [limit, setLimit] = useState<number>(30);
    const [limitInput, setLimitInput] = useState<string>('30');
    const [data, setData] = useState<IChartProps | null>(null);
    const [rawData, setRawData] = useState<{ nodes: any[], links: any[] } | null>(null);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<string>('sankey');

    const fetchData = async () => {
        if (!selectedWebsite) return;

        setLoading(true);
        setError(null);
        setData(null);
        setRawData(null);

        try {
            console.log('Fetching journeys for:', { websiteId: selectedWebsite.id, startUrl, steps, limit });
            const response = await fetch('/api/bigquery/journeys', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    websiteId: selectedWebsite.id,
                    startUrl,
                    days: 30,
                    steps,
                    limit,
                }),
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch user journeys: ${response.status} ${response.statusText}`);
            }

            const contentType = response.headers.get("content-type");
            if (!contentType || !contentType.includes("application/json")) {
                const text = await response.text();
                console.error("Received non-JSON response:", text.substring(0, 100));
                throw new Error("Server returned non-JSON response. Did you restart the server?");
            }

            const result = await response.json();
            console.log('Journey data received:', result);

            // Log query stats if available
            if (result.queryStats) {
                console.log(`[User Journeys] Query processed ${result.queryStats.totalBytesProcessedGB} GB, estimated cost: $${result.queryStats.estimatedCostUSD}`);
            }

            if (result.nodes && result.links) {
                setRawData({ nodes: result.nodes, links: result.links });
                setData({
                    chartTitle: "Brukerreiser",
                    SankeyChartData: {
                        nodes: result.nodes,
                        links: result.links,
                    }
                } as unknown as IChartProps);
            } else {
                setRawData({ nodes: [], links: [] });
                setData({
                    SankeyChartData: { nodes: [], links: [] }
                } as unknown as IChartProps);
            }

        } catch (err) {
            console.error(err);
            setError('Kunne ikke laste brukerreiser. Prøv igjen senere.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-8 max-w-[1600px] mx-auto">
            <Heading level="1" size="xlarge" className="mb-8">
                Brukerreiser
            </Heading>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
                <div className="space-y-6">
                    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                        <Heading level="2" size="medium" className="mb-4">
                            Konfigurasjon
                        </Heading>

                        <div className="space-y-4">
                            <WebsitePicker
                                selectedWebsite={selectedWebsite}
                                onWebsiteChange={setSelectedWebsite}
                            />

                            <TextField
                                label="Start URL"
                                description="Hvilken side starter reisen på? (f.eks. /)"
                                value={startUrl}
                                onChange={(e) => setStartUrl(e.target.value)}
                            />

                            <Select
                                label="Antall steg"
                                description="Hvor mange steg vil du se?"
                                value={steps}
                                onChange={(e) => setSteps(Number(e.target.value))}
                            >
                                <option value={1}>1 steg</option>
                                <option value={2}>2 steg</option>
                                <option value={3}>3 steg</option>
                                <option value={4}>4 steg</option>
                                <option value={5}>5 steg</option>
                            </Select>

                            <TextField
                                label="Maks antall sider"
                                description="Viser de mest besøkte sidene"
                                type="number"
                                value={limitInput}
                                onChange={(e) => setLimitInput(e.target.value)}
                                onBlur={() => {
                                    const val = parseInt(limitInput);
                                    if (!isNaN(val) && val > 0) {
                                        setLimit(val);
                                    } else {
                                        setLimitInput(limit.toString());
                                    }
                                }}
                            />


                            <Button
                                onClick={fetchData}
                                disabled={!selectedWebsite || loading}
                                loading={loading}
                            >
                                Vis brukerreiser
                            </Button>
                        </div>
                    </div>
                </div>

                <div className="md:col-span-2 min-h-[600px] bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                    {error && (
                        <Alert variant="error" className="mb-4">
                            {error}
                        </Alert>
                    )}

                    {loading && (
                        <div className="flex justify-center items-center h-full">
                            <Loader size="xlarge" title="Laster brukerreiser..." />
                        </div>
                    )}

                    {!loading && data && (data as any).SankeyChartData?.nodes?.length > 0 && (
                        <Tabs value={activeTab} onChange={setActiveTab}>
                            <Tabs.List>
                                <Tabs.Tab value="sankey" label="Brukerflyt" />
                                <Tabs.Tab value="table" label="Tabell" />
                            </Tabs.List>

                            <Tabs.Panel value="sankey" className="pt-4">
                                <div style={{ height: '600px', width: '100%' }}>
                                    <SankeyChart
                                        data={data}
                                        height={600}
                                        width={1000}
                                        shouldResize={1000}
                                    />
                                </div>
                            </Tabs.Panel>

                            <Tabs.Panel value="table" className="pt-4">
                                <div className="border rounded-lg overflow-hidden">
                                    <div className="overflow-x-auto max-h-[550px] overflow-y-auto">
                                        <table className="min-w-full divide-y divide-gray-200">
                                            <thead className="bg-gray-100 sticky top-0">
                                                <tr>
                                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase">Steg</th>
                                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase">Fra side</th>
                                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase">Til side</th>
                                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase">Antall brukere</th>
                                                </tr>
                                            </thead>
                                            <tbody className="bg-white divide-y divide-gray-200">
                                                {rawData && rawData.links.map((link: any, idx: number) => {
                                                    const sourceNode = rawData.nodes.find((n: any) => rawData.nodes.indexOf(n) === link.source);
                                                    const targetNode = rawData.nodes.find((n: any) => rawData.nodes.indexOf(n) === link.target);

                                                    const stepMatch = sourceNode?.nodeId?.match(/^(\d+):/);
                                                    const step = stepMatch ? parseInt(stepMatch[1]) + 1 : '-';

                                                    return (
                                                        <tr key={idx} className="hover:bg-gray-50">
                                                            <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">{step}</td>
                                                            <td className="px-4 py-2 text-sm text-gray-900">{sourceNode?.name || '-'}</td>
                                                            <td className="px-4 py-2 text-sm text-gray-900">{targetNode?.name || '-'}</td>
                                                            <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">{link.value.toLocaleString('nb-NO')}</td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                    <div className="px-4 py-2 bg-gray-50 text-sm text-gray-600 border-t">
                                        {rawData && `${rawData.links.length} forbindelser mellom ${rawData.nodes.length} sider`}
                                    </div>
                                </div>
                            </Tabs.Panel>
                        </Tabs>
                    )}

                    {!loading && data && (data as any).SankeyChartData?.nodes?.length === 0 && (
                        <div className="flex justify-center items-center h-full text-gray-500">
                            Ingen data funnet for valgt periode og start-URL.
                        </div>
                    )}

                    {!loading && !data && !error && (
                        <div className="flex justify-center items-center h-full text-gray-500">
                            Velg nettside og start-URL for å se brukerreiser.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default UserJourney;

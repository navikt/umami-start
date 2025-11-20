import { useState } from 'react';
import { Heading, TextField, Button, Alert, Loader, Select, Tabs } from '@navikt/ds-react';
import { SankeyChart, IChartProps } from '@fluentui/react-charting';
import { Download, Maximize2, Minimize2 } from 'lucide-react';
import { utils as XLSXUtils, write as XLSXWrite } from 'xlsx';
import WebsitePicker from '../components/WebsitePicker';
import UmamiJourneyView from '../components/UmamiJourneyView';
import { Website } from '../types/chart';

const UserJourney = () => {
    const [selectedWebsite, setSelectedWebsite] = useState<Website | null>(null);
    const [startUrl, setStartUrl] = useState<string>('/');
    const [steps, setSteps] = useState<number>(2);
    const [limit, setLimit] = useState<number>(15);
    const [limitInput, setLimitInput] = useState<string>('15');
    const [data, setData] = useState<IChartProps | null>(null);
    const [rawData, setRawData] = useState<{ nodes: any[], links: any[] } | null>(null);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<string>('steps');
    const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

    // Helper function to normalize URL input - extracts path from full URLs
    const normalizeUrlToPath = (input: string): string => {
        if (!input.trim()) return '/';

        const trimmed = input.trim();

        try {
            // Check if input looks like a full URL (contains protocol)
            if (trimmed.includes('://')) {
                const url = new URL(trimmed);
                return url.pathname;
            }

            // Check if input looks like a domain without protocol
            // e.g., "nav.no/arbeid" or "www.nav.no/arbeid"
            // Pattern: contains a dot and doesn't start with /
            if (!trimmed.startsWith('/') && trimmed.includes('.') && trimmed.includes('/')) {
                // Prepend protocol and try to parse
                const url = new URL('https://' + trimmed);
                console.log('[URL Normalization] Domain without protocol detected:', trimmed, '→', url.pathname);
                return url.pathname;
            }
        } catch (e) {
            // If URL parsing fails, treat as path
            console.log('[URL Normalization] Parse error, using as-is:', trimmed);
        }

        // Already a path or invalid URL - return as-is
        console.log('[URL Normalization] Already a path:', trimmed);
        return trimmed;
    };

    const downloadCSV = () => {
        if (!rawData || !rawData.links || rawData.links.length === 0) return;

        const headers = ['Steg', 'Fra side', 'Til side', 'Antall brukere'];
        const csvRows = [
            headers.join(','),
            ...rawData.links.map((link: any) => {
                const sourceNode = rawData.nodes.find((n: any) => rawData.nodes.indexOf(n) === link.source);
                const targetNode = rawData.nodes.find((n: any) => rawData.nodes.indexOf(n) === link.target);
                const stepMatch = sourceNode?.nodeId?.match(/^(\d+):/);
                const step = stepMatch ? parseInt(stepMatch[1]) + 1 : '-';

                const escapeCSV = (val: any) => {
                    const str = val !== null && val !== undefined ? String(val) : '';
                    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
                        return '"' + str.replace(/"/g, '""') + '"';
                    }
                    return str;
                };

                return [
                    step,
                    escapeCSV(sourceNode?.name || '-'),
                    escapeCSV(targetNode?.name || '-'),
                    link.value
                ].join(',');
            })
        ];

        const csvContent = csvRows.join('\n');
        const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `brukerreiser_${selectedWebsite?.name || 'data'}_${new Date().toISOString().slice(0, 10)}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const downloadExcel = () => {
        if (!rawData || !rawData.links || rawData.links.length === 0) return;

        const worksheetData = [
            ['Steg', 'Fra side', 'Til side', 'Antall brukere'],
            ...rawData.links.map((link: any) => {
                const sourceNode = rawData.nodes.find((n: any) => rawData.nodes.indexOf(n) === link.source);
                const targetNode = rawData.nodes.find((n: any) => rawData.nodes.indexOf(n) === link.target);
                const stepMatch = sourceNode?.nodeId?.match(/^(\d+):/);
                const step = stepMatch ? parseInt(stepMatch[1]) + 1 : '-';

                return [
                    step,
                    sourceNode?.name || '-',
                    targetNode?.name || '-',
                    link.value
                ];
            })
        ];

        const worksheet = XLSXUtils.aoa_to_sheet(worksheetData);
        const workbook = XLSXUtils.book_new();
        XLSXUtils.book_append_sheet(workbook, worksheet, 'Brukerreiser');

        const wbout = XLSXWrite(workbook, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([wbout], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        });

        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `brukerreiser_${selectedWebsite?.name || 'data'}_${new Date().toISOString().slice(0, 10)}.xlsx`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

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
        <div className="py-8 max-w-[1600px] mx-auto">
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
                                label="Start URL-sti"
                                description="Hvilken side starter reisen på? (f.eks. /)"
                                value={startUrl}
                                onChange={(e) => setStartUrl(normalizeUrlToPath(e.target.value))}
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
                                <Tabs.Tab value="steps" label="Stegvisning" />
                                <Tabs.Tab value="sankey" label="Flytdiagram" />
                                <Tabs.Tab value="table" label="Tabell" />
                            </Tabs.List>

                            <Tabs.Panel value="sankey" className="pt-4">
                                <div className={`${isFullscreen ? 'fixed inset-0 z-50 bg-white p-8 overflow-auto' : ''}`}>
                                    {isFullscreen && (
                                        <div className="mb-4 flex justify-end">
                                            <Button
                                                size="small"
                                                variant="tertiary"
                                                onClick={() => setIsFullscreen(false)}
                                                icon={<Minimize2 size={20} />}
                                            >
                                                Lukk fullskjerm
                                            </Button>
                                        </div>
                                    )}
                                    {!isFullscreen && (
                                        <div className="mb-2 flex justify-end">
                                            <Button
                                                size="small"
                                                variant="tertiary"
                                                onClick={() => setIsFullscreen(true)}
                                                icon={<Maximize2 size={20} />}
                                            >
                                                Fullskjerm
                                            </Button>
                                        </div>
                                    )}
                                    <div style={{ height: isFullscreen ? 'calc(100vh - 120px)' : '600px', width: '100%' }}>
                                        <SankeyChart
                                            data={data}
                                            height={isFullscreen ? window.innerHeight - 120 : 600}
                                            width={isFullscreen ? window.innerWidth - 100 : 1000}
                                            shouldResize={isFullscreen ? window.innerWidth - 100 : 1000}
                                        />
                                    </div>
                                </div>
                            </Tabs.Panel>

                            <Tabs.Panel value="steps" className="pt-4">
                                <div className={`${isFullscreen ? 'fixed inset-0 z-50 bg-white p-8 overflow-auto' : ''}`}>
                                    {isFullscreen && (
                                        <div className="mb-4 flex justify-end">
                                            <Button
                                                size="small"
                                                variant="tertiary"
                                                onClick={() => setIsFullscreen(false)}
                                                icon={<Minimize2 size={20} />}
                                            >
                                                Lukk fullskjerm
                                            </Button>
                                        </div>
                                    )}
                                    {!isFullscreen && (
                                        <div className="mb-2 flex justify-end">
                                            <Button
                                                size="small"
                                                variant="tertiary"
                                                onClick={() => setIsFullscreen(true)}
                                                icon={<Maximize2 size={20} />}
                                            >
                                                Fullskjerm
                                            </Button>
                                        </div>
                                    )}
                                    <UmamiJourneyView
                                        nodes={rawData?.nodes || []}
                                        links={rawData?.links || []}
                                        isFullscreen={isFullscreen}
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
                                    <div className="flex gap-2 p-3 bg-gray-50 border-b">
                                        <Button
                                            size="small"
                                            variant="secondary"
                                            onClick={downloadCSV}
                                            icon={<Download size={16} />}
                                        >
                                            Last ned CSV
                                        </Button>
                                        <Button
                                            size="small"
                                            variant="secondary"
                                            onClick={downloadExcel}
                                            icon={<Download size={16} />}
                                        >
                                            Last ned Excel
                                        </Button>
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

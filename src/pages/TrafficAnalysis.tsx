import { useState, useMemo } from 'react';
import { Button, Alert, Loader, Tabs, TextField, Radio, RadioGroup, Switch, Chips } from '@navikt/ds-react';
import { LineChart, ILineChartDataPoint, ILineChartProps, ResponsiveContainer } from '@fluentui/react-charting';
import { Download } from 'lucide-react';
import ChartLayout from '../components/ChartLayout';
import WebsitePicker from '../components/WebsitePicker';
import UmamiTrafficView from '../components/UmamiTrafficView';
import { Website } from '../types/chart';

const TrafficAnalysis = () => {
    const [selectedWebsite, setSelectedWebsite] = useState<Website | null>(null);
    const [urlPath, setUrlPath] = useState<string>('');
    const [period, setPeriod] = useState<string>('current_month');
    const [activeTab, setActiveTab] = useState<string>('visits');

    // View options
    const [showAverage, setShowAverage] = useState<boolean>(false);
    const [flowFilter, setFlowFilter] = useState<string>('all'); // 'all', 'external', 'internal'

    // Data states
    const [seriesData, setSeriesData] = useState<any[]>([]);
    const [flowData, setFlowData] = useState<any[]>([]);
    const [seriesQueryStats, setSeriesQueryStats] = useState<any>(null);
    const [flowQueryStats, setFlowQueryStats] = useState<any>(null);

    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [hasAttemptedFetch, setHasAttemptedFetch] = useState<boolean>(false);

    const fetchData = async () => {
        if (!selectedWebsite) return;

        setLoading(true);
        setError(null);
        setSeriesData([]);
        setFlowData([]);
        setHasAttemptedFetch(true);

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
            // Fetch Series Data
            const seriesResponse = await fetch(`/api/bigquery/websites/${selectedWebsite.id}/traffic-series?startAt=${startDate.getTime()}&endAt=${endDate.getTime()}&urlPath=${encodeURIComponent(urlPath)}`);
            if (!seriesResponse.ok) throw new Error('Kunne ikke hente trafikkdata');
            const seriesResult = await seriesResponse.json();

            if (seriesResult.data) {
                setSeriesData(seriesResult.data);
            }
            if (seriesResult.queryStats) {
                setSeriesQueryStats(seriesResult.queryStats);
            }

            // Fetch Flow Data
            const normalizedPath = urlPath !== '/' && urlPath.endsWith('/') ? urlPath.slice(0, -1) : urlPath;
            const flowUrl = `/api/bigquery/websites/${selectedWebsite.id}/traffic-flow?startAt=${startDate.getTime()}&endAt=${endDate.getTime()}&limit=100${normalizedPath ? `&urlPath=${encodeURIComponent(normalizedPath)}` : ''}`;
            const flowResponse = await fetch(flowUrl);
            if (!flowResponse.ok) throw new Error('Kunne ikke hente trafikkflyt');
            const flowResult = await flowResponse.json();

            if (flowResult.data) {
                setFlowData(flowResult.data);
            }
            if (flowResult.queryStats) {
                setFlowQueryStats(flowResult.queryStats);
            }

        } catch (err: any) {
            console.error('Error fetching traffic data:', err);
            setError(err.message || 'Det oppstod en feil ved henting av data.');
        } finally {
            setLoading(false);
        }
    };

    // Prepare Chart Data
    const chartData: ILineChartProps | null = useMemo(() => {
        if (!seriesData.length) return null;

        const points: ILineChartDataPoint[] = seriesData.map((item: any) => ({
            x: new Date(item.time),
            y: item.count,
            legend: new Date(item.time).toLocaleDateString('nb-NO'),
            xAxisCalloutData: new Date(item.time).toLocaleDateString('nb-NO'),
            yAxisCalloutData: `${item.count} besøk`
        }));

        const lines = [
            {
                legend: 'Besøk',
                data: points,
                color: '#0067c5',
            }
        ];

        if (showAverage) {
            const total = points.reduce((sum, p) => sum + p.y, 0);
            const avg = total / points.length;
            const avgPoints = points.map(p => ({
                ...p,
                y: avg,
                yAxisCalloutData: `Gjennomsnitt: ${Math.round(avg)}`
            }));

            lines.push({
                legend: 'Gjennomsnitt',
                data: avgPoints,
                color: '#ff9100',
            });
        }

        return {
            data: {
                lineChartData: lines
            },
        };
    }, [seriesData, showAverage]);

    // Transform flow data for UmamiJourneyView
    const { nodes, links } = useMemo(() => {
        if (!flowData.length) return { nodes: [], links: [] };

        // Filter data
        const filteredData = flowData.filter(row => {
            const isInternal = row.source.startsWith('/') || row.source.includes('nav.no') || row.source === 'Direkte / Annet';

            if (flowFilter === 'external') {
                return !isInternal;
            }
            if (flowFilter === 'internal') {
                return isInternal;
            }
            return true;
        });

        const nodesMap = new Map<string, number>();
        const nodesList: { nodeId: string; name: string; color?: string }[] = [];
        const linksList: { source: number; target: number; value: number }[] = [];

        const getNodeIndex = (step: number, name: string) => {
            const id = `${step}:${name}`;
            if (!nodesMap.has(id)) {
                nodesMap.set(id, nodesList.length);
                nodesList.push({ nodeId: id, name });
            }
            return nodesMap.get(id)!;
        };

        filteredData.forEach(row => {
            // Use 0-based steps so they display as 1, 2, 3
            const sourceIdx = getNodeIndex(0, row.source);
            const landingIdx = getNodeIndex(1, row.landingPage);
            const nextIdx = getNodeIndex(2, row.nextPage);

            // Link 1: Source -> Landing
            linksList.push({ source: sourceIdx, target: landingIdx, value: row.count });

            // Link 2: Landing -> Next
            linksList.push({ source: landingIdx, target: nextIdx, value: row.count });
        });

        return { nodes: nodesList, links: linksList };
    }, [flowData, flowFilter]);

    const downloadCSV = () => {
        if (!seriesData.length) return;

        const headers = ['Dato', 'Antall besøk'];
        const csvRows = [
            headers.join(','),
            ...seriesData.map((item) => {
                return [
                    new Date(item.time).toLocaleDateString('nb-NO'),
                    item.count
                ].join(',');
            })
        ];

        const csvContent = csvRows.join('\n');
        const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `traffic_${selectedWebsite?.name || 'data'}_${new Date().toISOString().slice(0, 10)}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    return (
        <ChartLayout
            title="Trafikkanalyse"

            description="Se besøk over tid og hvor trafikken kommer fra."
            currentPage="trafikkanalyse"
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

                    <TextField
                        label="URL-sti (valgfritt)"
                        description="F.eks. / for forsiden"
                        value={urlPath}
                        onChange={(e) => setUrlPath(e.target.value)}
                    />

                    <Button
                        onClick={fetchData}
                        disabled={!selectedWebsite || loading}
                        loading={loading}
                        className="w-full"
                    >
                        Vis trafikk
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
                    <Loader size="xlarge" title="Henter data..." />
                </div>
            )}

            {!loading && hasAttemptedFetch && !error && (
                <Tabs value={activeTab} onChange={setActiveTab}>
                    <Tabs.List>
                        <Tabs.Tab value="visits" label="Besøk over tid" />
                        <Tabs.Tab value="flow" label="Trafikkflyt" />
                    </Tabs.List>

                    <Tabs.Panel value="visits" className="pt-4">
                        <div className="flex flex-col gap-8">
                            {/* Chart */}
                            <div className="flex flex-col gap-4">
                                <div className="flex justify-end -mb-5">
                                    <Switch
                                        checked={showAverage}
                                        onChange={(e) => setShowAverage(e.target.checked)}
                                        size="small"
                                    >
                                        Vis gjennomsnitt
                                    </Switch>
                                </div>
                                <div style={{ width: '100%', height: '400px' }}>
                                    {chartData ? (
                                        <ResponsiveContainer>
                                            <LineChart
                                                data={chartData.data}
                                                legendsOverflowText={'Overflow Items'}
                                                yAxisTickFormat={(d: any) => d.toLocaleString('nb-NO')}
                                                yAxisTickCount={10}
                                                allowMultipleShapesForPoints={false}
                                                enablePerfOptimization={true}
                                                margins={{ left: 50, right: 40, top: 20, bottom: 35 }}
                                            />
                                        </ResponsiveContainer>
                                    ) : (
                                        <div className="flex items-center justify-center h-full text-gray-500">
                                            Ingen data tilgjengelig for diagram
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Table */}
                            <div className="border rounded-lg overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="min-w-full divide-y divide-gray-200">
                                        <thead className="bg-gray-100">
                                            <tr>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Dato</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Antall besøk</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-200">
                                            {seriesData.map((item, index) => (
                                                <tr key={index} className="hover:bg-gray-50">
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                                        {new Date(item.time).toLocaleDateString('nb-NO')}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                        {item.count.toLocaleString('nb-NO')}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                <div className="flex gap-2 p-3 bg-gray-50 border-t justify-between items-center">
                                    <div className="flex gap-2">
                                        <Button
                                            size="small"
                                            variant="secondary"
                                            onClick={downloadCSV}
                                            icon={<Download size={16} />}
                                        >
                                            Last ned CSV
                                        </Button>
                                    </div>
                                    {seriesQueryStats && (
                                        <span className="text-sm text-gray-600">
                                            Data prosessert: {seriesQueryStats.totalBytesProcessedGB} GB
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </Tabs.Panel>

                    <Tabs.Panel value="flow" className="pt-4">
                        <div className="flex flex-col gap-4">
                            <Alert variant="info" size="small">
                                <div className="flex flex-col gap-1">
                                    <div>Viser topp 100 trafikkflyter sortert etter volum. Kilder med lavere trafikk vises ikke.</div>
                                    {flowQueryStats && (
                                        <div className="text-xs">
                                            Data prosessert: {flowQueryStats.totalBytesProcessedGB} GB
                                        </div>
                                    )}
                                </div>
                            </Alert>
                            <div className="flex gap-2">
                                <Chips>
                                    <Chips.Toggle
                                        selected={flowFilter === 'all'}
                                        onClick={() => setFlowFilter('all')}
                                    >
                                        Alle kilder
                                    </Chips.Toggle>
                                    <Chips.Toggle
                                        selected={flowFilter === 'external'}
                                        onClick={() => setFlowFilter('external')}
                                    >
                                        Eksterne kilder
                                    </Chips.Toggle>
                                    <Chips.Toggle
                                        selected={flowFilter === 'internal'}
                                        onClick={() => setFlowFilter('internal')}
                                    >
                                        Interne / Direkte
                                    </Chips.Toggle>
                                </Chips>
                            </div>

                            <div className="min-h-[500px]">
                                {nodes.length > 0 ? (
                                    <UmamiTrafficView nodes={nodes} links={links} />
                                ) : (
                                    <div className="flex items-center justify-center h-full text-gray-500">
                                        Ingen flytdata tilgjengelig for valgt filter
                                    </div>
                                )}
                            </div>
                        </div>
                    </Tabs.Panel>
                </Tabs>
            )}
        </ChartLayout>
    );
};

export default TrafficAnalysis;

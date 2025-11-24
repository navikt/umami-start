import { useState, useMemo } from 'react';
import { Button, Alert, Loader, Tabs, TextField, Radio, RadioGroup, Switch, Table, Heading } from '@navikt/ds-react';
import { LineChart, ILineChartDataPoint, ILineChartProps, ResponsiveContainer } from '@fluentui/react-charting';
import { Download } from 'lucide-react';
import ChartLayout from '../components/ChartLayout';
import WebsitePicker from '../components/WebsitePicker';
import { Website } from '../types/chart';

const TrafficAnalysis = () => {
    const [selectedWebsite, setSelectedWebsite] = useState<Website | null>(null);
    const [urlPath, setUrlPath] = useState<string>('');
    const [period, setPeriod] = useState<string>('current_month');

    // Tab states
    const [activeTab, setActiveTab] = useState<string>('visits');

    // View options
    const [metricType, setMetricType] = useState<string>('visitors'); // 'visitors', 'sessions', 'pageviews'
    const [submittedMetricType, setSubmittedMetricType] = useState<string>('visitors'); // Track what was actually submitted
    const [showAverage, setShowAverage] = useState<boolean>(false);

    // Data states
    const [seriesData, setSeriesData] = useState<any[]>([]);
    const [flowData, setFlowData] = useState<any[]>([]);
    const [seriesQueryStats, setSeriesQueryStats] = useState<any>(null);
    const [setFlowQueryStats] = useState<any>(null);

    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [hasAttemptedFetch, setHasAttemptedFetch] = useState<boolean>(false);

    const fetchSeriesData = async () => {
        if (!selectedWebsite) return;

        setLoading(true);
        setError(null);
        setSeriesData([]);
        setFlowData([]); // Clear flow data when fetching new series data
        setHasAttemptedFetch(true);
        setSubmittedMetricType(metricType); // Store the submitted metric type

        // Calculate date range based on period
        const now = new Date();
        let startDate: Date;
        let endDate: Date;

        if (period === 'current_month') {
            // Use UTC to avoid timezone issues where local midnight is previous month in UTC
            startDate = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));
            endDate = now;
        } else {
            startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            endDate = new Date(now.getFullYear(), now.getMonth(), 0);
        }

        try {
            // Fetch Series Data
            const seriesResponse = await fetch(`/api/bigquery/websites/${selectedWebsite.id}/traffic-series?startAt=${startDate.getTime()}&endAt=${endDate.getTime()}&urlPath=${encodeURIComponent(urlPath)}&metricType=${metricType}`);
            if (!seriesResponse.ok) throw new Error('Kunne ikke hente trafikkdata');
            const seriesResult = await seriesResponse.json();

            if (seriesResult.data) {
                setSeriesData(seriesResult.data);
            }
            if (seriesResult.queryStats) {
                setSeriesQueryStats(seriesResult.queryStats);
            }

            // Always fetch flow data as it's needed for the tabs
            await fetchFlowData(startDate, endDate, metricType);

        } catch (err: any) {
            console.error('Error fetching traffic data:', err);
            setError(err.message || 'Det oppstod en feil ved henting av data.');
        } finally {
            setLoading(false);
        }
    };

    const fetchFlowData = async (providedStartDate?: Date, providedEndDate?: Date, metricTypeOverride?: string) => {
        if (!selectedWebsite) return;

        // Use provided dates or calculate them
        let startDate: Date;
        let endDate: Date;

        if (providedStartDate && providedEndDate) {
            startDate = providedStartDate;
            endDate = providedEndDate;
        } else {
            const now = new Date();
            if (period === 'current_month') {
                // Use UTC to avoid timezone issues where local midnight is previous month in UTC
                startDate = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));
                endDate = now;
            } else {
                startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                endDate = new Date(now.getFullYear(), now.getMonth(), 0);
            }
        }

        const metricToUse = metricTypeOverride || submittedMetricType;

        try {
            // Fetch Flow Data
            const normalizedPath = urlPath !== '/' && urlPath.endsWith('/') ? urlPath.slice(0, -1) : urlPath;
            const flowUrl = `/api/bigquery/websites/${selectedWebsite.id}/traffic-flow?startAt=${startDate.getTime()}&endAt=${endDate.getTime()}&limit=100${normalizedPath ? `&urlPath=${encodeURIComponent(normalizedPath)}` : ''}&metricType=${metricToUse}`;
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
            console.error('Error fetching traffic flow data:', err);
            // Don't set main error here to avoid blocking the chart if flow fails
        }
    };

    // Prepare Chart Data
    const chartData: ILineChartProps | null = useMemo(() => {
        if (!seriesData.length) return null;

        const metricLabel = submittedMetricType === 'pageviews' ? 'sidevisninger' : 'besøkende';
        const metricLabelCapitalized = submittedMetricType === 'pageviews' ? 'Sidevisninger' : 'Besøkende';

        const points: ILineChartDataPoint[] = seriesData.map((item: any) => ({
            x: new Date(item.time),
            y: item.count,
            legend: new Date(item.time).toLocaleDateString('nb-NO'),
            xAxisCalloutData: new Date(item.time).toLocaleDateString('nb-NO'),
            yAxisCalloutData: `${item.count} ${metricLabel}`
        }));

        const lines = [
            {
                legend: metricLabelCapitalized,
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
    }, [seriesData, showAverage, submittedMetricType]);

    const downloadCSV = () => {
        if (!seriesData.length) return;

        const metricLabel = submittedMetricType === 'pageviews' ? 'Antall sidevisninger' : 'Antall besøkende';
        const headers = ['Dato', metricLabel];
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

    // Process Flow Data for Tables
    const { internalPaths, entrances, exits, referrers, channels } = useMemo(() => {
        if (!flowData.length) {
            return { internalPaths: [], entrances: [], exits: [], referrers: [], channels: [] };
        }

        const groupAndSum = (data: any[], keySelector: (item: any) => string, filter?: (item: any) => boolean) => {
            const map = new Map<string, number>();
            data.forEach(item => {
                if (filter && !filter(item)) return;
                const key = keySelector(item);
                map.set(key, (map.get(key) || 0) + item.count);
            });
            return Array.from(map.entries())
                .map(([name, count]) => ({ name, count }))
                .sort((a, b) => b.count - a.count);
        };

        // Internal: Path (Landing Page)
        const internalPaths = groupAndSum(flowData, item => item.landingPage);

        // Internal: Entrances (Source starts with /)
        const entrances = groupAndSum(flowData, item => item.source, item => item.source.startsWith('/'));

        // Internal: Exits (Next Page starts with / or is Exit)
        const exits = groupAndSum(flowData, item => item.nextPage, item => item.nextPage.startsWith('/') || item.nextPage === 'Exit');

        // Sources: Referrers (Source does not start with / and not Direct)
        const referrers = groupAndSum(flowData, item => item.source, item => !item.source.startsWith('/') && item.source !== 'Direkte / Annet');

        // Sources: Channels (Simple mapping)
        const channels = groupAndSum(flowData, item => {
            const source = item.source;
            if (source.startsWith('/')) return 'Intern';
            if (source === 'Direkte / Annet') return 'Direkte';
            if (source.includes('google') || source.includes('bing') || source.includes('yahoo') || source.includes('duckduckgo')) return 'Søkemotorer';
            if (source.includes('facebook') || source.includes('twitter') || source.includes('linkedin') || source.includes('instagram')) return 'Sosiale medier';
            return 'Andre nettsider';
        }, item => !item.source.startsWith('/')); // Exclude internal from channels list? Or include? User asked for "Sources (trafikkilder) - channels". Usually excludes internal.

        return { internalPaths, entrances, exits, referrers, channels };
    }, [flowData]);

    const renderTable = (title: string, data: { name: string; count: number }[]) => (
        <div className="flex flex-col gap-2 w-full">
            <Heading level="3" size="small">{title}</Heading>
            <div className="border rounded-lg overflow-hidden w-full">
                <Table size="small" className="w-full">
                    <Table.Header>
                        <Table.Row>
                            <Table.HeaderCell>Navn</Table.HeaderCell>
                            <Table.HeaderCell align="right">
                                {submittedMetricType === 'pageviews' ? 'Sidevisninger' : 'Besøkende'}
                            </Table.HeaderCell>
                        </Table.Row>
                    </Table.Header>
                    <Table.Body>
                        {data.slice(0, 10).map((row, i) => (
                            <Table.Row key={i}>
                                <Table.DataCell className="truncate max-w-md" title={row.name}>{row.name}</Table.DataCell>
                                <Table.DataCell align="right">{row.count.toLocaleString('nb-NO')}</Table.DataCell>
                            </Table.Row>
                        ))}
                        {data.length === 0 && (
                            <Table.Row>
                                <Table.DataCell colSpan={2} align="center">Ingen data</Table.DataCell>
                            </Table.Row>
                        )}
                    </Table.Body>
                </Table>
            </div>
        </div>
    );

    return (
        <ChartLayout
            title="Trafikkanalyse"
            description="Se besøk over tid og trafikkilder."
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

                    <RadioGroup
                        legend="Visning"
                        value={metricType}
                        onChange={(val: string) => setMetricType(val)}
                    >
                        <Radio value="visitors">Besøkende</Radio>
                        <Radio value="pageviews">Sidevisninger</Radio>
                    </RadioGroup>

                    <TextField
                        label="URL-sti (valgfritt)"
                        description="F.eks. / for forsiden"
                        value={urlPath}
                        onChange={(e) => setUrlPath(e.target.value)}
                    />

                    <Button
                        onClick={fetchSeriesData}
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
                        <Tabs.Tab value="internal" label="Intern trafikk" />
                        <Tabs.Tab value="external" label="Eksterne trafikkilder" />
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
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                                                    {submittedMetricType === 'pageviews' ? 'Antall sidevisninger' : 'Antall besøkende'}
                                                </th>
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

                    <Tabs.Panel value="internal" className="pt-4">
                        <div className="flex flex-col gap-8">
                            {renderTable('Sti', internalPaths)}
                            {renderTable('Innganger', entrances)}
                            {renderTable('Utganger', exits)}
                        </div>
                    </Tabs.Panel>

                    <Tabs.Panel value="external" className="pt-4">
                        <div className="flex flex-col gap-8">
                            {renderTable('Trafikkilder', referrers)}
                            {renderTable('Kanaler', channels)}
                        </div>
                    </Tabs.Panel>
                </Tabs>
            )}
        </ChartLayout>
    );
};

export default TrafficAnalysis;

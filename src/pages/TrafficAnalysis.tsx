import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button, Alert, Loader, Tabs, TextField, Radio, RadioGroup, Switch, Table, Heading, Pagination, VStack } from '@navikt/ds-react';
import { LineChart, ILineChartDataPoint, ResponsiveContainer } from '@fluentui/react-charting';
import { Download, Share2, Check } from 'lucide-react';
import ChartLayout from '../components/ChartLayout';
import WebsitePicker from '../components/WebsitePicker';
import PeriodPicker from '../components/PeriodPicker';
import TrafficStats from '../components/TrafficStats';
import { Website } from '../types/chart';
import { normalizeUrlToPath } from '../lib/utils';


const TrafficAnalysis = () => {
    const [selectedWebsite, setSelectedWebsite] = useState<Website | null>(null);
    const [searchParams] = useSearchParams();

    // Initialize state from URL params
    const [urlPath, setUrlPath] = useState<string>(() => searchParams.get('urlPath') || '');
    const [period, setPeriod] = useState<string>(() => searchParams.get('period') || 'current_month');
    const [customStartDate, setCustomStartDate] = useState<Date | undefined>(undefined);
    const [customEndDate, setCustomEndDate] = useState<Date | undefined>(undefined);

    // Tab states
    const [activeTab, setActiveTab] = useState<string>('visits');

    // View options
    const [metricType, setMetricType] = useState<string>(() => searchParams.get('metricType') || 'visitors'); // 'visitors', 'sessions', 'pageviews'
    const [submittedMetricType, setSubmittedMetricType] = useState<string>('visitors'); // Track what was actually submitted
    const [showAverage, setShowAverage] = useState<boolean>(false);

    // Data states
    const [seriesData, setSeriesData] = useState<any[]>([]);
    const [flowData, setFlowData] = useState<any[]>([]);
    const [seriesQueryStats, setSeriesQueryStats] = useState<any>(null);
    const [flowQueryStats, setFlowQueryStats] = useState<any>(null);

    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [hasAttemptedFetch, setHasAttemptedFetch] = useState<boolean>(false);
    const [copySuccess, setCopySuccess] = useState<boolean>(false);

    // Auto-submit when URL parameters are present (for shared links)
    useEffect(() => {
        // Only auto-submit if there are config params beyond just websiteId
        const hasConfigParams = searchParams.has('period') || searchParams.has('metricType') || searchParams.has('urlPath');
        if (selectedWebsite && hasConfigParams && !hasAttemptedFetch) {
            fetchSeriesData();
        }
    }, [selectedWebsite]); // Only run when selectedWebsite changes

    const fetchSeriesData = async () => {
        if (!selectedWebsite) return;

        // Validation for proportion view
        if (metricType === 'proportion' && !urlPath) {
            setError('Du må oppgi en URL-sti for å se andel.');
            return;
        }

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
        } else if (period === 'last_month') {
            startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            endDate = new Date(now.getFullYear(), now.getMonth(), 0);
        } else if (period === 'custom') {
            if (!customStartDate || !customEndDate) {
                setError('Vennligst velg en gyldig periode.');
                setLoading(false);
                return;
            }
            startDate = new Date(customStartDate);
            startDate.setHours(0, 0, 0, 0);

            // Set to end of the selected day (23:59:59.999) if needed, or if end date is today use current time
            const isToday = customEndDate.getDate() === now.getDate() &&
                customEndDate.getMonth() === now.getMonth() &&
                customEndDate.getFullYear() === now.getFullYear();

            if (isToday) {
                endDate = now;
            } else {
                endDate = new Date(customEndDate);
                endDate.setHours(23, 59, 59, 999);
            }
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
                console.log('[TrafficAnalysis] Series queryStats:', seriesResult.queryStats);
                setSeriesQueryStats(seriesResult.queryStats);
            }

            // Always fetch flow data as it's needed for the tabs
            await fetchFlowData(startDate, endDate, metricType);

            // Update URL with configuration for sharing
            const newParams = new URLSearchParams(window.location.search);
            newParams.set('period', period);
            newParams.set('metricType', metricType);
            if (urlPath) {
                newParams.set('urlPath', urlPath);
            } else {
                newParams.delete('urlPath');
            }

            // Update URL without navigation
            window.history.replaceState({}, '', `${window.location.pathname}?${newParams.toString()}`);


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
            } else if (period === 'last_month') {
                startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                endDate = new Date(now.getFullYear(), now.getMonth(), 0);
            } else if (period === 'custom') {
                if (customStartDate && customEndDate) {
                    startDate = new Date(customStartDate);
                    startDate.setHours(0, 0, 0, 0);
                    // Same logic as main series data
                    const isToday = customEndDate.getDate() === now.getDate() &&
                        customEndDate.getMonth() === now.getMonth() &&
                        customEndDate.getFullYear() === now.getFullYear();
                    if (isToday) {
                        endDate = now;
                    } else {
                        endDate = new Date(customEndDate);
                        endDate.setHours(23, 59, 59, 999);
                    }
                } else {
                    // Fallbacks if somehow called without dates
                    startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                    endDate = new Date(now.getFullYear(), now.getMonth(), 0);
                }
            } else {
                startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                endDate = new Date(now.getFullYear(), now.getMonth(), 0);
            }
        }

        const metricToUse = metricTypeOverride || submittedMetricType;

        try {
            // Fetch Flow Data
            const normalizedPath = urlPath !== '/' && urlPath.endsWith('/') ? urlPath.slice(0, -1) : urlPath;
            const flowUrl = `/api/bigquery/websites/${selectedWebsite.id}/traffic-flow?startAt=${startDate.getTime()}&endAt=${endDate.getTime()}&limit=10000${normalizedPath ? `&urlPath=${encodeURIComponent(normalizedPath)}` : ''}&metricType=${metricToUse}`;
            const flowResponse = await fetch(flowUrl);
            if (!flowResponse.ok) throw new Error('Kunne ikke hente trafikkflyt');
            const flowResult = await flowResponse.json();

            if (flowResult.data) {
                setFlowData(flowResult.data);
            }
            if (flowResult.queryStats) {
                console.log('[TrafficAnalysis] Flow queryStats:', flowResult.queryStats);
                setFlowQueryStats(flowResult.queryStats);
            }
        } catch (err: any) {
            console.error('Error fetching traffic flow data:', err);
            // Don't set main error here to avoid blocking the chart if flow fails
        }
    };

    // Prepare Chart Data
    const chartData = useMemo(() => {
        if (!seriesData.length) return null;

        const metricLabel = submittedMetricType === 'pageviews' ? 'sidevisninger' : (submittedMetricType === 'proportion' ? 'andel' : 'besøkende');
        const metricLabelCapitalized = submittedMetricType === 'pageviews' ? 'Sidevisninger' : (submittedMetricType === 'proportion' ? 'Andel' : 'Besøkende');

        const points: ILineChartDataPoint[] = seriesData.map((item: any) => {
            let val = Number(item.count) || 0; // Ensure it's a number, default to 0

            if (submittedMetricType === 'proportion') {
                // Sanitize proportion data to prevent massive axis scaling
                if (val > 1.01) val = 0; // Allow slight precision error (1.01 = 101%), typically user bug
                if (val < 0) val = 0;
            }

            return {
                x: new Date(item.time),
                y: submittedMetricType === 'proportion' ? Math.min(val * 100, 100) : val, // Hard cap visual at 100%
                legend: new Date(item.time).toLocaleDateString('nb-NO'),
                xAxisCalloutData: new Date(item.time).toLocaleDateString('nb-NO'),
                yAxisCalloutData: submittedMetricType === 'proportion'
                    ? `${(val * 100).toFixed(1)}%`
                    : `${val} ${metricLabel}`
            };
        });

        // Calculate Y-axis bounds from actual data
        const yValues = points.map(p => p.y);
        const dataMax = Math.max(...yValues, 0);

        // Add 10% padding to max, ensure min is 0 for cleaner charts
        const yMax = submittedMetricType === 'proportion'
            ? Math.max(dataMax * 1.1, 1) // At least 1% for proportion, with padding
            : dataMax * 1.1;
        const yMin = 0;

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
                yAxisCalloutData: submittedMetricType === 'proportion'
                    ? `Gjennomsnitt: ${avg.toFixed(1)}%`
                    : `Gjennomsnitt: ${Math.round(avg)}`
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
            yMax,
            yMin,
        };
    }, [seriesData, showAverage, submittedMetricType]);

    const copyShareLink = async () => {
        try {
            await navigator.clipboard.writeText(window.location.href);
            setCopySuccess(true);
            setTimeout(() => setCopySuccess(false), 2000);
        } catch (err) {
            console.error('Failed to copy link:', err);
        }
    };


    const downloadCSV = () => {
        if (!seriesData.length) return;

        const metricLabel = submittedMetricType === 'pageviews' ? 'Antall sidevisninger' : (submittedMetricType === 'proportion' ? 'Andel' : 'Antall besøkende');
        const headers = ['Dato', metricLabel];
        const csvRows = [
            headers.join(','),
            ...seriesData.map((item) => {
                return [
                    new Date(item.time).toLocaleDateString('nb-NO'),
                    submittedMetricType === 'proportion' ? `${(item.count * 100).toFixed(1)}%` : item.count
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

    const TrafficTable = ({ title, data }: { title: string; data: { name: string; count: number }[] }) => {
        const [search, setSearch] = useState('');
        const [page, setPage] = useState(1);
        const rowsPerPage = 20;

        const filteredData = data.filter(row =>
            row.name.toLowerCase().includes(search.toLowerCase())
        );

        // Reset to page 1 when search changes
        useEffect(() => {
            setPage(1);
        }, [search]);

        const paginatedData = filteredData.slice((page - 1) * rowsPerPage, page * rowsPerPage);
        const totalPages = Math.ceil(filteredData.length / rowsPerPage);

        return (
            <VStack gap="4">
                <div className="flex justify-between items-end">
                    <Heading level="3" size="small">{title}</Heading>
                    <div className="w-64">
                        <TextField
                            label="Søk"
                            hideLabel
                            placeholder="Søk..."
                            size="small"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                </div>
                <div className="border rounded-lg overflow-x-auto">
                    <Table size="small">
                        <Table.Header>
                            <Table.Row>
                                <Table.HeaderCell>Navn</Table.HeaderCell>
                                <Table.HeaderCell align="right">
                                    {submittedMetricType === 'pageviews' ? 'Sidevisninger' : (submittedMetricType === 'proportion' ? 'Andel' : 'Besøkende')}
                                </Table.HeaderCell>
                            </Table.Row>
                        </Table.Header>
                        <Table.Body>
                            {paginatedData.map((row, i) => (
                                <Table.Row key={i}>
                                    <Table.DataCell className="truncate max-w-md" title={row.name}>{row.name}</Table.DataCell>
                                    <Table.DataCell align="right">
                                        {submittedMetricType === 'proportion' ? `${(row.count * 100).toFixed(1)}%` : row.count.toLocaleString('nb-NO')}
                                    </Table.DataCell>
                                </Table.Row>
                            ))}
                            {filteredData.length === 0 && (
                                <Table.Row>
                                    <Table.DataCell colSpan={2} align="center">
                                        {data.length > 0 ? 'Ingen treff' : 'Ingen data'}
                                    </Table.DataCell>
                                </Table.Row>
                            )}
                        </Table.Body>
                    </Table>
                </div>
                {totalPages > 1 && (
                    <Pagination
                        page={page}
                        onPageChange={setPage}
                        count={totalPages}
                        size="small"
                    />
                )}
            </VStack>
        );
    };

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

                    <TextField
                        size="small"
                        label="URL-sti (valgfritt)"
                        description="F.eks. / for forsiden"
                        value={urlPath}
                        onChange={(e) => setUrlPath(e.target.value)}
                        onBlur={(e) => setUrlPath(normalizeUrlToPath(e.target.value))}
                    />
                    <PeriodPicker
                        period={period}
                        onPeriodChange={setPeriod}
                        startDate={customStartDate}
                        onStartDateChange={setCustomStartDate}
                        endDate={customEndDate}
                        onEndDateChange={setCustomEndDate}
                    />

                    <RadioGroup
                        size="small"
                        legend="Visning"
                        value={metricType}
                        onChange={(val: string) => setMetricType(val)}
                    >
                        <Radio value="visitors">Besøkende</Radio>
                        <Radio value="pageviews">Sidevisninger</Radio>
                        <Radio value="proportion">Andel (av besøkende)</Radio>
                    </RadioGroup>

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

            {
                loading && (
                    <div className="flex justify-center items-center h-full">
                        <Loader size="xlarge" title="Henter data..." />
                    </div>
                )
            }

            {
                !loading && hasAttemptedFetch && !error && (
                    <>
                        <div className="flex justify-between items-center mb-4">
                            <Heading level="2" size="medium">Resultater</Heading>
                            <Button
                                size="small"
                                variant="secondary"
                                icon={copySuccess ? <Check size={16} /> : <Share2 size={16} />}
                                onClick={copyShareLink}
                            >
                                {copySuccess ? 'Kopiert!' : 'Del analyse'}
                            </Button>
                        </div>
                        <Tabs value={activeTab} onChange={setActiveTab}>
                            <Tabs.List>
                                <Tabs.Tab value="visits" label="Besøk over tid" />
                                <Tabs.Tab value="internal" label="Intern trafikk" />
                                <Tabs.Tab value="external" label="Eksterne trafikkilder" />
                            </Tabs.List>

                            <Tabs.Panel value="visits" className="pt-4">
                                <TrafficStats data={seriesData} metricType={submittedMetricType} />
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
                                                        key={`${submittedMetricType}-${period}-${urlPath}-${seriesData.length}`}
                                                        data={chartData.data}
                                                        legendsOverflowText={'Overflow Items'}
                                                        yAxisTickFormat={(d: any) => submittedMetricType === 'proportion' ? `${d.toFixed(1)}%` : d.toLocaleString('nb-NO')}
                                                        yAxisTickCount={6}
                                                        yMaxValue={chartData.yMax}
                                                        yMinValue={chartData.yMin}
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
                                    <div className="border rounded-lg overflow-x-auto">
                                        <Table size="small">
                                            <Table.Header>
                                                <Table.Row>
                                                    <Table.HeaderCell>Dato</Table.HeaderCell>
                                                    <Table.HeaderCell align="right">
                                                        {submittedMetricType === 'pageviews' ? 'Antall sidevisninger' : (submittedMetricType === 'proportion' ? 'Andel' : 'Antall besøkende')}
                                                    </Table.HeaderCell>
                                                </Table.Row>
                                            </Table.Header>
                                            <Table.Body>
                                                {seriesData.map((item, index) => (
                                                    <Table.Row key={index}>
                                                        <Table.DataCell>
                                                            {new Date(item.time).toLocaleDateString('nb-NO')}
                                                        </Table.DataCell>
                                                        <Table.DataCell align="right">
                                                            {submittedMetricType === 'proportion' ? `${(item.count * 100).toFixed(1)}%` : item.count.toLocaleString('nb-NO')}
                                                        </Table.DataCell>
                                                    </Table.Row>
                                                ))}
                                            </Table.Body>
                                        </Table>
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
                                    <TrafficTable title="Sti" data={internalPaths} />
                                    <TrafficTable title="Innganger" data={entrances} />
                                    <TrafficTable title="Utganger" data={exits} />
                                    {flowQueryStats && (
                                        <div className="text-sm text-gray-600 text-right">
                                            Data prosessert: {flowQueryStats.totalBytesProcessedGB} GB
                                        </div>
                                    )}
                                </div>
                            </Tabs.Panel>

                            <Tabs.Panel value="external" className="pt-4">
                                <div className="flex flex-col gap-8">
                                    <TrafficTable title="Kanaler" data={channels} />
                                    <TrafficTable title="Trafikkilder" data={referrers} />
                                    {flowQueryStats && (
                                        <div className="text-sm text-gray-600 text-right">
                                            Data prosessert: {flowQueryStats.totalBytesProcessedGB} GB
                                        </div>
                                    )}
                                </div>
                            </Tabs.Panel>
                        </Tabs>
                    </>
                )
            }
        </ChartLayout >
    );
};

export default TrafficAnalysis;

import { useState, useMemo, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Button, Alert, Loader, Tabs, TextField, Switch, Table, Heading, Pagination, VStack, Select, Label, Modal, DatePicker, HelpText } from '@navikt/ds-react';
import { LineChart, ILineChartDataPoint, ResponsiveContainer } from '@fluentui/react-charting';
import { Download, Share2, Check, ExternalLink, ArrowRight } from 'lucide-react';
import { format, parseISO, startOfWeek, startOfMonth, isValid } from 'date-fns';
import { nb } from 'date-fns/locale';
import ChartLayout from '../../components/analysis/ChartLayout';
import WebsitePicker from '../../components/analysis/WebsitePicker';
import TrafficStats from '../../components/analysis/traffic/TrafficStats';
import AnalysisActionModal from '../../components/analysis/AnalysisActionModal';
import UrlPathFilter from '../../components/analysis/UrlPathFilter';
import { Website } from '../../types/chart';
import { normalizeUrlToPath } from '../../lib/utils';


const TrafficAnalysis = () => {
    const [selectedWebsite, setSelectedWebsite] = useState<Website | null>(null);
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();

    // Initialize state from URL params - support multiple paths
    const pathsFromUrl = searchParams.getAll('urlPath');
    const initialPaths = pathsFromUrl.length > 0 ? pathsFromUrl.map(p => normalizeUrlToPath(p)).filter(Boolean) : [];
    const [urlPaths, setUrlPaths] = useState<string[]>(initialPaths);
    const [pathOperator, setPathOperator] = useState<string>(() => searchParams.get('pathOperator') || 'equals');
    const [period, setPeriod] = useState<string>(() => searchParams.get('period') || 'current_month');


    // Support custom dates from URL
    const fromDateFromUrl = searchParams.get("from");
    const toDateFromUrl = searchParams.get("to");
    const initialCustomStartDate = fromDateFromUrl ? parseISO(fromDateFromUrl) : undefined;
    const initialCustomEndDate = toDateFromUrl ? parseISO(toDateFromUrl) : undefined;

    const [customStartDate, setCustomStartDate] = useState<Date | undefined>(initialCustomStartDate);
    const [customEndDate, setCustomEndDate] = useState<Date | undefined>(initialCustomEndDate);
    const [isDateModalOpen, setIsDateModalOpen] = useState(false);
    const dateModalRef = useRef<HTMLDialogElement>(null);

    const [granularity, setGranularity] = useState<'day' | 'week' | 'month'>('day');

    // Tab states
    const [activeTab, setActiveTab] = useState<string>('visits');

    // View options
    const [metricType, setMetricType] = useState<string>(() => searchParams.get('metricType') || 'visitors'); // 'visitors', 'sessions', 'pageviews'
    const [submittedMetricType, setSubmittedMetricType] = useState<string>('visitors'); // Track what was actually submitted
    const [showAverage, setShowAverage] = useState<boolean>(false);
    const [showTable, setShowTable] = useState<boolean>(false);

    // Data states
    const [seriesData, setSeriesData] = useState<any[]>([]);
    const [pageMetrics, setPageMetrics] = useState<any[]>([]);
    const [seriesQueryStats, setSeriesQueryStats] = useState<any>(null);

    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [hasAttemptedFetch, setHasAttemptedFetch] = useState<boolean>(false);
    const [copySuccess, setCopySuccess] = useState<boolean>(false);
    const [selectedInternalUrl, setSelectedInternalUrl] = useState<string | null>(null);

    const includedPagesData = useMemo(() => {
        if (!pageMetrics.length) return [];
        return pageMetrics.map(item => ({
            name: item.urlPath,
            count: submittedMetricType === 'pageviews' ? item.pageviews : (submittedMetricType === 'proportion' ? item.proportion : item.visitors)
        }));
    }, [pageMetrics, submittedMetricType]);

    // Calculate total from page metrics (actual unique count)
    const pageMetricsTotal = useMemo(() => {
        if (!pageMetrics.length) return undefined;
        return pageMetrics.reduce((sum, item) => {
            const value = submittedMetricType === 'pageviews' ? item.pageviews : item.visitors;
            return sum + (value || 0);
        }, 0);
    }, [pageMetrics, submittedMetricType]);


    const [breakdownData, setBreakdownData] = useState<{ sources: any[], exits: any[] }>({ sources: [], exits: [] });
    const [externalReferrerData, setExternalReferrerData] = useState<any[]>([]); // Data from marketing-stats API

    // Auto-submit when website is selected (from localStorage, URL, or Home page picker)
    useEffect(() => {
        if (selectedWebsite && !hasAttemptedFetch) {
            fetchSeriesData();
        }
    }, [selectedWebsite]); // Only run when selectedWebsite changes

    // Auto-fetch when filters change (after initial fetch) - Removed manual fetch enforcement
    // No useEffect here for auto-fetch to save costs as per user request

    const fetchSeriesData = async () => {
        if (!selectedWebsite) return;

        // Validation for proportion view
        if (metricType === 'proportion' && urlPaths.length === 0) {
            setError('Du må oppgi en URL-sti for å se andel.');
            return;
        }

        setLoading(true);
        setError(null);
        setSeriesData([]);
        setPageMetrics([]);
        setBreakdownData({ sources: [], exits: [] });
        setExternalReferrerData([]);
        setHasAttemptedFetch(true);
        setSubmittedMetricType(metricType);

        // Calculate date range based on period
        const now = new Date();
        let startDate: Date;
        let endDate: Date;

        if (period === 'current_month') {
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
            startDate = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));
            endDate = now;
        }

        try {
            // Fetch Series Data - use first path if multiple
            const urlPath = urlPaths.length > 0 ? urlPaths[0] : '';
            const seriesResponse = await fetch(`/api/bigquery/websites/${selectedWebsite.id}/traffic-series?startAt=${startDate.getTime()}&endAt=${endDate.getTime()}&urlPath=${encodeURIComponent(urlPath)}&pathOperator=${pathOperator}&metricType=${metricType}`);
            if (!seriesResponse.ok) throw new Error('Kunne ikke hente trafikkdata');
            const seriesResult = await seriesResponse.json();

            if (seriesResult.data) {
                console.log('[TrafficAnalysis] Received series data:', seriesResult.data.length, 'records');
                setSeriesData(seriesResult.data);
            }
            if (seriesResult.queryStats) {
                setSeriesQueryStats(seriesResult.queryStats);
            }

            // Fetch Breakdown Data, Page Metrics, and External Referrers in parallel
            await Promise.all([
                fetchTrafficBreakdown(startDate, endDate),
                fetchPageMetrics(startDate, endDate),
                fetchExternalReferrers(startDate, endDate)
            ]);

            // Update URL with configuration for sharing
            const newParams = new URLSearchParams(window.location.search);
            newParams.set('period', period);
            newParams.set('metricType', metricType);
            // Handle multiple paths in URL
            newParams.delete('urlPath');
            if (urlPaths.length > 0) {
                urlPaths.forEach(p => newParams.append('urlPath', p));
                newParams.set('pathOperator', pathOperator);
            } else {
                newParams.delete('pathOperator');
            }

            if (period === 'custom' && customStartDate && customEndDate) {
                newParams.set('from', format(customStartDate, 'yyyy-MM-dd'));
                newParams.set('to', format(customEndDate, 'yyyy-MM-dd'));
            } else {
                newParams.delete('from');
                newParams.delete('to');
            }

            window.history.replaceState({}, '', `${window.location.pathname}?${newParams.toString()}`);

        } catch (err: any) {
            console.error('Error fetching traffic data:', err);
            setError(err.message || 'Det oppstod en feil ved henting av data.');
        } finally {
            setLoading(false);
        }
    };

    const fetchTrafficBreakdown = async (startDate: Date, endDate: Date) => {
        if (!selectedWebsite) return;

        try {
            const urlPath = urlPaths.length > 0 ? urlPaths[0] : '';
            const normalizedPath = urlPath !== '/' && urlPath.endsWith('/') ? urlPath.slice(0, -1) : urlPath;
            const breakdownUrl = `/api/bigquery/websites/${selectedWebsite.id}/traffic-breakdown?startAt=${startDate.getTime()}&endAt=${endDate.getTime()}&limit=1000${normalizedPath ? `&urlPath=${encodeURIComponent(normalizedPath)}` : ''}&pathOperator=${pathOperator}&metricType=${metricType}`;

            const response = await fetch(breakdownUrl);
            if (!response.ok) throw new Error('Kunne ikke hente trafikkdetaljer');
            const result = await response.json();

            if (result.sources || result.exits) {
                setBreakdownData({
                    sources: result.sources || [],
                    exits: result.exits || []
                });
            }
        } catch (err: any) {
            console.error('Error fetching traffic breakdown:', err);
        }
    };


    const fetchPageMetrics = async (startDate: Date, endDate: Date) => {
        if (!selectedWebsite) return;

        try {
            const urlPath = urlPaths.length > 0 ? urlPaths[0] : '';
            const normalizedPath = urlPath !== '/' && urlPath.endsWith('/') ? urlPath.slice(0, -1) : urlPath;
            const metricsUrl = `/api/bigquery/websites/${selectedWebsite.id}/page-metrics?startAt=${startDate.getTime()}&endAt=${endDate.getTime()}&limit=1000${normalizedPath ? `&urlPath=${encodeURIComponent(normalizedPath)}` : ''}&pathOperator=${pathOperator}&metricType=${metricType}`;

            const response = await fetch(metricsUrl);
            if (!response.ok) throw new Error('Kunne ikke hente sidemetrikker');
            const result = await response.json();

            if (result.data) {
                setPageMetrics(result.data);
            }
        } catch (err: any) {
            console.error('Error fetching page metrics:', err);
        }
    };

    // Fetch external referrer data from marketing-stats API (same as MarketingAnalysis)
    const fetchExternalReferrers = async (startDate: Date, endDate: Date) => {
        if (!selectedWebsite) return;

        try {
            const urlPath = urlPaths.length > 0 ? urlPaths[0] : '';
            const normalizedPath = urlPath !== '/' && urlPath.endsWith('/') ? urlPath.slice(0, -1) : urlPath;
            const url = `/api/bigquery/websites/${selectedWebsite.id}/marketing-stats?startAt=${startDate.getTime()}&endAt=${endDate.getTime()}&limit=100${normalizedPath ? `&urlPath=${encodeURIComponent(normalizedPath)}` : ''}&pathOperator=${pathOperator}&metricType=${metricType}`;

            const response = await fetch(url);
            if (!response.ok) throw new Error('Kunne ikke hente eksterne trafikkilder');
            const result = await response.json();

            if (result.data && result.data.referrer) {
                setExternalReferrerData(result.data.referrer);
            }
        } catch (err: any) {
            console.error('Error fetching external referrers:', err);
        }
    };

    // Prepare Chart Data
    const chartData = useMemo(() => {
        if (!seriesData.length) return null;

        let processedData = seriesData;

        // Apply aggregation if granularity is not 'day'
        if (granularity !== 'day') {
            const aggregated = new Map<string, { time: Date, value: number, count: number }>();

            seriesData.forEach((item: any) => {
                const date = new Date(item.time);
                if (!isValid(date)) return;

                let key = '';
                let displayTime = date;

                if (granularity === 'week') {
                    displayTime = startOfWeek(date, { weekStartsOn: 1 });
                    key = format(displayTime, 'yyyy-MM-dd');
                } else { // month
                    displayTime = startOfMonth(date);
                    key = format(displayTime, 'yyyy-MM');
                }

                if (!aggregated.has(key)) {
                    aggregated.set(key, { time: displayTime, value: 0, count: 0 });
                }
                const entry = aggregated.get(key)!;
                entry.value += Number(item.count) || 0;
                entry.count += 1;
            });

            processedData = Array.from(aggregated.values())
                .sort((a, b) => a.time.getTime() - b.time.getTime())
                .map(entry => ({
                    time: entry.time.toISOString(),
                    count: submittedMetricType === 'proportion' ? entry.value / entry.count : entry.value // Average for proportion, Sum for others
                }));
        }

        const metricLabel = submittedMetricType === 'pageviews' ? 'sidevisninger' : (submittedMetricType === 'proportion' ? 'andel' : 'besøkende');
        const metricLabelCapitalized = submittedMetricType === 'pageviews' ? 'Sidevisninger' : (submittedMetricType === 'proportion' ? 'Andel' : 'Besøkende');

        const points: ILineChartDataPoint[] = processedData.map((item: any) => {
            let val = Number(item.count) || 0; // Ensure it's a number, default to 0

            if (submittedMetricType === 'proportion') {
                // Sanitize proportion data to prevent massive axis scaling
                if (val > 1.01) val = 0; // Allow slight precision error (1.01 = 101%), typically user bug
                if (val < 0) val = 0;
            }

            let xAxisLabel = '';
            if (granularity === 'week') {
                xAxisLabel = `Uke ${format(new Date(item.time), 'w', { locale: nb })}`;
            } else if (granularity === 'month') {
                xAxisLabel = format(new Date(item.time), 'MMM yyyy', { locale: nb });
            } else {
                xAxisLabel = new Date(item.time).toLocaleDateString('nb-NO');
            }

            return {
                x: new Date(item.time),
                y: submittedMetricType === 'proportion' ? Math.min(val * 100, 100) : val, // Hard cap visual at 100%
                legend: xAxisLabel,
                xAxisCalloutData: xAxisLabel,
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
    }, [seriesData, showAverage, submittedMetricType, granularity]);

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

    // Process Flow/Breakdown Data for Internal Tables (entrances/exits only)
    const { entrances, exits } = useMemo(() => {
        if (!breakdownData.sources.length && !breakdownData.exits.length) {
            return { entrances: [], exits: [] };
        }

        const sources = breakdownData.sources.map(s => ({
            name: s.name,
            count: Number(s.visitors)
        }));

        const exitsList = breakdownData.exits.map(e => ({
            name: e.name,
            count: Number(e.visitors)
        })).sort((a, b) => b.count - a.count);

        // Filter Sources for internal entrances only, excluding the current URL path(s) being analyzed
        const entrancesList = sources
            .filter(s => s.name.startsWith('/') && !urlPaths.some(path => {
                const normalizedPath = path !== '/' && path.endsWith('/') ? path.slice(0, -1) : path;
                const normalizedName = s.name !== '/' && s.name.endsWith('/') ? s.name.slice(0, -1) : s.name;
                return normalizedName === normalizedPath;
            }))
            .sort((a, b) => b.count - a.count);

        return { entrances: entrancesList, exits: exitsList };
    }, [breakdownData, urlPaths]);

    // Simple table component for external traffic - similar to AnalysisTable in MarketingAnalysis
    const ExternalTrafficTable = ({ title, data, metricLabel, websiteDomain }: { title: string; data: { name: string; count: number }[]; metricLabel: string; websiteDomain?: string }) => {
        const [search, setSearch] = useState('');
        const [page, setPage] = useState(1);
        const rowsPerPage = 20;

        const filteredData = data.filter(row =>
            row.name.toLowerCase().includes(search.toLowerCase())
        );

        useEffect(() => {
            setPage(1);
        }, [search]);

        const paginatedData = filteredData.slice((page - 1) * rowsPerPage, page * rowsPerPage);
        const totalPages = Math.ceil(filteredData.length / rowsPerPage);

        const renderName = (name: string) => {
            if (name === '(none)' || name === 'Direkte / Annet') {
                return (
                    <div className="flex items-center gap-2 max-w-full">
                        <span className="truncate">Direkte / Ingen</span>
                        <HelpText title="Hva betyr dette?" strategy="fixed">
                            Besøk hvor det ikke er registrert noen henvisningskilde. Dette er ofte brukere som skriver inn nettadressen direkte, bruker bokmerker, eller kommer fra apper (som e-post eller Teams) som ikke sender data om hvor trafikken kommer fra.
                        </HelpText>
                    </div>
                );
            }
            // Check if this is the website's own domain (internal traffic)
            // Compare without www prefix to handle both cases
            const normalizedName = name.toLowerCase().replace(/^www\./, '');
            const normalizedDomain = websiteDomain?.toLowerCase().replace(/^www\./, '');
            if (normalizedDomain && normalizedName === normalizedDomain) {
                return (
                    <div className="flex items-center gap-2 max-w-full">
                        <span className="truncate">{name} (interntrafikk)</span>
                        <HelpText title="Hva betyr dette?" strategy="fixed">
                            Besøkende som kom fra andre sider på samme nettsted. For eksempel brukere som klikket på en lenke fra forsiden eller en annen underside.
                        </HelpText>
                    </div>
                );
            }
            return <div className="truncate">{name}</div>;
        };

        return (
            <VStack gap="space-4">
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
                                <Table.HeaderCell align="right">{metricLabel}</Table.HeaderCell>
                                <Table.HeaderCell>Navn</Table.HeaderCell>
                            </Table.Row>
                        </Table.Header>
                        <Table.Body>
                            {paginatedData.map((row, i) => (
                                <Table.Row key={i}>
                                    <Table.DataCell align="right">{row.count.toLocaleString('nb-NO')}</Table.DataCell>
                                    <Table.DataCell className="max-w-md" title={row.name}>
                                        {renderName(row.name)}
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

    // Use external referrer data from marketing-stats API (same as MarketingAnalysis)
    const externalReferrers = useMemo(() => {
        return externalReferrerData
            .filter(item => item.name !== '(none)') // Filter out direct traffic
            .map(item => ({ name: item.name, count: item.count }));
    }, [externalReferrerData]);

    const externalChannels = useMemo(() => {
        const channelMap = new Map<string, number>();
        externalReferrerData.forEach(item => {
            let channel = 'Andre nettsider';
            const source = item.name.toLowerCase();

            if (source === '(none)') channel = 'Direkte';
            else if (source.includes('google') || source.includes('bing') || source.includes('yahoo') || source.includes('duckduckgo') || source.includes('ecosia') || source.includes('qwant')) channel = 'Søkemotorer';
            else if (source.includes('facebook') || source.includes('twitter') || source.includes('linkedin') || source.includes('instagram')) channel = 'Sosiale medier';

            channelMap.set(channel, (channelMap.get(channel) || 0) + item.count);
        });

        return Array.from(channelMap.entries())
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count);
    }, [externalReferrerData]);

    const TrafficTable = ({ title, data, onRowClick, selectedWebsite, metricLabel }: { title: string; data: { name: string; count: number }[]; onRowClick?: (name: string) => void; selectedWebsite: Website | null; metricLabel: string }) => {
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

        const isClickableRow = (name: string) => name.startsWith('/') && onRowClick;

        const renderName = (name: string) => {
            if (name === '(none)') {
                return (
                    <div className="flex items-center gap-2 max-w-full">
                        <span className="truncate">Direkte / Ingen</span>
                        <HelpText title="Hva betyr dette?" strategy="fixed">
                            Besøk hvor det ikke er registrert noen henvisningskilde. Dette er ofte brukere som skriver inn nettadressen direkte, bruker bokmerker, eller kommer fra apper (som e-post eller Teams) som ikke sender data om hvor trafikken kommer fra.
                        </HelpText>
                    </div>
                );
            }

            if (name === '(exit)' || name === 'Exit') {
                return (
                    <div className="flex items-center gap-2 max-w-full">
                        <span className="truncate">Forlot nettstedet</span>
                        <HelpText title="Hva betyr dette?" strategy="fixed">
                            Vi kan ikke se om de klikket på en ekstern lenke, lukket fanen/nettleseren.
                        </HelpText>
                    </div>
                );
            }

            if (name === '(not set)') {
                return "Ikke satt (not set)";
            }

            if (name === '/') {
                return "/ (forside)";
            }

            if (selectedWebsite && name === selectedWebsite.domain) {
                return (
                    <div className="flex items-center gap-2 max-w-full">
                        <span className="truncate">Interntrafikk ({name})</span>
                        <HelpText title="Hva betyr dette?" strategy="fixed">
                            Trafikk som ser ut til å komme fra samme domene. Dette skjer ofte ved omdirigeringer, eller hvis sporingskoden mistet sesjonsdata mellom to sidevisninger.
                        </HelpText>
                    </div>
                );
            }

            return <div className="truncate">{name}</div>;
        };


        return (
            <VStack gap="space-4">
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
                                <Table.HeaderCell align="right">
                                    {metricLabel}
                                </Table.HeaderCell>
                                <Table.HeaderCell>URL-sti</Table.HeaderCell>
                            </Table.Row>
                        </Table.Header>
                        <Table.Body>
                            {paginatedData.map((row, i) => (
                                <Table.Row
                                    key={i}
                                    className={isClickableRow(row.name) ? 'cursor-pointer hover:bg-[var(--ax-bg-neutral-soft)]' : ''}
                                    onClick={() => isClickableRow(row.name) && onRowClick?.(row.name)}
                                >
                                    <Table.DataCell align="right">
                                        {row.count.toLocaleString('nb-NO')}
                                    </Table.DataCell>
                                    <Table.DataCell className="max-w-md" title={row.name}>
                                        {isClickableRow(row.name) ? (
                                            <span className="flex items-center gap-1 max-w-full">
                                                <span
                                                    className="truncate text-blue-600 hover:underline cursor-pointer"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onRowClick?.(row.name);
                                                    }}
                                                >
                                                    {row.name === '/' ? '/ (forside)' : row.name}
                                                </span>
                                                <ExternalLink className="h-3 w-3 shrink-0 text-blue-600" />
                                            </span>
                                        ) : (
                                            renderName(row.name)
                                        )}
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
            websiteDomain={selectedWebsite?.domain}
            sidebarContent={
                <WebsitePicker
                    selectedWebsite={selectedWebsite}
                    onWebsiteChange={setSelectedWebsite}
                />
            }
            filters={
                <>
                    <UrlPathFilter
                        urlPaths={urlPaths}
                        onUrlPathsChange={setUrlPaths}
                        pathOperator={pathOperator}
                        onPathOperatorChange={setPathOperator}
                        selectedWebsiteDomain={selectedWebsite?.domain}
                        className="w-full sm:w-[350px]"
                        placeholder="Skriv og trykk enter"
                    />

                    <div className="w-full sm:w-auto min-w-[200px]">
                        <Select
                            label="Periode"
                            size="small"
                            value={period}
                            onChange={(e) => {
                                const value = e.target.value;
                                if (value === 'custom') {
                                    setIsDateModalOpen(true);
                                } else if (value === 'custom-edit') {
                                    setCustomStartDate(undefined);
                                    setCustomEndDate(undefined);
                                    setIsDateModalOpen(true);
                                } else {
                                    setPeriod(value);
                                }
                            }}
                        >
                            <option value="current_month">Denne måneden</option>
                            <option value="last_month">Forrige måned</option>
                            {period === 'custom' && customStartDate && customEndDate ? (
                                <>
                                    <option value="custom">
                                        {`${format(customStartDate, 'dd.MM.yy')} - ${format(customEndDate, 'dd.MM.yy')} `}
                                    </option>
                                    <option value="custom-edit">Endre datoer</option>
                                </>
                            ) : (
                                <option value="custom">Egendefinert</option>
                            )}
                        </Select>
                    </div>

                    <div className="w-full sm:w-auto min-w-[200px]">
                        <Select
                            label="Visning"
                            size="small"
                            value={metricType}
                            onChange={(e) => setMetricType(e.target.value)}
                        >
                            <option value="visitors">Besøkende</option>
                            <option value="pageviews">Sidevisninger</option>
                            <option value="proportion">Andel (av besøkende)</option>
                        </Select>
                    </div>

                    <div className="flex items-end pb-[2px]">
                        <Button
                            onClick={fetchSeriesData}
                            disabled={!selectedWebsite || loading}
                            loading={loading}
                            size="small"
                        >
                            Vis trafikk
                        </Button>
                    </div>

                    <Modal
                        ref={dateModalRef}
                        open={isDateModalOpen}
                        onClose={() => setIsDateModalOpen(false)}
                        header={{ heading: "Velg datoperiode", closeButton: true }}
                    >
                        <Modal.Body>
                            <div className="flex flex-col gap-4">
                                <DatePicker
                                    mode="range"
                                    selected={{ from: customStartDate, to: customEndDate }}
                                    onSelect={(range) => {
                                        if (range) {
                                            setCustomStartDate(range.from);
                                            setCustomEndDate(range.to);
                                        }
                                    }}
                                >
                                    <div className="flex flex-col gap-2">
                                        <DatePicker.Input
                                            id="custom-start-date"
                                            label="Fra dato"
                                            size="small"
                                            value={customStartDate ? format(customStartDate, 'dd.MM.yyyy') : ''}
                                        />
                                        <DatePicker.Input
                                            id="custom-end-date"
                                            label="Til dato"
                                            size="small"
                                            value={customEndDate ? format(customEndDate, 'dd.MM.yyyy') : ''}
                                        />
                                    </div>
                                </DatePicker>
                            </div>
                        </Modal.Body>
                        <Modal.Footer>
                            <Button
                                onClick={() => {
                                    if (customStartDate && customEndDate) {
                                        setPeriod('custom');
                                        setIsDateModalOpen(false);
                                    }
                                }}
                                disabled={!customStartDate || !customEndDate}
                            >
                                Bruk datoer
                            </Button>
                            <Button variant="secondary" onClick={() => setIsDateModalOpen(false)}>
                                Avbryt
                            </Button>
                        </Modal.Footer>
                    </Modal>
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


                        <Tabs value={activeTab} onChange={setActiveTab}>
                            <Tabs.List>
                                <Tabs.Tab value="visits" label="Trend" />
                                <Tabs.Tab value="sources" label="Trafikkilder" />
                                <Tabs.Tab value="navigation" label="Navigasjon" />
                            </Tabs.List>

                            <Tabs.Panel value="visits" className="pt-4">
                                <TrafficStats data={seriesData} metricType={submittedMetricType} totalOverride={pageMetricsTotal} />
                                <div className="flex flex-col gap-8">
                                    <div className="flex flex-col gap-4">
                                        <div className="flex justify-between items-center mb-2">
                                            <div className="flex items-center gap-4">
                                                <Switch
                                                    checked={showAverage}
                                                    onChange={(e) => setShowAverage(e.target.checked)}
                                                    size="small"
                                                >
                                                    Vis gjennomsnitt
                                                </Switch>
                                                <Switch
                                                    checked={showTable}
                                                    onChange={(e) => setShowTable(e.target.checked)}
                                                    size="small"
                                                >
                                                    Vis tabell
                                                </Switch>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Label size="small" htmlFor="traffic-granularity">Tidsoppløsning</Label>
                                                <Select
                                                    id="traffic-granularity"
                                                    label="Tidsoppløsning"
                                                    hideLabel
                                                    size="small"
                                                    value={granularity}
                                                    onChange={(e) => setGranularity(e.target.value as any)}
                                                >
                                                    <option value="day">Daglig</option>
                                                    <option value="week">Ukentlig</option>
                                                    <option value="month">Månedlig</option>
                                                </Select>
                                            </div>
                                        </div>
                                        <div style={{ width: '100%', height: '400px' }}>
                                            {chartData ? (
                                                <ResponsiveContainer>
                                                    <LineChart
                                                        key={`${submittedMetricType}-${period}-${seriesData.length}`}
                                                        data={chartData.data}
                                                        legendsOverflowText={'Overflow Items'}
                                                        yAxisTickFormat={(d: any) => submittedMetricType === 'proportion' ? `${d.toFixed(1)}%` : d.toLocaleString('nb-NO')}
                                                        yAxisTickCount={6}
                                                        yMaxValue={chartData.yMax}
                                                        yMinValue={chartData.yMin}
                                                        allowMultipleShapesForPoints={false}
                                                        enablePerfOptimization={true}
                                                        margins={{ left: 50, right: 40, top: 20, bottom: 35 }}
                                                        legendProps={{
                                                            allowFocusOnLegends: true,
                                                            styles: {
                                                                text: { color: 'var(--ax-text-default)' },
                                                            }
                                                        }}
                                                    />
                                                </ResponsiveContainer>
                                            ) : (
                                                <div className="flex items-center justify-center h-full text-gray-500">
                                                    Ingen data tilgjengelig for diagram
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex flex-col md:flex-row gap-8 mt-8">
                                        {/* Table */}
                                        {showTable && (
                                            <div className="border rounded-lg overflow-x-auto w-full md:w-1/2">
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
                                                <div className="flex gap-2 p-3 bg-[var(--ax-bg-neutral-soft)] border-t justify-between items-center">
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
                                                        <span className="text-sm text-[var(--ax-text-subtle)]">
                                                            Data prosessert: {seriesQueryStats.totalBytesProcessedGB} GB
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                        {/* Pages Table - Always visible context */}
                                        <div className={`w-full ${showTable ? 'md:w-1/2' : 'md:w-1/2'}`}>
                                            <TrafficTable
                                                title="Inkluderte sider"
                                                data={includedPagesData}
                                                onRowClick={setSelectedInternalUrl}
                                                selectedWebsite={selectedWebsite}
                                                metricLabel={submittedMetricType === 'pageviews' ? 'Sidevisninger' : (submittedMetricType === 'proportion' ? 'Andel' : 'Besøkende')}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </Tabs.Panel>

                            <Tabs.Panel value="sources" className="pt-4">
                                <div className="flex flex-col gap-8">
                                    <div className="w-full md:w-1/2">
                                        <ExternalTrafficTable
                                            title="Kanaler"
                                            data={externalChannels}
                                            metricLabel={submittedMetricType === 'pageviews' ? 'Sidevisninger' : 'Besøkende'}
                                        />
                                    </div>
                                    <div className="flex flex-col md:flex-row gap-8">
                                        <div className="w-full md:w-1/2">
                                            <ExternalTrafficTable
                                                title="Eksterne kilder"
                                                data={externalReferrers}
                                                metricLabel={submittedMetricType === 'pageviews' ? 'Sidevisninger' : 'Besøkende'}
                                                websiteDomain={selectedWebsite?.domain}
                                            />
                                        </div>
                                        <div className="w-full md:w-1/2">
                                            <TrafficTable title="Interne innganger" data={entrances} onRowClick={setSelectedInternalUrl} selectedWebsite={selectedWebsite} metricLabel={submittedMetricType === 'pageviews' ? 'Sidevisninger' : (submittedMetricType === 'proportion' ? 'Andel' : 'Besøkende')} />
                                        </div>
                                    </div>
                                </div>
                            </Tabs.Panel>

                            <Tabs.Panel value="navigation" className="pt-4">
                                <div className="flex flex-col md:flex-row gap-8">
                                    <div className="w-full md:w-1/2">
                                        <TrafficTable title="Utganger" data={exits} onRowClick={setSelectedInternalUrl} selectedWebsite={selectedWebsite} metricLabel={submittedMetricType === 'pageviews' ? 'Sidevisninger' : (submittedMetricType === 'proportion' ? 'Andel' : 'Besøkende')} />
                                    </div>
                                    <div className="w-full md:w-1/2">
                                        <div className="border border-[var(--ax-border-neutral-subtle)] rounded-lg p-6 bg-[var(--ax-bg-neutral-soft)]">
                                            <Heading level="3" size="small" className="mb-2">Se vanlige veier gjennom nettstedet</Heading>
                                            <p className="text-[var(--ax-text-subtle)] mb-4">
                                                Navigasjonsflyt viser hvordan brukerne navigerer mellom flere sider i samme besøk.
                                            </p>
                                            <Button
                                                variant="secondary"
                                                size="small"
                                                icon={<ArrowRight size={16} />}
                                                iconPosition="right"
                                                onClick={() => {
                                                    const params = new URLSearchParams();
                                                    if (selectedWebsite?.id) params.set('websiteId', selectedWebsite.id);
                                                    if (period) params.set('period', period);
                                                    if (urlPaths.length > 0) params.set('urlPath', urlPaths[0]);
                                                    navigate(`/brukerreiser?${params.toString()}`);
                                                }}
                                                disabled={!selectedWebsite}
                                            >
                                                Gå til navigasjonsflyt
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </Tabs.Panel>
                        </Tabs>

                        <AnalysisActionModal
                            open={!!selectedInternalUrl}
                            onClose={() => setSelectedInternalUrl(null)}
                            urlPath={selectedInternalUrl}
                            websiteId={selectedWebsite?.id}
                            period={period}
                        />

                        <div className="flex justify-end mt-8">
                            <Button
                                size="small"
                                variant="secondary"
                                icon={copySuccess ? <Check size={16} /> : <Share2 size={16} />}
                                onClick={copyShareLink}
                            >
                                {copySuccess ? 'Kopiert!' : 'Del analyse'}
                            </Button>
                        </div>
                    </>
                )
            }
        </ChartLayout >
    );
};

export default TrafficAnalysis;

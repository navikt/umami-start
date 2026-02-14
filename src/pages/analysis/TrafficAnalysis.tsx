import { useState, useMemo, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Button, Alert, Loader, Tabs, TextField, Switch, Table, Heading, Pagination, VStack, Select, Label, HelpText } from '@navikt/ds-react';
import { LineChart, ILineChartDataPoint, ResponsiveContainer } from '@fluentui/react-charting';
import { Download, Share2, Check, ExternalLink, ArrowRight } from 'lucide-react';
import { format, parseISO, startOfWeek, startOfMonth, isValid } from 'date-fns';
import { nb } from 'date-fns/locale';
import ChartLayout from '../../components/analysis/ChartLayout';
import WebsitePicker from '../../components/analysis/WebsitePicker';
import TrafficStats from '../../components/analysis/traffic/TrafficStats';
import AnalysisActionModal from '../../components/analysis/AnalysisActionModal';
import UrlPathFilter from '../../components/analysis/UrlPathFilter';
import PeriodPicker from '../../components/analysis/PeriodPicker';
import CookieMixNotice from '../../components/analysis/CookieMixNotice';
import { useCookieSupport, useCookieStartDate } from '../../hooks/useSiteimproveSupport';
import { Website } from '../../types/chart';
import { normalizeUrlToPath, getDateRangeFromPeriod, getStoredPeriod, savePeriodPreference, getStoredMetricType, saveMetricTypePreference, getCookieCountByParams, getCookieBadge, getVisitorLabelWithBadge } from '../../lib/utils';

// Helper functions for metric labels
const getMetricLabelCapitalized = (type: string): string => {
    switch (type) {
        case 'pageviews': return 'Sidevisninger';
        case 'proportion': return 'Andel';
        case 'visits': return 'Økter';
        default: return 'Besøkende';
    }
};

const getMetricLabelWithCount = (type: string): string => {
    switch (type) {
        case 'pageviews': return 'Antall sidevisninger';
        case 'proportion': return 'Andel';
        case 'visits': return 'Antall økter';
        default: return 'Antall unike besøkende';
    }
};

const TrafficAnalysis = () => {
    const [selectedWebsite, setSelectedWebsite] = useState<Website | null>(null);
    const usesCookies = useCookieSupport(selectedWebsite?.domain);
    const cookieStartDate = useCookieStartDate(selectedWebsite?.domain);
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();

    // Initialize state from URL params - support multiple paths
    const pathsFromUrl = searchParams.getAll('urlPath');
    const initialPaths = pathsFromUrl.length > 0 ? pathsFromUrl.map(p => normalizeUrlToPath(p)).filter(Boolean) : [];
    const [urlPaths, setUrlPaths] = useState<string[]>(initialPaths);
    const [pathOperator, setPathOperator] = useState<string>(() => searchParams.get('pathOperator') || 'equals');
    const [period, setPeriodState] = useState<string>(() => getStoredPeriod(searchParams.get('period')));

    // Wrap setPeriod to also save to localStorage
    const setPeriod = (newPeriod: string) => {
        setPeriodState(newPeriod);
        savePeriodPreference(newPeriod);
    };

    // Track submitted period to prevent chart flashing on selection change
    const [submittedPeriod, setSubmittedPeriod] = useState<string>(() => getStoredPeriod(searchParams.get('period')));


    // Support custom dates from URL
    const fromDateFromUrl = searchParams.get("from");
    const toDateFromUrl = searchParams.get("to");
    const initialCustomStartDate = fromDateFromUrl ? parseISO(fromDateFromUrl) : undefined;
    const initialCustomEndDate = toDateFromUrl ? parseISO(toDateFromUrl) : undefined;

    const [customStartDate, setCustomStartDate] = useState<Date | undefined>(initialCustomStartDate);
    const [customEndDate, setCustomEndDate] = useState<Date | undefined>(initialCustomEndDate);
    const [submittedCustomStartDate, setSubmittedCustomStartDate] = useState<Date | undefined>(initialCustomStartDate);
    const [submittedCustomEndDate, setSubmittedCustomEndDate] = useState<Date | undefined>(initialCustomEndDate);

    const [granularity, setGranularity] = useState<'day' | 'week' | 'month' | 'hour'>('day');
    const [submittedGranularity, setSubmittedGranularity] = useState<'day' | 'week' | 'month' | 'hour'>('day');

    // Tab states
    const [activeTab, setActiveTab] = useState<string>('visits');

    // View options
    const [metricType, setMetricTypeState] = useState<string>(() => getStoredMetricType(searchParams.get('metricType')));
    const [submittedMetricType, setSubmittedMetricType] = useState<string>(() => getStoredMetricType(searchParams.get('metricType'))); // Track what was actually submitted
    const [submittedUrlPaths, setSubmittedUrlPaths] = useState<string[]>(initialPaths);
    const [submittedPathOperator, setSubmittedPathOperator] = useState<string>(() => searchParams.get('pathOperator') || 'equals');

    // Wrap setMetricType to also save to localStorage
    const setMetricType = (newMetricType: string) => {
        setMetricTypeState(newMetricType);
        saveMetricTypePreference(newMetricType);
    };
    const [showAverage, setShowAverage] = useState<boolean>(false);


    // Data states
    const [seriesData, setSeriesData] = useState<any[]>([]);
    const [seriesTotalCount, setSeriesTotalCount] = useState<number | undefined>(undefined);
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

    // Override totals for metrics that cannot be summed across time buckets.
    const totalOverride = useMemo(() => {
        if (submittedMetricType === 'visits' || submittedMetricType === 'visitors') {
            return seriesTotalCount;
        }
        return undefined;
    }, [submittedMetricType, seriesTotalCount]);


    const [breakdownData, setBreakdownData] = useState<{ sources: any[], exits: any[] }>({ sources: [], exits: [] });
    const [externalReferrerData, setExternalReferrerData] = useState<any[]>([]); // Data from marketing-stats API
    const [hasFetchedPageMetrics, setHasFetchedPageMetrics] = useState<boolean>(false);
    const [hasFetchedBreakdown, setHasFetchedBreakdown] = useState<boolean>(false);
    const [hasFetchedExternalReferrers, setHasFetchedExternalReferrers] = useState<boolean>(false);
    const [isLoadingPageMetrics, setIsLoadingPageMetrics] = useState<boolean>(false);
    const [isLoadingBreakdown, setIsLoadingBreakdown] = useState<boolean>(false);
    const [isLoadingExternalReferrers, setIsLoadingExternalReferrers] = useState<boolean>(false);

    const getCountByQueryParams = (startDate: Date, endDate: Date) => {
        const { countBy, countBySwitchAt } = getCookieCountByParams(usesCookies, cookieStartDate, startDate, endDate);
        return {
            countByParams: countBy ? `&countBy=${countBy}` : '',
            countBySwitchAtParam: countBySwitchAt ? `&countBySwitchAt=${countBySwitchAt}` : ''
        };
    };

    const currentDateRange = useMemo(() => getDateRangeFromPeriod(period, customStartDate, customEndDate), [period, customStartDate, customEndDate]);
    const cookieBadge = useMemo(() => {
        if (!currentDateRange) return '';
        return getCookieBadge(
            usesCookies,
            cookieStartDate,
            currentDateRange.startDate,
            currentDateRange.endDate
        );
    }, [usesCookies, cookieStartDate, currentDateRange]);
    const isPreCookieRange = useMemo(() => {
        if (!currentDateRange || !cookieStartDate) return false;
        return currentDateRange.endDate.getTime() < cookieStartDate.getTime();
    }, [currentDateRange, cookieStartDate]);

    // Auto-submit when website is selected (from localStorage, URL, or Home page picker)
    useEffect(() => {
        if (selectedWebsite && !hasAttemptedFetch) {
            fetchSeriesData();
        }
    }, [selectedWebsite]); // Only run when selectedWebsite changes

    // Auto-fetch when filters change (after initial fetch) - Removed manual fetch enforcement
    // No useEffect here for auto-fetch to save costs as per user request

    // Auto-fetch when granularity changes (after initial fetch).
    useEffect(() => {
        if (!hasAttemptedFetch || !selectedWebsite || loading) return;
        if (granularity !== submittedGranularity) {
            fetchSeriesData();
        }
    }, [granularity, submittedGranularity, hasAttemptedFetch, selectedWebsite, loading]);

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
        setSeriesTotalCount(undefined);
        setPageMetrics([]);
        setBreakdownData({ sources: [], exits: [] });
        setExternalReferrerData([]);
        setHasFetchedPageMetrics(false);
        setHasFetchedBreakdown(false);
        setHasFetchedExternalReferrers(false);
        setIsLoadingPageMetrics(false);
        setIsLoadingBreakdown(false);
        setIsLoadingExternalReferrers(false);
        setHasAttemptedFetch(true);
        setSubmittedMetricType(metricType);
        setSubmittedUrlPaths(urlPaths);
        setSubmittedPathOperator(pathOperator);
        setSubmittedCustomStartDate(customStartDate);
        setSubmittedCustomEndDate(customEndDate);
        let effectiveGranularity = granularity;

        // Auto-switch to hourly granularity for short periods upon fetch
        if (period === 'today' || period === 'yesterday') {
            effectiveGranularity = 'hour';
            setGranularity('hour'); // Sync UI with the enforced decision
        }

        setSubmittedGranularity(effectiveGranularity);
        setSubmittedPeriod(period);

        // Determine interval - prioritize hour if selected, otherwise let backend default (day) or handle as needed
        // Note: We only request 'hour' explicitly. For week/month, we currently fetch daily data and aggregate in frontend.
        const interval = effectiveGranularity === 'hour' ? 'hour' : 'day';

        // Calculate date range based on period using centralized utility
        const dateRange = getDateRangeFromPeriod(period, customStartDate, customEndDate);
        if (!dateRange) {
            setError('Vennligst velg en gyldig periode.');
            setLoading(false);
            return;
        }
        const { startDate, endDate } = dateRange;
        const { countByParams, countBySwitchAtParam } = getCountByQueryParams(startDate, endDate);

        try {
            // Fetch Series Data - use first path if multiple
            const urlPath = urlPaths.length > 0 ? urlPaths[0] : '';
            const normalizedPath = urlPath !== '/' && urlPath.endsWith('/') ? urlPath.slice(0, -1) : urlPath;

            let seriesUrl = `/api/bigquery/websites/${selectedWebsite.id}/traffic-series?startAt=${startDate.getTime()}&endAt=${endDate.getTime()}&pathOperator=${pathOperator}&metricType=${metricType}&interval=${interval}${countByParams}${countBySwitchAtParam}`;
            if (normalizedPath) {
                seriesUrl += `&urlPath=${encodeURIComponent(normalizedPath)}`;
            }

            const seriesResponse = await fetch(seriesUrl);
            if (!seriesResponse.ok) throw new Error('Kunne ikke hente trafikkdata');
            const seriesResult = await seriesResponse.json();

            if (seriesResult.data) {
                console.log('[TrafficAnalysis] Received series data:', seriesResult.data.length, 'records');
                setSeriesData(seriesResult.data);
            }
            if (typeof seriesResult.totalCount === 'number') {
                setSeriesTotalCount(seriesResult.totalCount);
            }
            if (seriesResult.queryStats) {
                setSeriesQueryStats(seriesResult.queryStats);
            }

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

    const fetchTrafficBreakdown = async (startDate: Date, endDate: Date, options?: { urlPaths?: string[]; pathOperator?: string; metricType?: string }) => {
        if (!selectedWebsite) return;

        try {
            setIsLoadingBreakdown(true);
            const activeUrlPaths = options?.urlPaths ?? submittedUrlPaths;
            const activePathOperator = options?.pathOperator ?? submittedPathOperator;
            const activeMetricType = options?.metricType ?? submittedMetricType;
            const urlPath = activeUrlPaths.length > 0 ? activeUrlPaths[0] : '';
            const normalizedPath = urlPath !== '/' && urlPath.endsWith('/') ? urlPath.slice(0, -1) : urlPath;
            const { countByParams, countBySwitchAtParam } = getCountByQueryParams(startDate, endDate);
            const breakdownUrl = `/api/bigquery/websites/${selectedWebsite.id}/traffic-breakdown?startAt=${startDate.getTime()}&endAt=${endDate.getTime()}&limit=1000${normalizedPath ? `&urlPath=${encodeURIComponent(normalizedPath)}` : ''}&pathOperator=${activePathOperator}&metricType=${activeMetricType}${countByParams}${countBySwitchAtParam}`;

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
        } finally {
            setHasFetchedBreakdown(true);
            setIsLoadingBreakdown(false);
        }
    };


    const fetchPageMetrics = async (startDate: Date, endDate: Date, options?: { urlPaths?: string[]; pathOperator?: string; metricType?: string }) => {
        if (!selectedWebsite) return;

        try {
            setIsLoadingPageMetrics(true);
            const activeUrlPaths = options?.urlPaths ?? submittedUrlPaths;
            const activePathOperator = options?.pathOperator ?? submittedPathOperator;
            const activeMetricType = options?.metricType ?? submittedMetricType;
            const urlPath = activeUrlPaths.length > 0 ? activeUrlPaths[0] : '';
            const normalizedPath = urlPath !== '/' && urlPath.endsWith('/') ? urlPath.slice(0, -1) : urlPath;
            const { countByParams, countBySwitchAtParam } = getCountByQueryParams(startDate, endDate);
            const metricsUrl = `/api/bigquery/websites/${selectedWebsite.id}/page-metrics?startAt=${startDate.getTime()}&endAt=${endDate.getTime()}&limit=1000${normalizedPath ? `&urlPath=${encodeURIComponent(normalizedPath)}` : ''}&pathOperator=${activePathOperator}&metricType=${activeMetricType}${countByParams}${countBySwitchAtParam}`;

            const response = await fetch(metricsUrl);
            if (!response.ok) throw new Error('Kunne ikke hente sidemetrikker');
            const result = await response.json();

            if (result.data) {
                setPageMetrics(result.data);
            }
        } catch (err: any) {
            console.error('Error fetching page metrics:', err);
        } finally {
            setHasFetchedPageMetrics(true);
            setIsLoadingPageMetrics(false);
        }
    };

    // Fetch external referrer data from marketing-stats API (same as MarketingAnalysis)
    const fetchExternalReferrers = async (startDate: Date, endDate: Date, options?: { urlPaths?: string[]; pathOperator?: string; metricType?: string }) => {
        if (!selectedWebsite) return;

        try {
            setIsLoadingExternalReferrers(true);
            const activeUrlPaths = options?.urlPaths ?? submittedUrlPaths;
            const activePathOperator = options?.pathOperator ?? submittedPathOperator;
            const activeMetricType = options?.metricType ?? submittedMetricType;
            const urlPath = activeUrlPaths.length > 0 ? activeUrlPaths[0] : '';
            const normalizedPath = urlPath !== '/' && urlPath.endsWith('/') ? urlPath.slice(0, -1) : urlPath;
            const { countByParams, countBySwitchAtParam } = getCountByQueryParams(startDate, endDate);
            const url = `/api/bigquery/websites/${selectedWebsite.id}/marketing-stats?startAt=${startDate.getTime()}&endAt=${endDate.getTime()}&limit=100${normalizedPath ? `&urlPath=${encodeURIComponent(normalizedPath)}` : ''}&pathOperator=${activePathOperator}&metricType=${activeMetricType}${countByParams}${countBySwitchAtParam}`;

            const response = await fetch(url);
            if (!response.ok) throw new Error('Kunne ikke hente eksterne trafikkilder');
            const result = await response.json();

            if (result.data && result.data.referrer) {
                setExternalReferrerData(result.data.referrer);
            }
        } catch (err: any) {
            console.error('Error fetching external referrers:', err);
        } finally {
            setHasFetchedExternalReferrers(true);
            setIsLoadingExternalReferrers(false);
        }
    };

    // Lazy-load tab data to avoid unnecessary queries
    useEffect(() => {
        if (!hasAttemptedFetch || !selectedWebsite) return;

        const dateRange = getDateRangeFromPeriod(submittedPeriod, submittedCustomStartDate, submittedCustomEndDate);
        if (!dateRange) return;

        const { startDate, endDate } = dateRange;
        const options = {
            urlPaths: submittedUrlPaths,
            pathOperator: submittedPathOperator,
            metricType: submittedMetricType
        };

        if (activeTab === 'visits') {
            if (!hasFetchedPageMetrics) {
                fetchPageMetrics(startDate, endDate, options);
            }
            return;
        }

        if (activeTab === 'sources') {
            if (!hasFetchedExternalReferrers) {
                fetchExternalReferrers(startDate, endDate, options);
            }
            if (!hasFetchedBreakdown) {
                fetchTrafficBreakdown(startDate, endDate, options);
            }
            return;
        }
    }, [
        activeTab,
        hasAttemptedFetch,
        selectedWebsite,
        submittedPeriod,
        submittedCustomStartDate,
        submittedCustomEndDate,
        submittedMetricType,
        submittedUrlPaths,
        submittedPathOperator,
        hasFetchedPageMetrics,
        hasFetchedExternalReferrers,
        hasFetchedBreakdown
    ]);

    // Prepare Chart Data
    const chartData = useMemo(() => {
        if (!seriesData.length) return null;

        let processedData = seriesData;

        // Apply aggregation if granularity is 'week' or 'month'
        // For 'hour', we use the data as-is (assuming backend returned hourly data)
        if (submittedGranularity === 'week' || submittedGranularity === 'month') {
            const aggregated = new Map<string, { time: Date, value: number, count: number }>();

            seriesData.forEach((item: any) => {
                const date = new Date(item.time);
                if (!isValid(date)) return;

                let key = '';
                let displayTime = date;

                if (submittedGranularity === 'week') {
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

        const getMetricLabel = (type: string) => {
            switch (type) {
                case 'pageviews': return 'sidevisninger';
                case 'proportion': return 'andel';
                case 'visits': return 'økter';
                default: return 'unike besøkende';
            }
        };
        const getMetricLabelCapitalized = (type: string) => {
            switch (type) {
                case 'pageviews': return 'Sidevisninger';
                case 'proportion': return 'Andel';
                case 'visits': return 'Økter';
                default: return 'Unike besøkende';
            }
        };
        const metricLabel = getMetricLabel(submittedMetricType);
        const metricLabelCapitalized = getMetricLabelCapitalized(submittedMetricType);

        const points: ILineChartDataPoint[] = processedData.map((item: any) => {
            let val = Number(item.count) || 0; // Ensure it's a number, default to 0

            if (submittedMetricType === 'proportion') {
                // Sanitize proportion data to prevent massive axis scaling
                if (val > 1.01) val = 0; // Allow slight precision error (1.01 = 101%), typically user bug
                if (val < 0) val = 0;
            }

            let xAxisLabel = '';
            if (submittedGranularity === 'week') {
                xAxisLabel = `Uke ${format(new Date(item.time), 'w', { locale: nb })}`;
            } else if (submittedGranularity === 'month') {
                xAxisLabel = format(new Date(item.time), 'MMM yyyy', { locale: nb });
            } else if (submittedGranularity === 'hour') {
                xAxisLabel = `${format(new Date(item.time), 'HH:mm')}`;
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
                    : `${val.toLocaleString('nb-NO')} ${metricLabel}`
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
                    : `Gjennomsnitt: ${Math.round(avg).toLocaleString('nb-NO')}`
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
    }, [seriesData, showAverage, submittedMetricType, submittedGranularity]);

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

        const getCSVMetricLabel = (type: string) => {
            switch (type) {
                case 'pageviews': return 'Antall sidevisninger';
                case 'proportion': return 'Andel';
                case 'visits': return 'Antall økter';
                default: return 'Antall unike besøkende';
            }
        };
        const metricLabel = getCSVMetricLabel(submittedMetricType);
        const dateHeader = submittedGranularity === 'hour' ? 'Tidspunkt' : 'Dato';
        const headers = [dateHeader, metricLabel];
        const csvRows = [
            headers.join(','),
            ...seriesData.map((item) => {
                const timeStr = submittedGranularity === 'hour'
                    ? `${new Date(item.time).toLocaleDateString('nb-NO')} ${new Date(item.time).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })}`
                    : new Date(item.time).toLocaleDateString('nb-NO');
                return [
                    timeStr,
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
            .filter(s => s.name.startsWith('/') && !submittedUrlPaths.some(path => {
                const normalizedPath = path !== '/' && path.endsWith('/') ? path.slice(0, -1) : path;
                const normalizedName = s.name !== '/' && s.name.endsWith('/') ? s.name.slice(0, -1) : s.name;
                return normalizedName === normalizedPath;
            }))
            .sort((a, b) => b.count - a.count);

        return { entrances: entrancesList, exits: exitsList };
    }, [breakdownData, submittedUrlPaths]);

    // Simple table component for external traffic - similar to AnalysisTable in MarketingAnalysis
    const ExternalTrafficTable = ({ title, data, metricLabel, websiteDomain }: { title: string; data: { name: string; count: number }[]; metricLabel: string; websiteDomain?: string }) => {
        const [search, setSearch] = useState('');
        const [page, setPage] = useState(1);
        const rowsPerPage = 10;

        const filteredData = data.filter(row =>
            row.name.toLowerCase().includes(search.toLowerCase())
        );

        useEffect(() => {
            setPage(1);
        }, [search]);

        const paginatedData = filteredData.slice((page - 1) * rowsPerPage, page * rowsPerPage);
        const totalPages = Math.ceil(filteredData.length / rowsPerPage);

        const renderName = (name: string) => {
            if (name === 'Ukjent / Andre') {
                return (
                    <div className="flex items-center gap-2 max-w-full">
                        <span className="truncate">Ukjent / Andre</span>
                        <HelpText title="Hva betyr dette?" strategy="fixed">
                            Differansen mellom totalen og summen av identifiserte kanaler. Dette kan skyldes filtrering, begrenset antall kilder, eller manglende henvisningsdata.
                        </HelpText>
                    </div>
                );
            }
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

        const downloadCSV = () => {
            if (!data.length) return;

            const headers = ['Navn', metricLabel];
            const csvRows = [
                headers.join(','),
                ...data.map((item) => {
                    return [
                        item.name,
                        submittedMetricType === 'proportion' ? `${(item.count * 100).toFixed(1)}%` : item.count
                    ].join(',');
                })
            ];

            const csvContent = csvRows.join('\n');
            const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', `${title.toLowerCase().replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        };

        return (
            <VStack gap="space-4">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-3">
                    <Heading level="3" size="small">{title}</Heading>
                    <div className="w-full sm:w-64 min-w-0">
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
                    <Table size="small" className="table-fixed w-full [&_th:first-child]:!pl-2 [&_th:first-child]:!pr-2 [&_td:first-child]:!pl-2 [&_td:first-child]:!pr-2">
                        <colgroup>
                            <col style={{ width: '6.75rem' }} />
                            <col />
                        </colgroup>
                        <Table.Header>
                            <Table.Row>
                                <Table.HeaderCell align="right" className="whitespace-normal leading-tight" style={{ width: '6.75rem', minWidth: '6.75rem' }}>{metricLabel}</Table.HeaderCell>
                                <Table.HeaderCell>Navn</Table.HeaderCell>
                            </Table.Row>
                        </Table.Header>
                        <Table.Body>
                            {paginatedData.map((row, i) => (
                                <Table.Row key={i}>
                                    <Table.DataCell align="right" className="tabular-nums" style={{ width: '6.75rem', minWidth: '6.75rem' }}>{row.count.toLocaleString('nb-NO')}</Table.DataCell>
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
                    </div>
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
            .map(item => ({ name: item.name, count: Number(item.count) }));
    }, [externalReferrerData]);

    const combinedEntrances = useMemo(() => {
        const external = externalReferrers.map(item => ({
            name: item.name,
            count: item.count,
            type: 'external' as const
        }));

        const internal = entrances.map(item => ({
            name: item.name,
            count: item.count,
            type: 'internal' as const
        }));

        return [...external, ...internal].sort((a, b) => b.count - a.count);
    }, [externalReferrers, entrances]);

    const entranceSummary = useMemo(() => {
        const channelMap = new Map<string, number>();
        const normalizedDomain = selectedWebsite?.domain?.toLowerCase().replace(/^www\./, '');

        const internalTotal = entrances.reduce((sum, row) => sum + Number(row.count || 0), 0);
        if (internalTotal > 0) {
            channelMap.set('Interne sider', internalTotal);
        }

        externalReferrerData.forEach(item => {
            const rawName = String(item.name || '');
            const source = rawName.toLowerCase().replace(/^www\./, '');
            const count = Number(item.count || 0);
            let channel = 'Eksterne nettsider';

            if (source === '(none)') {
                channel = 'Direkte';
            } else if (normalizedDomain && source === normalizedDomain) {
                channel = 'Interne sider';
            } else if (source.includes('google') || source.includes('bing') || source.includes('yahoo') || source.includes('duckduckgo') || source.includes('ecosia') || source.includes('qwant')) {
                channel = 'Søkemotorer';
            } else if (source.includes('facebook') || source.includes('twitter') || source.includes('linkedin') || source.includes('instagram') || source.includes('tiktok') || source.includes('snapchat')) {
                channel = 'Sosiale medier';
            }

            channelMap.set(channel, (channelMap.get(channel) || 0) + count);
        });

        return Array.from(channelMap.entries())
            .map(([name, count]) => ({ name, count }))
            .filter(item => item.count > 0)
            .sort((a, b) => b.count - a.count);
    }, [externalReferrerData, entrances, selectedWebsite]);

    const seriesTotal = useMemo(() => {
        if (submittedMetricType === 'visits' || submittedMetricType === 'visitors') {
            return seriesTotalCount ?? 0;
        }
        if (!seriesData.length) return 0;
        return seriesData.reduce((sum, item) => sum + Number(item.count || 0), 0);
    }, [seriesData, seriesTotalCount, submittedMetricType]);

    const entranceSummaryWithUnknown = useMemo(() => {
        if (submittedMetricType === 'proportion') {
            return entranceSummary;
        }
        if (!seriesTotal || !entranceSummary.length) return entranceSummary;

        const channelSum = entranceSummary.reduce((sum, item) => sum + Number(item.count || 0), 0);
        const diff = Math.round(seriesTotal - channelSum);

        if (diff > 0) {
            return [...entranceSummary, { name: 'Ukjent / Andre', count: diff }];
        }

        return entranceSummary;
    }, [entranceSummary, seriesTotal, submittedMetricType]);

    const CombinedEntrancesTable = ({
        title,
        data,
        onRowClick,
        selectedWebsite,
        metricLabel
    }: {
        title: string;
        data: { name: string; count: number; type: 'external' | 'internal' }[];
        onRowClick?: (name: string) => void;
        selectedWebsite: Website | null;
        metricLabel: string;
    }) => {
        const [search, setSearch] = useState('');
        const [typeFilter, setTypeFilter] = useState<'all' | 'external' | 'internal'>('all');
        const [page, setPage] = useState(1);
        const rowsPerPage = 10;

        const filteredData = data.filter(row => {
            const matchesType = typeFilter === 'all' || row.type === typeFilter;
            const matchesSearch = row.name.toLowerCase().includes(search.toLowerCase());
            return matchesType && matchesSearch;
        });

        useEffect(() => {
            setPage(1);
        }, [search, typeFilter]);

        const paginatedData = filteredData.slice((page - 1) * rowsPerPage, page * rowsPerPage);
        const totalPages = Math.ceil(filteredData.length / rowsPerPage);

        const isClickableRow = (row: { name: string; type: 'external' | 'internal' }) =>
            row.type === 'internal' && row.name.startsWith('/') && onRowClick;

        const renderName = (row: { name: string; type: 'external' | 'internal' }) => {
            if (row.name === '/') return '/ (forside)';
            if (selectedWebsite && row.name === selectedWebsite.domain) return `Interntrafikk (${row.name})`;
            return row.name;
        };

        const downloadCSV = () => {
            if (!data.length) return;

            const headers = ['Inngang', metricLabel];
            const csvRows = [
                headers.join(','),
                ...data.map((item) => {
                    return [
                        item.name,
                        submittedMetricType === 'proportion' ? `${(item.count * 100).toFixed(1)}%` : item.count
                    ].join(',');
                })
            ];

            const csvContent = csvRows.join('\n');
            const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', `${title.toLowerCase().replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        };

        return (
            <VStack gap="space-4">
                <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
                    <Heading level="3" size="small">{title}</Heading>
                    <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto min-w-0">
                        <div className="w-full sm:w-32">
                            <Select
                                label="Filter"
                                hideLabel
                                size="small"
                                value={typeFilter}
                                onChange={(e) => setTypeFilter(e.target.value as 'all' | 'external' | 'internal')}
                            >
                                <option value="all">Alle</option>
                                <option value="external">Eksterne</option>
                                <option value="internal">Interne</option>
                            </Select>
                        </div>
                        <div className="w-full sm:w-64 min-w-0">
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
                </div>
                <div className="border rounded-lg overflow-x-auto">
                    <Table size="small" className="table-fixed w-full [&_th:first-child]:!pl-2 [&_th:first-child]:!pr-2 [&_td:first-child]:!pl-2 [&_td:first-child]:!pr-2">
                        <colgroup>
                            <col style={{ width: '6.75rem' }} />
                            <col />
                        </colgroup>
                        <Table.Header>
                            <Table.Row>
                                <Table.HeaderCell align="right" className="whitespace-normal leading-tight" style={{ width: '6.75rem', minWidth: '6.75rem' }}>{metricLabel}</Table.HeaderCell>
                                <Table.HeaderCell>Inngang</Table.HeaderCell>
                            </Table.Row>
                        </Table.Header>
                        <Table.Body>
                            {paginatedData.map((row, i) => (
                                <Table.Row
                                    key={i}
                                    className={isClickableRow(row) ? 'cursor-pointer hover:bg-[var(--ax-bg-neutral-soft)]' : ''}
                                    onClick={() => isClickableRow(row) && onRowClick?.(row.name)}
                                >
                                    <Table.DataCell align="right" className="tabular-nums" style={{ width: '6.75rem', minWidth: '6.75rem' }}>{row.count.toLocaleString('nb-NO')}</Table.DataCell>
                                    <Table.DataCell className="max-w-md" title={row.name}>
                                        {isClickableRow(row) ? (
                                            <span className="flex items-center gap-1 max-w-full">
                                                <span
                                                    className="truncate text-blue-600 hover:underline cursor-pointer"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onRowClick?.(row.name);
                                                    }}
                                                >
                                                    {renderName(row)}
                                                </span>
                                                <ExternalLink className="h-3 w-3 shrink-0 text-blue-600" />
                                            </span>
                                        ) : (
                                            <div className="truncate">{renderName(row)}</div>
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
                    <div className="flex gap-2 p-3 bg-[var(--ax-bg-neutral-soft)] border-t justify-between items-center">
                        <Button
                            size="small"
                            variant="secondary"
                            onClick={downloadCSV}
                            icon={<Download size={16} />}
                        >
                            Last ned CSV
                        </Button>
                    </div>
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

    const TrafficTable = ({ title, data, onRowClick, selectedWebsite, metricLabel }: { title: string; data: { name: string; count: number }[]; onRowClick?: (name: string) => void; selectedWebsite: Website | null; metricLabel: string }) => {
        const [search, setSearch] = useState('');
        const [page, setPage] = useState(1);
        const rowsPerPage = 10;

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

        const downloadCSV = () => {
            if (!data.length) return;

            const headers = ['URL-sti', metricLabel];
            const csvRows = [
                headers.join(','),
                ...data.map((item) => {
                    return [
                        item.name, // URL-sti name
                        submittedMetricType === 'proportion' ? `${(item.count * 100).toFixed(1)}%` : item.count
                    ].join(',');
                })
            ];

            const csvContent = csvRows.join('\n');
            const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', `${title.toLowerCase().replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        };


        return (
            <VStack gap="space-4">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-3">
                    <Heading level="3" size="small">{title}</Heading>
                    <div className="w-full sm:w-64 min-w-0">
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
                    <Table size="small" className="table-fixed w-full [&_th:first-child]:!pl-2 [&_th:first-child]:!pr-2 [&_td:first-child]:!pl-2 [&_td:first-child]:!pr-2">
                        <colgroup>
                            <col style={{ width: '6.75rem' }} />
                            <col />
                        </colgroup>
                        <Table.Header>
                            <Table.Row>
                                <Table.HeaderCell align="right" className="whitespace-normal leading-tight" style={{ width: '6.75rem', minWidth: '6.75rem' }}>
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
                                    <Table.DataCell align="right" className="tabular-nums" style={{ width: '6.75rem', minWidth: '6.75rem' }}>
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
                    </div>
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

    const ChartDataTable = ({ data, metricLabel }: { data: any[]; metricLabel: string }) => {
        const [search, setSearch] = useState('');
        const [page, setPage] = useState(1);
        const rowsPerPage = 10;

        const formatTime = (time: string) => {
            if (submittedGranularity === 'hour') {
                return `${new Date(time).toLocaleDateString('nb-NO')} ${new Date(time).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })}`;
            }
            return new Date(time).toLocaleDateString('nb-NO');
        };

        const filteredData = data.filter(item =>
            formatTime(item.time).includes(search)
        );

        useEffect(() => {
            setPage(1);
        }, [search]);

        const paginatedData = filteredData.slice((page - 1) * rowsPerPage, page * rowsPerPage);
        const totalPages = Math.ceil(filteredData.length / rowsPerPage);

        return (
            <VStack gap="space-4">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-3">
                    <Heading level="3" size="small">Trend</Heading>
                    <div className="w-full sm:w-64 min-w-0">
                        <TextField
                            label={submittedGranularity === 'hour' ? "Søk etter tidspunkt" : "Søk etter dato"}
                            hideLabel
                            placeholder={submittedGranularity === 'hour' ? "Søk etter tid..." : "Søk etter dato..."}
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
                                <Table.HeaderCell>{submittedGranularity === 'hour' ? 'Tidspunkt' : 'Dato'}</Table.HeaderCell>
                                <Table.HeaderCell align="right">{metricLabel}</Table.HeaderCell>
                            </Table.Row>
                        </Table.Header>
                        <Table.Body>
                            {paginatedData.map((item, index) => (
                                <Table.Row key={index}>
                                    <Table.DataCell>
                                        {formatTime(item.time)}
                                    </Table.DataCell>
                                    <Table.DataCell align="right">
                                        {submittedMetricType === 'proportion' ? `${(item.count * 100).toFixed(1)}%` : item.count.toLocaleString('nb-NO')}
                                    </Table.DataCell>
                                </Table.Row>
                            ))}
                            {filteredData.length === 0 && (
                                <Table.Row>
                                    <Table.DataCell colSpan={2} align="center">
                                        {data.length > 0 ? 'Ingen treff (Data: ' + data.length + ')' : 'Ingen data'}
                                    </Table.DataCell>
                                </Table.Row>
                            )}
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
            title="Trafikkoversikt"
            description="Se besøk over tid og trafikkilder."
            currentPage="trafikkanalyse"
            websiteDomain={selectedWebsite?.domain}
            websiteName={selectedWebsite?.name}
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

                    />

                    <PeriodPicker
                        period={period}
                        onPeriodChange={setPeriod}
                        startDate={customStartDate}
                        onStartDateChange={setCustomStartDate}
                        endDate={customEndDate}
                        onEndDateChange={setCustomEndDate}
                    />

                    <div className="w-full sm:w-auto min-w-[200px]">
                        <Select
                            label="Visning"
                            size="small"
                            value={metricType}
                            key={`metric-${metricType}-${cookieBadge || 'nocookie'}`}
                            onChange={(e) => setMetricType(e.target.value)}
                        >
                            <option value="visitors">{currentDateRange
                                ? getVisitorLabelWithBadge(
                                    usesCookies,
                                    cookieStartDate,
                                    currentDateRange.startDate,
                                    currentDateRange.endDate
                                )
                                : 'Unike besøkende'}</option>
                            <option value="visits">Økter / besøk</option>
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

                </>
            }
        >
            {error && (
                <Alert variant="error" className="mb-4">
                    {error}
                </Alert>
            )}

            {(cookieBadge === 'mix' || isPreCookieRange) && (
                <CookieMixNotice
                    websiteName={selectedWebsite?.name}
                    cookieStartDate={cookieStartDate}
                    variant={isPreCookieRange ? 'pre' : 'mix'}
                />
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
                                <Tabs.Tab value="sources" label="Inn- og utganger" />
                            </Tabs.List>

                            <Tabs.Panel value="visits" className="pt-4">
                                {hasAttemptedFetch && (isLoadingPageMetrics || !hasFetchedPageMetrics) ? (
                                    <div className="flex justify-center items-center h-full py-16">
                                        <Loader size="xlarge" title="Henter data..." />
                                    </div>
                                ) : (
                                    <>
                                        <TrafficStats data={seriesData} metricType={submittedMetricType} totalOverride={totalOverride} granularity={submittedGranularity} />
                                        <div className="flex flex-col gap-8">
                                            <div className="flex flex-col gap-4">
                                                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-2">
                                                    <div className="flex items-center gap-4">
                                                        <Switch
                                                            checked={showAverage}
                                                            onChange={(e) => setShowAverage(e.target.checked)}
                                                            size="small"
                                                        >
                                                            Vis gjennomsnitt
                                                        </Switch>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <Label size="small" htmlFor="traffic-granularity">Intervall</Label>
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
                                                            <option value="hour">Time</option>
                                                        </Select>
                                                    </div>
                                                </div>
                                                <div style={{ width: '100%', height: '400px' }}>
                                                    {chartData ? (
                                                        <ResponsiveContainer>
                                                            <LineChart
                                                                key={`${submittedMetricType}-${submittedPeriod}-${seriesData.length}`}
                                                                data={chartData.data}
                                                                legendsOverflowText={'Overflow Items'}
                                                                yAxisTickFormat={(d: any) => submittedMetricType === 'proportion' ? `${d.toFixed(1)}%` : d.toLocaleString('nb-NO')}
                                                                yAxisTickCount={6}
                                                                yMaxValue={chartData.yMax}
                                                                yMinValue={chartData.yMin}
                                                                allowMultipleShapesForPoints={false}
                                                                enablePerfOptimization={true}
                                                                margins={{ left: 85, right: 40, top: 20, bottom: 35 }}
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
                                                {/* Chart Data Table - First position */}
                                                <div className="w-full md:w-1/2">
                                                    <ChartDataTable
                                                        data={seriesData}
                                                        metricLabel={getMetricLabelWithCount(submittedMetricType)}
                                                    />
                                                </div>

                                                {/* Pages Table - Second position */}
                                                <div className="w-full md:w-1/2">
                                                    <TrafficTable
                                                        title="Inkluderte sider"
                                                        data={includedPagesData}
                                                        onRowClick={setSelectedInternalUrl}
                                                        selectedWebsite={selectedWebsite}
                                                        metricLabel={getMetricLabelCapitalized(submittedMetricType)}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </Tabs.Panel>

                            <Tabs.Panel value="sources" className="pt-4">
                                {hasAttemptedFetch && ((isLoadingExternalReferrers || !hasFetchedExternalReferrers) || (isLoadingBreakdown || !hasFetchedBreakdown)) ? (
                                    <div className="flex justify-center items-center h-full py-16">
                                        <Loader size="xlarge" title="Henter data..." />
                                    </div>
                                ) : (
                                    <div className="flex flex-col md:flex-row gap-8">
                                        <div className="w-full md:w-1/2 flex flex-col gap-8">
                                            <CombinedEntrancesTable
                                                title="Innganger"
                                                data={combinedEntrances}
                                                onRowClick={setSelectedInternalUrl}
                                                selectedWebsite={selectedWebsite}
                                                metricLabel={getMetricLabelCapitalized(submittedMetricType)}
                                            />
                                            <ExternalTrafficTable
                                                title="Innganger oppsummert"
                                                data={entranceSummaryWithUnknown}
                                                metricLabel={getMetricLabelCapitalized(submittedMetricType)}
                                            />
                                        </div>
                                        <div className="w-full md:w-1/2 flex flex-col gap-8">
                                            <TrafficTable title="Utganger" data={exits} onRowClick={setSelectedInternalUrl} selectedWebsite={selectedWebsite} metricLabel={getMetricLabelCapitalized(submittedMetricType)} />
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
                                )}
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

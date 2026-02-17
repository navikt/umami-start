import { useState, useMemo, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Button, Alert, Loader, Tabs, TextField, Table, Heading, Pagination, VStack, Select, HelpText } from '@navikt/ds-react';
import { ILineChartDataPoint } from '@fluentui/react-charting';
import { Download, Share2, Check, ExternalLink } from 'lucide-react';
import { format, parseISO, startOfWeek, startOfMonth, isValid, differenceInCalendarDays, subDays } from 'date-fns';
import { nb } from 'date-fns/locale';
import ChartLayout from '../../components/analysis/ChartLayout';
import WebsitePicker from '../../components/analysis/WebsitePicker';
import OversiktTabContent from '../../components/analysis/traffic/OversiktTabContent';
import InnOgUtgangerTabContent from '../../components/analysis/traffic/InnOgUtgangerTabContent';
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
        case 'pageviews': return 'Sidevisninger';
        case 'proportion': return 'Andel';
        case 'visits': return 'Økter';
        default: return 'Besøkende';
    }
};

const getMetricUnitLabel = (type: string): string => {
    switch (type) {
        case 'pageviews': return 'sidevisninger';
        case 'proportion': return 'prosentpoeng';
        case 'visits': return 'økter';
        default: return 'besøkende';
    }
};

const isCompareEnabled = (value: string | null): boolean => value === '1' || value === 'true';

const getPreviousDateRange = (startDate: Date, endDate: Date) => {
    const numberOfDays = Math.max(1, differenceInCalendarDays(endDate, startDate) + 1);
    return {
        startDate: subDays(startDate, numberOfDays),
        endDate: subDays(endDate, numberOfDays),
    };
};

const aggregateSeriesData = (
    data: SeriesPoint[],
    granularity: 'day' | 'week' | 'month' | 'hour',
    metricType: string
) => {
    if (granularity !== 'week' && granularity !== 'month') {
        return data;
    }

    const aggregated = new Map<string, { time: Date; value: number; count: number }>();

    data.forEach((item) => {
        const date = new Date(item.time);
        if (!isValid(date)) return;

        let key = '';
        let displayTime = date;

        if (granularity === 'week') {
            displayTime = startOfWeek(date, { weekStartsOn: 1 });
            key = format(displayTime, 'yyyy-MM-dd');
        } else {
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

    return Array.from(aggregated.values())
        .sort((a, b) => a.time.getTime() - b.time.getTime())
        .map(entry => ({
            time: entry.time.toISOString(),
            count: metricType === 'proportion' ? entry.value / entry.count : entry.value
        }));
};

const getComparablePeriodValue = (data: SeriesPoint[], metricType: string, totalCount?: number) => {
    if (!data.length) return 0;

    if (metricType === 'proportion') {
        const values = data
            .map(item => Number(item.count) || 0)
            .filter(value => value >= 0 && value <= 1.01)
            .map(value => Math.min(value, 1));

        if (!values.length) return 0;
        return values.reduce((sum, value) => sum + value, 0) / values.length;
    }

    if ((metricType === 'visits' || metricType === 'visitors') && typeof totalCount === 'number') {
        return totalCount;
    }

    return data.reduce((sum, item) => sum + (Number(item.count) || 0), 0);
};

type SeriesPoint = {
    time: string;
    count: number;
};

type PageMetricRow = {
    urlPath: string;
    pageviews: number;
    proportion: number;
    visitors: number;
};

type BreakdownEntry = {
    name: string;
    visitors: number;
};

type BreakdownData = {
    sources: BreakdownEntry[];
    exits: BreakdownEntry[];
};

type ExternalReferrerRow = {
    name: string;
    count: number;
};

type QueryStats = {
    totalBytesProcessedGB?: number;
    estimatedCostUSD?: number;
};

type SeriesResponse = {
    data?: SeriesPoint[];
    totalCount?: number;
    queryStats?: QueryStats;
};

type BreakdownResponse = {
    sources?: BreakdownEntry[];
    exits?: BreakdownEntry[];
};

type PageMetricsResponse = {
    data?: PageMetricRow[];
};

type ExternalReferrerResponse = {
    data?: {
        referrer?: ExternalReferrerRow[];
    };
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
    const initialCompareValue = isCompareEnabled(searchParams.get('comparePrevious'));
    const [comparePreviousPeriod, setComparePreviousPeriod] = useState<boolean>(initialCompareValue);
    const [submittedComparePreviousPeriod, setSubmittedComparePreviousPeriod] = useState<boolean>(initialCompareValue);
    const [submittedDateRange, setSubmittedDateRange] = useState<{ startDate: Date; endDate: Date } | null>(null);
    const [submittedPreviousDateRange, setSubmittedPreviousDateRange] = useState<{ startDate: Date; endDate: Date } | null>(null);

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
    const [seriesData, setSeriesData] = useState<SeriesPoint[]>([]);
    const [seriesTotalCount, setSeriesTotalCount] = useState<number | undefined>(undefined);
    const [previousSeriesData, setPreviousSeriesData] = useState<SeriesPoint[]>([]);
    const [previousSeriesTotalCount, setPreviousSeriesTotalCount] = useState<number | undefined>(undefined);
    const [pageMetrics, setPageMetrics] = useState<PageMetricRow[]>([]);
    const [previousPageMetrics, setPreviousPageMetrics] = useState<PageMetricRow[]>([]);
    const [seriesQueryStats, setSeriesQueryStats] = useState<QueryStats | null>(null);

    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [hasAttemptedFetch, setHasAttemptedFetch] = useState<boolean>(false);
    const [copySuccess, setCopySuccess] = useState<boolean>(false);
    const [selectedInternalUrl, setSelectedInternalUrl] = useState<string | null>(null);
    const [lastAppliedFilterKey, setLastAppliedFilterKey] = useState<string | null>(null);

    const buildFilterKey = useCallback((granularityOverride = granularity) =>
        JSON.stringify({
            websiteId: selectedWebsite?.id ?? null,
            urlPaths,
            pathOperator,
            period,
            customStartDate: customStartDate?.toISOString() ?? null,
            customEndDate: customEndDate?.toISOString() ?? null,
            metricType,
            granularity: granularityOverride,
            comparePreviousPeriod,
        }), [selectedWebsite?.id, urlPaths, pathOperator, period, customStartDate, customEndDate, metricType, granularity, comparePreviousPeriod]);
    const hasUnappliedFilterChanges = buildFilterKey() !== lastAppliedFilterKey;

    const includedPagesData = useMemo(() => {
        if (!pageMetrics.length) return [];
        return pageMetrics.map(item => ({
            name: item.urlPath,
            count: submittedMetricType === 'pageviews' ? item.pageviews : (submittedMetricType === 'proportion' ? item.proportion : item.visitors)
        }));
    }, [pageMetrics, submittedMetricType]);

    const previousIncludedPagesMap = useMemo(() => {
        const map = new Map<string, number>();
        previousPageMetrics.forEach(item => {
            const value = submittedMetricType === 'pageviews'
                ? item.pageviews
                : (submittedMetricType === 'proportion' ? item.proportion : item.visitors);
            map.set(item.urlPath, Number(value) || 0);
        });
        return map;
    }, [previousPageMetrics, submittedMetricType]);

    const includedPagesWithCompare = useMemo(() => {
        if (!submittedComparePreviousPeriod) return includedPagesData;

        const rowMap = new Map<string, { name: string; count: number; previousCount: number; deltaCount: number }>();

        includedPagesData.forEach(item => {
            const previousCount = previousIncludedPagesMap.get(item.name) || 0;
            rowMap.set(item.name, {
                name: item.name,
                count: item.count,
                previousCount,
                deltaCount: item.count - previousCount
            });
        });

        previousIncludedPagesMap.forEach((previousCount, name) => {
            if (rowMap.has(name)) return;
            rowMap.set(name, {
                name,
                count: 0,
                previousCount,
                deltaCount: -previousCount
            });
        });

        return Array.from(rowMap.values()).sort((a, b) => b.count - a.count);
    }, [includedPagesData, previousIncludedPagesMap, submittedComparePreviousPeriod]);

    // Override totals for metrics that cannot be summed across time buckets.
    const totalOverride = useMemo(() => {
        if (submittedMetricType === 'visits' || submittedMetricType === 'visitors') {
            return seriesTotalCount;
        }
        return undefined;
    }, [submittedMetricType, seriesTotalCount]);

    const previousTotalOverride = useMemo(() => {
        if (submittedMetricType === 'visits' || submittedMetricType === 'visitors') {
            return previousSeriesTotalCount;
        }
        return undefined;
    }, [submittedMetricType, previousSeriesTotalCount]);


    const [breakdownData, setBreakdownData] = useState<BreakdownData>({ sources: [], exits: [] });
    const [externalReferrerData, setExternalReferrerData] = useState<ExternalReferrerRow[]>([]); // Data from marketing-stats API
    const [hasFetchedPageMetrics, setHasFetchedPageMetrics] = useState<boolean>(false);
    const [hasFetchedBreakdown, setHasFetchedBreakdown] = useState<boolean>(false);
    const [hasFetchedExternalReferrers, setHasFetchedExternalReferrers] = useState<boolean>(false);
    const [isLoadingPageMetrics, setIsLoadingPageMetrics] = useState<boolean>(false);
    const [isLoadingBreakdown, setIsLoadingBreakdown] = useState<boolean>(false);
    const [isLoadingExternalReferrers, setIsLoadingExternalReferrers] = useState<boolean>(false);

    const getCountByQueryParams = useCallback((startDate: Date, endDate: Date) => {
        const { countBy, countBySwitchAt } = getCookieCountByParams(usesCookies, cookieStartDate, startDate, endDate);
        return {
            countByParams: countBy ? `&countBy=${countBy}` : '',
            countBySwitchAtParam: countBySwitchAt ? `&countBySwitchAt=${countBySwitchAt}` : ''
        };
    }, [usesCookies, cookieStartDate]);

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

    const fetchSeriesData = useCallback(async () => {
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
        setPreviousSeriesData([]);
        setPreviousSeriesTotalCount(undefined);
        setPageMetrics([]);
        setPreviousPageMetrics([]);
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
        setSubmittedComparePreviousPeriod(comparePreviousPeriod);
        let effectiveGranularity = granularity;

        // Auto-switch to hourly granularity for short periods upon fetch
        if (period === 'today' || period === 'yesterday') {
            effectiveGranularity = 'hour';
            setGranularity('hour'); // Sync UI with the enforced decision
        }
        const appliedFilterKey = buildFilterKey(effectiveGranularity);

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
        const previousDateRange = comparePreviousPeriod ? getPreviousDateRange(startDate, endDate) : null;
        setSubmittedDateRange({ startDate, endDate });
        setSubmittedPreviousDateRange(previousDateRange);
        const { countByParams, countBySwitchAtParam } = getCountByQueryParams(startDate, endDate);

        try {
            // Fetch Series Data - use first path if multiple
            const urlPath = urlPaths.length > 0 ? urlPaths[0] : '';
            const normalizedPath = urlPath !== '/' && urlPath.endsWith('/') ? urlPath.slice(0, -1) : urlPath;

            const buildSeriesUrl = (
                rangeStartDate: Date,
                rangeEndDate: Date,
                countByQueryParams: { countByParams: string; countBySwitchAtParam: string }
            ) => {
                let url = `/api/bigquery/websites/${selectedWebsite.id}/traffic-series?startAt=${rangeStartDate.getTime()}&endAt=${rangeEndDate.getTime()}&pathOperator=${pathOperator}&metricType=${metricType}&interval=${interval}${countByQueryParams.countByParams}${countByQueryParams.countBySwitchAtParam}`;
                if (normalizedPath) {
                    url += `&urlPath=${encodeURIComponent(normalizedPath)}`;
                }
                return url;
            };

            const seriesUrl = buildSeriesUrl(startDate, endDate, { countByParams, countBySwitchAtParam });

            const seriesResponse = await fetch(seriesUrl);
            if (!seriesResponse.ok) throw new Error('Kunne ikke hente trafikkdata');
            const seriesResult: SeriesResponse = await seriesResponse.json();

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

            if (comparePreviousPeriod && previousDateRange) {
                const previousCountByParams = getCountByQueryParams(previousDateRange.startDate, previousDateRange.endDate);
                const previousSeriesUrl = buildSeriesUrl(previousDateRange.startDate, previousDateRange.endDate, previousCountByParams);
                const previousSeriesResponse = await fetch(previousSeriesUrl);
                if (!previousSeriesResponse.ok) throw new Error('Kunne ikke hente sammenligningsdata');
                const previousSeriesResult: SeriesResponse = await previousSeriesResponse.json();

                setPreviousSeriesData(previousSeriesResult.data || []);
                setPreviousSeriesTotalCount(typeof previousSeriesResult.totalCount === 'number' ? previousSeriesResult.totalCount : undefined);
            }

            // Update URL with configuration for sharing
            const newParams = new URLSearchParams(window.location.search);
            newParams.set('period', period);
            newParams.set('metricType', metricType);
            if (comparePreviousPeriod) {
                newParams.set('comparePrevious', '1');
            } else {
                newParams.delete('comparePrevious');
            }
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
            setLastAppliedFilterKey(appliedFilterKey);

        } catch (err) {
            console.error('Error fetching traffic data:', err);
            const message = err instanceof Error ? err.message : 'Det oppstod en feil ved henting av data.';
            setError(message);
        } finally {
            setLoading(false);
        }
    }, [selectedWebsite, metricType, urlPaths, pathOperator, customStartDate, customEndDate, comparePreviousPeriod, granularity, period, buildFilterKey, getCountByQueryParams]);

    // Auto-submit when website is selected (from localStorage, URL, or Home page picker)
    useEffect(() => {
        if (selectedWebsite && !hasAttemptedFetch) {
            fetchSeriesData();
        }
    }, [selectedWebsite, hasAttemptedFetch, fetchSeriesData]);

    // Auto-fetch when granularity changes (after initial fetch).
    useEffect(() => {
        if (!hasAttemptedFetch || !selectedWebsite || loading) return;
        if (granularity !== submittedGranularity) {
            fetchSeriesData();
        }
    }, [granularity, submittedGranularity, hasAttemptedFetch, selectedWebsite, loading, fetchSeriesData]);

    // Auto-fetch when compare option changes (after initial fetch).
    useEffect(() => {
        if (!hasAttemptedFetch || !selectedWebsite || loading) return;
        if (comparePreviousPeriod !== submittedComparePreviousPeriod) {
            fetchSeriesData();
        }
    }, [comparePreviousPeriod, submittedComparePreviousPeriod, hasAttemptedFetch, selectedWebsite, loading, fetchSeriesData]);

    const fetchTrafficBreakdown = useCallback(async (startDate: Date, endDate: Date, options?: { urlPaths?: string[]; pathOperator?: string; metricType?: string }) => {
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
            const result: BreakdownResponse = await response.json();

            if (result.sources || result.exits) {
                setBreakdownData({
                    sources: result.sources || [],
                    exits: result.exits || []
                });
            }
        } catch (err) {
            console.error('Error fetching traffic breakdown:', err);
        } finally {
            setHasFetchedBreakdown(true);
            setIsLoadingBreakdown(false);
        }
    }, [selectedWebsite, submittedUrlPaths, submittedPathOperator, submittedMetricType, getCountByQueryParams]);


    const fetchPageMetrics = useCallback(async (startDate: Date, endDate: Date, options?: { urlPaths?: string[]; pathOperator?: string; metricType?: string }) => {
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
            const result: PageMetricsResponse = await response.json();

            if (result.data) {
                setPageMetrics(result.data);
            }

            if (submittedComparePreviousPeriod && submittedPreviousDateRange) {
                const { countByParams: previousCountByParams, countBySwitchAtParam: previousCountBySwitchAtParam } = getCountByQueryParams(
                    submittedPreviousDateRange.startDate,
                    submittedPreviousDateRange.endDate
                );
                const previousMetricsUrl = `/api/bigquery/websites/${selectedWebsite.id}/page-metrics?startAt=${submittedPreviousDateRange.startDate.getTime()}&endAt=${submittedPreviousDateRange.endDate.getTime()}&limit=1000${normalizedPath ? `&urlPath=${encodeURIComponent(normalizedPath)}` : ''}&pathOperator=${activePathOperator}&metricType=${activeMetricType}${previousCountByParams}${previousCountBySwitchAtParam}`;
                const previousResponse = await fetch(previousMetricsUrl);
                if (!previousResponse.ok) throw new Error('Kunne ikke hente forrige sidemetrikker');
                const previousResult: PageMetricsResponse = await previousResponse.json();
                setPreviousPageMetrics(previousResult.data || []);
            } else {
                setPreviousPageMetrics([]);
            }
        } catch (err) {
            console.error('Error fetching page metrics:', err);
        } finally {
            setHasFetchedPageMetrics(true);
            setIsLoadingPageMetrics(false);
        }
    }, [selectedWebsite, submittedUrlPaths, submittedPathOperator, submittedMetricType, submittedComparePreviousPeriod, submittedPreviousDateRange, getCountByQueryParams]);

    // Fetch external referrer data from marketing-stats API (same as MarketingAnalysis)
    const fetchExternalReferrers = useCallback(async (startDate: Date, endDate: Date, options?: { urlPaths?: string[]; pathOperator?: string; metricType?: string }) => {
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
            const result: ExternalReferrerResponse = await response.json();

            if (result.data && result.data.referrer) {
                setExternalReferrerData(result.data.referrer);
            }
        } catch (err) {
            console.error('Error fetching external referrers:', err);
        } finally {
            setHasFetchedExternalReferrers(true);
            setIsLoadingExternalReferrers(false);
        }
    }, [selectedWebsite, submittedUrlPaths, submittedPathOperator, submittedMetricType, getCountByQueryParams]);

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
        hasFetchedBreakdown,
        fetchPageMetrics,
        fetchExternalReferrers,
        fetchTrafficBreakdown
    ]);

    const processedSeriesData = useMemo(
        () => aggregateSeriesData(seriesData, submittedGranularity, submittedMetricType),
        [seriesData, submittedGranularity, submittedMetricType]
    );

    const processedPreviousSeriesData = useMemo(
        () => aggregateSeriesData(previousSeriesData, submittedGranularity, submittedMetricType),
        [previousSeriesData, submittedGranularity, submittedMetricType]
    );

    // Prepare Chart Data
    const chartData = useMemo(() => {
        if (!processedSeriesData.length) return null;

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
        const formatXAxisLabel = (date: Date) => {
            if (submittedGranularity === 'week') {
                return `Uke ${format(date, 'w', { locale: nb })}`;
            }
            if (submittedGranularity === 'month') {
                return format(date, 'MMM yyyy', { locale: nb });
            }
            if (submittedGranularity === 'hour') {
                return format(date, 'HH:mm');
            }
            return date.toLocaleDateString('nb-NO');
        };
        const toChartValue = (rawValue: number) => (
            submittedMetricType === 'proportion'
                ? Math.min(rawValue * 100, 100)
                : rawValue
        );

        const metricLabel = getMetricLabel(submittedMetricType);
        const metricLabelCapitalized = getMetricLabelCapitalized(submittedMetricType);

        const points: ILineChartDataPoint[] = processedSeriesData.map((item: SeriesPoint) => {
            let value = Number(item.count) || 0;

            if (submittedMetricType === 'proportion') {
                if (value > 1.01) value = 0;
                if (value < 0) value = 0;
            }

            const pointDate = new Date(item.time);
            const xAxisLabel = formatXAxisLabel(pointDate);

            return {
                x: pointDate,
                y: toChartValue(value),
                legend: xAxisLabel,
                xAxisCalloutData: xAxisLabel,
                yAxisCalloutData: submittedMetricType === 'proportion'
                    ? `${(value * 100).toFixed(1)}%`
                    : `${value.toLocaleString('nb-NO')} ${metricLabel}`
            };
        });

        const lines: { legend: string; data: ILineChartDataPoint[]; color: string }[] = [
            {
                legend: metricLabelCapitalized,
                data: points,
                color: '#0072B2',
            }
        ];

        if (
            submittedComparePreviousPeriod &&
            processedPreviousSeriesData.length > 0 &&
            submittedDateRange &&
            submittedPreviousDateRange
        ) {
            const offsetMs = submittedDateRange.startDate.getTime() - submittedPreviousDateRange.startDate.getTime();
            const previousPoints: ILineChartDataPoint[] = processedPreviousSeriesData.map((item: SeriesPoint) => {
                let value = Number(item.count) || 0;

                if (submittedMetricType === 'proportion') {
                    if (value > 1.01) value = 0;
                    if (value < 0) value = 0;
                }

                const shiftedDate = new Date(new Date(item.time).getTime() + offsetMs);
                const xAxisLabel = formatXAxisLabel(shiftedDate);

                return {
                    x: shiftedDate,
                    y: toChartValue(value),
                    legend: xAxisLabel,
                    xAxisCalloutData: `${xAxisLabel} (forrige periode)`,
                    yAxisCalloutData: submittedMetricType === 'proportion'
                        ? `${(value * 100).toFixed(1)}%`
                        : `${value.toLocaleString('nb-NO')} ${metricLabel}`
                };
            });

            lines.push({
                legend: 'Forrige periode',
                data: previousPoints,
                color: '#D55E00',
            });
        }

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
                color: '#009E73',
            });
        }

        const allYValues = lines.flatMap(line => line.data.map(point => Number(point.y) || 0));
        const dataMax = Math.max(...allYValues, 0);
        const yMax = submittedMetricType === 'proportion'
            ? Math.max(dataMax * 1.1, 1)
            : dataMax * 1.1;

        return {
            data: {
                lineChartData: lines
            },
            yMax,
            yMin: 0,
        };
    }, [
        processedSeriesData,
        processedPreviousSeriesData,
        showAverage,
        submittedMetricType,
        submittedGranularity,
        submittedComparePreviousPeriod,
        submittedDateRange,
        submittedPreviousDateRange
    ]);

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
            ...seriesData.map((item: SeriesPoint) => {
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

        const normalizePathValue = (value: string) =>
            value !== '/' && value.endsWith('/') ? value.slice(0, -1) : value;
        const submittedPathSet = new Set(submittedUrlPaths.map(normalizePathValue));

        const sources = breakdownData.sources.map((s: BreakdownEntry) => ({
            name: s.name,
            count: Number(s.visitors)
        }));

        const exitsList = breakdownData.exits.map((e: BreakdownEntry) => ({
            name: e.name,
            count: Number(e.visitors)
        }))
            // Hide self-loop exits (same path as the analyzed URL path).
            .filter(e => {
                if (!e.name.startsWith('/')) return true;
                return !submittedPathSet.has(normalizePathValue(e.name));
            })
            .sort((a, b) => b.count - a.count);

        // Filter Sources for internal entrances only, excluding the current URL path(s) being analyzed
        const entrancesList = sources
            .filter(s => s.name.startsWith('/') && !submittedPathSet.has(normalizePathValue(s.name)))
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

        const formatMetricValue = (value: number) => {
            if (submittedMetricType === 'proportion') {
                return `${(value * 100).toFixed(1)}%`;
            }
            return Math.round(value).toLocaleString('nb-NO');
        };

        const formatCsvValue = (value: number) => {
            if (submittedMetricType === 'proportion') {
                return `${(value * 100).toFixed(1)}%`;
            }
            return Math.round(value);
        };

        const renderName = (name: string) => {
            if (name === 'Interne sider') return <div className="truncate">Interne sider</div>;
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
                        formatCsvValue(item.count)
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
                                    <Table.DataCell align="right" className="tabular-nums" style={{ width: '6.75rem', minWidth: '6.75rem' }}>{formatMetricValue(row.count)}</Table.DataCell>
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
            .map(item => ({
                name: item.name,
                count: submittedMetricType === 'proportion'
                    ? Number(item.count) / 100
                    : Number(item.count)
            }));
    }, [externalReferrerData, submittedMetricType]);

    const combinedEntrances = useMemo(() => {
        const normalizedDomain = selectedWebsite?.domain?.toLowerCase().replace(/^www\./, '');
        const external = externalReferrers.map(item => ({
            name: item.name,
            count: item.count,
            type: 'external' as const,
            isDomainInternal: Boolean(normalizedDomain && item.name.toLowerCase().replace(/^www\./, '') === normalizedDomain)
        }));

        const internal = entrances.map(item => ({
            name: item.name,
            count: item.count,
            type: 'internal' as const,
            isDomainInternal: false
        }));

        return [...external, ...internal].sort((a, b) => b.count - a.count);
    }, [externalReferrers, entrances, selectedWebsite]);

    const entranceSummary = useMemo(() => {
        const channelMap = new Map<string, number>();
        const normalizedDomain = selectedWebsite?.domain?.toLowerCase().replace(/^www\./, '');

        externalReferrerData.forEach(item => {
            const rawName = String(item.name || '');
            const source = rawName.toLowerCase().replace(/^www\./, '');
            const count = submittedMetricType === 'proportion'
                ? Number(item.count || 0) / 100
                : Number(item.count || 0);
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
    }, [externalReferrerData, selectedWebsite, submittedMetricType]);

    const seriesTotal = useMemo(() => {
        if (submittedMetricType === 'visits' || submittedMetricType === 'visitors') {
            return seriesTotalCount ?? 0;
        }
        if (!seriesData.length) return 0;
        return seriesData.reduce((sum, item) => sum + Number(item.count || 0), 0);
    }, [seriesData, seriesTotalCount, submittedMetricType]);

    const comparisonSummary = useMemo(() => {
        if (!submittedComparePreviousPeriod || !processedSeriesData.length || !processedPreviousSeriesData.length) {
            return null;
        }

        const currentValue = getComparablePeriodValue(processedSeriesData, submittedMetricType, totalOverride);
        const previousValue = getComparablePeriodValue(processedPreviousSeriesData, submittedMetricType, previousTotalOverride);
        const deltaValue = currentValue - previousValue;

        let deltaPercent: number | null = null;
        if (previousValue !== 0) {
            deltaPercent = (deltaValue / previousValue) * 100;
        } else if (currentValue === 0) {
            deltaPercent = 0;
        }

        return {
            currentValue,
            previousValue,
            deltaValue,
            deltaPercent,
        };
    }, [
        submittedComparePreviousPeriod,
        processedSeriesData,
        processedPreviousSeriesData,
        submittedMetricType,
        totalOverride,
        previousTotalOverride
    ]);

    const formatComparisonValue = (value: number) => {
        if (submittedMetricType === 'proportion') {
            return `${(value * 100).toFixed(1)}%`;
        }
        return Math.round(value).toLocaleString('nb-NO');
    };

    const formatComparisonDelta = (value: number) => {
        const unitLabel = getMetricUnitLabel(submittedMetricType);
        if (submittedMetricType === 'proportion') {
            return `${value >= 0 ? '+' : ''}${(value * 100).toFixed(1)} ${unitLabel}`;
        }
        return `${value >= 0 ? '+' : ''}${Math.round(value).toLocaleString('nb-NO')} ${unitLabel}`;
    };

    const comparisonRangeLabel = useMemo(() => {
        if (!submittedDateRange || !submittedPreviousDateRange) return null;

        const formatRange = (range: { startDate: Date; endDate: Date }) =>
            `${format(range.startDate, 'dd.MM.yy')}–${format(range.endDate, 'dd.MM.yy')}`;

        return {
            current: formatRange(submittedDateRange),
            previous: formatRange(submittedPreviousDateRange),
        };
    }, [submittedDateRange, submittedPreviousDateRange]);

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
        data: { name: string; count: number; type: 'external' | 'internal'; isDomainInternal?: boolean }[];
        onRowClick?: (name: string) => void;
        selectedWebsite: Website | null;
        metricLabel: string;
    }) => {
        const [search, setSearch] = useState('');
        const [typeFilter, setTypeFilter] = useState<'all' | 'external' | 'internal'>('all');
        const [page, setPage] = useState(1);
        const rowsPerPage = 10;

        const filteredData = data.filter(row => {
            const matchesType = typeFilter === 'all'
                ? !row.isDomainInternal
                : (typeFilter === 'external'
                    ? row.type === 'external' && !row.isDomainInternal
                    : row.type === 'internal');
            const matchesSearch = row.name.toLowerCase().includes(search.toLowerCase());
            return matchesType && matchesSearch;
        });

        useEffect(() => {
            setPage(1);
        }, [search, typeFilter]);

        const paginatedData = filteredData.slice((page - 1) * rowsPerPage, page * rowsPerPage);
        const totalPages = Math.ceil(filteredData.length / rowsPerPage);

        const formatMetricValue = (value: number) => {
            if (submittedMetricType === 'proportion') {
                return `${(value * 100).toFixed(1)}%`;
            }
            return Math.round(value).toLocaleString('nb-NO');
        };

        const formatCsvValue = (value: number) => {
            if (submittedMetricType === 'proportion') {
                return `${(value * 100).toFixed(1)}%`;
            }
            return Math.round(value);
        };

        const isClickableRow = (row: { name: string; type: 'external' | 'internal' }) =>
            row.type === 'internal' && row.name.startsWith('/') && onRowClick;

        const renderName = (row: { name: string; type: 'external' | 'internal' }) => {
            if (row.name === '/') return '/ (forside)';
            if (selectedWebsite && row.name.toLowerCase().replace(/^www\./, '') === selectedWebsite.domain.toLowerCase().replace(/^www\./, '')) {
                return `Interne sider (${row.name})`;
            }
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
                        formatCsvValue(item.count)
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
                                    <Table.DataCell align="right" className="tabular-nums" style={{ width: '6.75rem', minWidth: '6.75rem' }}>{formatMetricValue(row.count)}</Table.DataCell>
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

    const TrafficTable = ({
        title,
        data,
        onRowClick,
        selectedWebsite,
        metricLabel,
        showCompare = false
    }: {
        title: string;
        data: { name: string; count: number; previousCount?: number; deltaCount?: number }[];
        onRowClick?: (name: string) => void;
        selectedWebsite: Website | null;
        metricLabel: string;
        showCompare?: boolean;
    }) => {
        const [search, setSearch] = useState('');
        const [page, setPage] = useState(1);
        const rowsPerPage = 10;
        const valueColWidth = showCompare ? '5.75rem' : '6.75rem';
        const deltaColWidth = '6.5rem';

        const formatMetricValue = (value: number) => {
            if (submittedMetricType === 'proportion') {
                return `${(value * 100).toFixed(1)}%`;
            }
            return Math.round(value).toLocaleString('nb-NO');
        };

        const formatMetricDelta = (value: number) => {
            if (submittedMetricType === 'proportion') {
                return `${value >= 0 ? '+' : ''}${(value * 100).toFixed(1)} pp`;
            }
            return `${value >= 0 ? '+' : ''}${Math.round(value).toLocaleString('nb-NO')}`;
        };

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

            const headers = showCompare
                ? ['URL-sti', metricLabel, 'Forrige', 'Endring']
                : ['URL-sti', metricLabel];
            const csvRows = [
                headers.join(','),
                ...data.map((item) => {
                    const baseRow = [
                        item.name, // URL-sti name
                        formatMetricValue(item.count)
                    ];
                    if (showCompare) {
                        baseRow.push(formatMetricValue(item.previousCount || 0));
                        baseRow.push(formatMetricDelta(item.deltaCount || 0));
                    }
                    return baseRow.join(',');
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
                    <Table
                        size="small"
                        className="table-fixed w-full [&_th:first-child]:!pl-2 [&_th:first-child]:!pr-2 [&_td:first-child]:!pl-2 [&_td:first-child]:!pr-2"
                    >
                        <colgroup>
                            <col style={{ width: valueColWidth }} />
                            {showCompare && <col style={{ width: valueColWidth }} />}
                            {showCompare && <col style={{ width: deltaColWidth }} />}
                            <col />
                        </colgroup>
                        <Table.Header>
                            <Table.Row>
                                <Table.HeaderCell align="right" className="whitespace-normal leading-tight" style={{ width: valueColWidth, minWidth: valueColWidth }}>
                                    {metricLabel}
                                </Table.HeaderCell>
                                {showCompare && (
                                    <Table.HeaderCell align="right" className="whitespace-normal leading-tight" style={{ width: valueColWidth, minWidth: valueColWidth }}>
                                        Forrige
                                    </Table.HeaderCell>
                                )}
                                {showCompare && (
                                    <Table.HeaderCell align="right" className="whitespace-normal leading-tight" style={{ width: deltaColWidth, minWidth: deltaColWidth }}>
                                        Endring
                                    </Table.HeaderCell>
                                )}
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
                                    <Table.DataCell align="right" className="tabular-nums" style={{ width: valueColWidth, minWidth: valueColWidth }}>
                                        {formatMetricValue(row.count)}
                                    </Table.DataCell>
                                    {showCompare && (
                                        <Table.DataCell align="right" className="tabular-nums" style={{ width: valueColWidth, minWidth: valueColWidth }}>
                                            {formatMetricValue(row.previousCount || 0)}
                                        </Table.DataCell>
                                    )}
                                    {showCompare && (
                                        <Table.DataCell
                                            align="right"
                                            className={`tabular-nums font-medium ${((row.deltaCount || 0) > 0) ? 'text-green-700' : ((row.deltaCount || 0) < 0) ? 'text-red-700' : ''}`}
                                            style={{ width: deltaColWidth, minWidth: deltaColWidth }}
                                        >
                                            {formatMetricDelta(row.deltaCount || 0)}
                                        </Table.DataCell>
                                    )}
                                    <Table.DataCell className="max-w-[13rem] sm:max-w-md" title={row.name}>
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
                                    <Table.DataCell colSpan={showCompare ? 4 : 2} align="center">
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

    const ChartDataTable = ({
        data,
        previousData,
        metricLabel,
        submittedDateRange,
        submittedPreviousDateRange
    }: {
        data: SeriesPoint[];
        previousData: SeriesPoint[];
        metricLabel: string;
        submittedDateRange: { startDate: Date; endDate: Date } | null;
        submittedPreviousDateRange: { startDate: Date; endDate: Date } | null;
    }) => {
        const [search, setSearch] = useState('');
        const [page, setPage] = useState(1);
        const rowsPerPage = 10;

        const formatMetricValue = (value: number) => {
            if (submittedMetricType === 'proportion') {
                return `${(value * 100).toFixed(1)}%`;
            }
            return Math.round(value).toLocaleString('nb-NO');
        };

        const formatMetricDelta = (value: number) => {
            if (submittedMetricType === 'proportion') {
                return `${value >= 0 ? '+' : ''}${(value * 100).toFixed(1)} pp`;
            }
            return `${value >= 0 ? '+' : ''}${Math.round(value).toLocaleString('nb-NO')}`;
        };

        const formatTime = (time: string) => {
            if (submittedGranularity === 'hour') {
                return `${new Date(time).toLocaleDateString('nb-NO')} ${new Date(time).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })}`;
            }
            return new Date(time).toLocaleDateString('nb-NO');
        };

        const shouldShowCompareColumns = Boolean(
            submittedComparePreviousPeriod &&
            previousData.length &&
            submittedDateRange &&
            submittedPreviousDateRange
        );

        const previousByShiftedTime = useMemo(() => {
            const map = new Map<string, number>();

            if (!shouldShowCompareColumns || !submittedDateRange || !submittedPreviousDateRange) {
                return map;
            }

            const offsetMs = submittedDateRange.startDate.getTime() - submittedPreviousDateRange.startDate.getTime();
            previousData.forEach((item: SeriesPoint) => {
                const shiftedIso = new Date(new Date(item.time).getTime() + offsetMs).toISOString();
                map.set(shiftedIso, Number(item.count) || 0);
            });

            return map;
        }, [shouldShowCompareColumns, previousData, submittedDateRange, submittedPreviousDateRange]);

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
                    <Heading level="3" size="small">Oversikt</Heading>
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
                    <Table size="small" className="table-fixed w-full">
                        <Table.Header>
                            <Table.Row>
                                <Table.HeaderCell>{submittedGranularity === 'hour' ? 'Tidspunkt' : 'Dato'}</Table.HeaderCell>
                                <Table.HeaderCell align="right">{metricLabel}</Table.HeaderCell>
                                {shouldShowCompareColumns && (
                                    <Table.HeaderCell align="right">Forrige</Table.HeaderCell>
                                )}
                                {shouldShowCompareColumns && (
                                    <Table.HeaderCell align="right">Endring</Table.HeaderCell>
                                )}
                            </Table.Row>
                        </Table.Header>
                        <Table.Body>
                            {paginatedData.map((item, index) => (
                                (() => {
                                    const currentValue = Number(item.count) || 0;
                                    const previousValue = previousByShiftedTime.get(new Date(item.time).toISOString());
                                    const hasPreviousValue = typeof previousValue === 'number';
                                    const deltaValue = hasPreviousValue ? currentValue - previousValue : null;

                                    return (
                                        <Table.Row key={index}>
                                            <Table.DataCell>
                                                {formatTime(item.time)}
                                            </Table.DataCell>
                                            <Table.DataCell align="right" className="tabular-nums">
                                                {formatMetricValue(currentValue)}
                                            </Table.DataCell>
                                            {shouldShowCompareColumns && (
                                                <Table.DataCell align="right" className="tabular-nums">
                                                    {hasPreviousValue ? formatMetricValue(previousValue) : '-'}
                                                </Table.DataCell>
                                            )}
                                            {shouldShowCompareColumns && (
                                                <Table.DataCell
                                                    align="right"
                                                    className={`tabular-nums font-medium ${deltaValue && deltaValue > 0 ? 'text-green-700' : deltaValue && deltaValue < 0 ? 'text-red-700' : ''}`}
                                                >
                                                    {deltaValue === null ? '-' : formatMetricDelta(deltaValue)}
                                                </Table.DataCell>
                                            )}
                                        </Table.Row>
                                    );
                                })()
                            ))}
                            {filteredData.length === 0 && (
                                <Table.Row>
                                    <Table.DataCell colSpan={shouldShowCompareColumns ? 4 : 2} align="center">
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
            description="Se besøk over tid, hvor de kommer fra og hvor de går videre."
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
                                ? getVisitorLabelWithBadge()
                                : 'Unike besøkende'}</option>
                            <option value="visits">Økter / besøk</option>
                            <option value="pageviews">Sidevisninger</option>
                            <option value="proportion">Andel (av besøkende)</option>
                        </Select>
                    </div>

                    <div className="flex items-end pb-[2px]">
                        <Button
                            onClick={fetchSeriesData}
                            disabled={!selectedWebsite || loading || !hasUnappliedFilterChanges}
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
                                <Tabs.Tab value="visits" label="Oversikt" />
                                <Tabs.Tab value="sources" label="Inn- og utganger" />
                            </Tabs.List>

                            <Tabs.Panel value="visits" className="pt-4">
                                <OversiktTabContent
                                    hasAttemptedFetch={hasAttemptedFetch}
                                    isLoadingPageMetrics={isLoadingPageMetrics}
                                    hasFetchedPageMetrics={hasFetchedPageMetrics}
                                    submittedComparePreviousPeriod={submittedComparePreviousPeriod}
                                    comparisonSummary={comparisonSummary}
                                    comparisonRangeLabel={comparisonRangeLabel}
                                    submittedDateRange={submittedDateRange}
                                    submittedPreviousDateRange={submittedPreviousDateRange}
                                    formatComparisonValue={formatComparisonValue}
                                    formatComparisonDelta={formatComparisonDelta}
                                    seriesData={seriesData}
                                    submittedMetricType={submittedMetricType}
                                    totalOverride={totalOverride}
                                    submittedGranularity={submittedGranularity}
                                    showAverage={showAverage}
                                    onShowAverageChange={setShowAverage}
                                    comparePreviousPeriod={comparePreviousPeriod}
                                    onComparePreviousPeriodChange={setComparePreviousPeriod}
                                    granularity={granularity}
                                    onGranularityChange={setGranularity}
                                    chartData={chartData?.data ?? null}
                                    chartYMax={chartData?.yMax ?? 0}
                                    chartYMin={chartData?.yMin ?? 0}
                                    chartKey={`${submittedMetricType}-${submittedPeriod}-${seriesData.length}-${previousSeriesData.length}-${submittedComparePreviousPeriod ? 'compare' : 'single'}`}
                                    processedSeriesData={processedSeriesData}
                                    processedPreviousSeriesData={processedPreviousSeriesData}
                                    getMetricLabelWithCount={getMetricLabelWithCount}
                                    includedPagesWithCompare={includedPagesWithCompare}
                                    onSelectInternalUrl={setSelectedInternalUrl}
                                    selectedWebsite={selectedWebsite}
                                    getMetricLabelCapitalized={getMetricLabelCapitalized}
                                    ChartDataTableComponent={ChartDataTable}
                                    TrafficTableComponent={TrafficTable}
                                />
                            </Tabs.Panel>

                            <Tabs.Panel value="sources" className="pt-4">
                                <InnOgUtgangerTabContent
                                    hasAttemptedFetch={hasAttemptedFetch}
                                    isLoadingExternalReferrers={isLoadingExternalReferrers}
                                    hasFetchedExternalReferrers={hasFetchedExternalReferrers}
                                    isLoadingBreakdown={isLoadingBreakdown}
                                    hasFetchedBreakdown={hasFetchedBreakdown}
                                    combinedEntrances={combinedEntrances}
                                    entranceSummaryWithUnknown={entranceSummaryWithUnknown}
                                    exits={exits}
                                    selectedWebsite={selectedWebsite}
                                    metricLabel={getMetricLabelCapitalized(submittedMetricType)}
                                    onSelectInternalUrl={setSelectedInternalUrl}
                                    onNavigateToJourney={() => {
                                        const params = new URLSearchParams();
                                        if (selectedWebsite?.id) params.set('websiteId', selectedWebsite.id);
                                        if (period) params.set('period', period);
                                        if (urlPaths.length > 0) params.set('urlPath', urlPaths[0]);
                                        navigate(`/brukerreiser?${params.toString()}`);
                                    }}
                                    CombinedEntrancesTableComponent={CombinedEntrancesTable}
                                    ExternalTrafficTableComponent={ExternalTrafficTable}
                                    TrafficTableComponent={TrafficTable}
                                />
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

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Heading, Button, Alert, Loader, BodyShort, Table, Tabs, Skeleton, Switch, TextField } from '@navikt/ds-react';
import { LineChart, ResponsiveContainer } from '@fluentui/react-charting';
import { Download, ArrowLeft, Share2, Check } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import ChartLayout from '../../analysis/ui/ChartLayout.tsx';
import WebsitePicker from '../../analysis/ui/WebsitePicker.tsx';
import PeriodPicker from '../../analysis/ui/PeriodPicker.tsx';
import UrlPathFilter from '../../analysis/ui/UrlPathFilter.tsx';
import type { Website } from '../../../shared/types/chart.ts';
import type { ILineChartProps } from '@fluentui/react-charting';
import { normalizeUrlToPath, getDateRangeFromPeriod, getStoredPeriod, savePeriodPreference } from '../../../shared/lib/utils.ts';


const EventExplorer = () => {
    const [selectedWebsite, setSelectedWebsite] = useState<Website | null>(null);
    const [searchParams] = useSearchParams();

    // Initialize state from URL params - support multiple paths
    const pathsFromUrl = searchParams.getAll('urlPath');
    const legacyPath = searchParams.get('pagePath');
    const initialPaths = pathsFromUrl.length > 0
        ? pathsFromUrl.map(p => normalizeUrlToPath(p)).filter(Boolean)
        : (legacyPath ? [normalizeUrlToPath(legacyPath)].filter(Boolean) : []);
    const [urlPaths, setUrlPaths] = useState<string[]>(initialPaths);
    const [pathOperator, setPathOperator] = useState<string>(() => searchParams.get('pathOperator') || 'equals');
    const [selectedEvent, setSelectedEvent] = useState<string>(() => searchParams.get('event') || '');
    const [events, setEvents] = useState<{ name: string; count: number }[]>([]);
    const [loadingEvents, setLoadingEvents] = useState<boolean>(false);
    const [period, setPeriodState] = useState<string>(() => getStoredPeriod(searchParams.get('period')));

    // Wrap setPeriod to also save to localStorage
    const setPeriod = (newPeriod: string) => {
        setPeriodState(newPeriod);
        savePeriodPreference(newPeriod);
    };

    // Support custom dates from URL
    const fromDateFromUrl = searchParams.get("from");
    const toDateFromUrl = searchParams.get("to");
    const initialCustomStartDate = fromDateFromUrl ? parseISO(fromDateFromUrl) : undefined;
    const initialCustomEndDate = toDateFromUrl ? parseISO(toDateFromUrl) : undefined;

    const [customStartDate, setCustomStartDate] = useState<Date | undefined>(initialCustomStartDate);
    const [customEndDate, setCustomEndDate] = useState<Date | undefined>(initialCustomEndDate);
    const [hasSearched, setHasSearched] = useState<boolean>(false);
    const [showAverage, setShowAverage] = useState<boolean>(false);
    const [showTrendTable, setShowTrendTable] = useState<boolean>(false);

    type SeriesPoint = {
        time: string;
        count: number;
    };

    type EventProperty = {
        propertyName: string;
        total: number;
    };

    type QueryStats = {
        totalBytesProcessedGB?: number;
        estimatedCostUSD?: number;
    };

    type ParameterValue = {
        value: string;
        count: number;
    };

    type LatestEvent = {
        created_at: string;
        properties?: Record<string, string | undefined>;
    };

    type EventsResponse = {
        events?: { name: string; count: number }[];
        queryStats?: QueryStats;
    };

    type SeriesResponse = {
        data?: SeriesPoint[];
    };

    type PropertiesResponse = {
        properties?: EventProperty[];
        gbProcessed?: number | string;
    };

    type ParameterValuesResponse = {
        values?: ParameterValue[];
        queryStats?: QueryStats;
    };

    type LatestEventsResponse = {
        events?: LatestEvent[];
    };

    const isRecord = (value: unknown): value is Record<string, unknown> => {
        return typeof value === 'object' && value !== null;
    };

    const isSeriesPoint = (value: unknown): value is SeriesPoint => {
        return isRecord(value)
            && typeof value.time === 'string'
            && typeof value.count === 'number';
    };

    const isEventProperty = (value: unknown): value is EventProperty => {
        return isRecord(value)
            && typeof value.propertyName === 'string'
            && typeof value.total === 'number';
    };

    const isParameterValue = (value: unknown): value is ParameterValue => {
        return isRecord(value)
            && typeof value.value === 'string'
            && typeof value.count === 'number';
    };

    const isLatestEvent = (value: unknown): value is LatestEvent => {
        return isRecord(value)
            && typeof value.created_at === 'string'
            && (!('properties' in value) || value.properties === undefined || isRecord(value.properties));
    };

    const parseQueryStats = (value: unknown): QueryStats | null => {
        if (!isRecord(value)) return null;
        const totalBytesProcessedGB = typeof value.totalBytesProcessedGB === 'number'
            ? value.totalBytesProcessedGB
            : undefined;
        const estimatedCostUSD = typeof value.estimatedCostUSD === 'number'
            ? value.estimatedCostUSD
            : undefined;
        return totalBytesProcessedGB !== undefined || estimatedCostUSD !== undefined
            ? { totalBytesProcessedGB, estimatedCostUSD }
            : null;
    };

    const parseEventsResponse = (value: unknown): EventsResponse => {
        if (!isRecord(value)) return {};
        const events = Array.isArray(value.events)
            ? value.events.filter(item => isRecord(item) && typeof item.name === 'string' && typeof item.count === 'number')
            : undefined;
        const queryStats = parseQueryStats(value.queryStats) ?? undefined;
        return { events, queryStats };
    };

    const parseSeriesResponse = (value: unknown): SeriesResponse => {
        if (!isRecord(value)) return {};
        const data = Array.isArray(value.data) ? value.data.filter(isSeriesPoint) : undefined;
        return { data };
    };

    const parsePropertiesResponse = (value: unknown): PropertiesResponse => {
        if (!isRecord(value)) return {};
        const properties = Array.isArray(value.properties) ? value.properties.filter(isEventProperty) : undefined;
        const gbProcessed = typeof value.gbProcessed === 'number' || typeof value.gbProcessed === 'string'
            ? value.gbProcessed
            : undefined;
        return { properties, gbProcessed };
    };

    const parseParameterValuesResponse = (value: unknown): ParameterValuesResponse => {
        if (!isRecord(value)) return {};
        const values = Array.isArray(value.values) ? value.values.filter(isParameterValue) : undefined;
        const queryStats = parseQueryStats(value.queryStats) ?? undefined;
        return { values, queryStats };
    };

    const parseLatestEventsResponse = (value: unknown): LatestEventsResponse => {
        if (!isRecord(value)) return {};
        const events = Array.isArray(value.events) ? value.events.filter(isLatestEvent) : undefined;
        return { events };
    };

    // Data states
    const [seriesData, setSeriesData] = useState<SeriesPoint[]>([]);
    const [propertiesData, setPropertiesData] = useState<EventProperty[]>([]);
    const [loadingData, setLoadingData] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [queryStats, setQueryStats] = useState<QueryStats | null>(null);
    const [eventsQueryStats, setEventsQueryStats] = useState<QueryStats | null>(null);

    // Parameter values state - now storing values for ALL parameters
    const [allParameterValues, setAllParameterValues] = useState<Record<string, ParameterValue[]>>({});
    const [loadingValues, setLoadingValues] = useState<boolean>(false);
    const [hasLoadedValues, setHasLoadedValues] = useState<boolean>(false);
    const [parameterValuesTab, setParameterValuesTab] = useState<string>('latest');
    const [latestEvents, setLatestEvents] = useState<LatestEvent[]>([]);
    const [selectedParameterForDrilldown, setSelectedParameterForDrilldown] = useState<string | null>(null);
    const [parameterValuesQueryStats, setParameterValuesQueryStats] = useState<QueryStats | null>(null);
    const [copySuccess, setCopySuccess] = useState<boolean>(false);
    const [hasAutoSubmitted, setHasAutoSubmitted] = useState<boolean>(false);
    const [eventSearch, setEventSearch] = useState<string>('');
    const [lastAppliedFilterKey, setLastAppliedFilterKey] = useState<string | null>(null);

    const buildFilterKey = useCallback(() =>
        JSON.stringify({
            websiteId: selectedWebsite?.id ?? null,
            urlPaths,
            pathOperator,
            period,
            customStartDate: customStartDate?.toISOString() ?? null,
            customEndDate: customEndDate?.toISOString() ?? null,
        }), [selectedWebsite?.id, urlPaths, pathOperator, period, customStartDate, customEndDate]);
    const hasUnappliedFilterChanges = buildFilterKey() !== lastAppliedFilterKey;

    // Calculate dates based on selection using centralized utility
    const getDates = useCallback(() => {
        const dateRange = getDateRangeFromPeriod(period, customStartDate, customEndDate);
        if (!dateRange) {
            throw new Error('Vennligst velg en gyldig periode.');
        }
        return { startAt: dateRange.startDate, endAt: dateRange.endDate };
    }, [period, customStartDate, customEndDate]);

    // Fetch available events (triggered by button)
    const fetchEvents = useCallback(async () => {
        if (!selectedWebsite) return;
        const appliedFilterKey = buildFilterKey();

        setLoadingEvents(true);
        setHasSearched(true);
        setEvents([]);
        setSelectedEvent('');
        setSeriesData([]);
        setPropertiesData([]);
        setError(null);

        try {
            const { startAt, endAt } = getDates();
            const params = new URLSearchParams({
                startAt: startAt.getTime().toString(),
                endAt: endAt.getTime().toString()
            });
            const pagePath = urlPaths.length > 0 ? urlPaths[0] : '';
            if (pagePath) {
                params.append('urlPath', pagePath);
                params.append('pathOperator', pathOperator);
            }

            const response = await fetch(`/api/bigquery/websites/${selectedWebsite.id}/events?${params.toString()}`);
            if (!response.ok) throw new Error('Failed to fetch events');

            const result = await response.json() as unknown;
            const parsed = parseEventsResponse(result);
            setEvents(parsed.events ?? []);
            if (parsed.queryStats) {
                setEventsQueryStats(parsed.queryStats);
            }

            // Update URL with configuration for sharing
            const newParams = new URLSearchParams(window.location.search);
            newParams.set('period', period);
            // Handle multiple paths in URL
            newParams.delete('urlPath');
            newParams.delete('pagePath');
            if (urlPaths.length > 0) {
                urlPaths.forEach(p => newParams.append('urlPath', p));
                newParams.set('pathOperator', pathOperator);
            } else {
                newParams.delete('pathOperator');
            }

            // Persist custom dates
            if (period === 'custom' && customStartDate && customEndDate) {
                newParams.set('from', format(customStartDate, 'yyyy-MM-dd'));
                newParams.set('to', format(customEndDate, 'yyyy-MM-dd'));
            } else {
                newParams.delete('from');
                newParams.delete('to');
            }

            // Update URL without navigation
            window.history.replaceState({}, '', `${window.location.pathname}?${newParams.toString()}`);
            setLastAppliedFilterKey(appliedFilterKey);
        } catch (err) {
            console.error('Error fetching events:', err);
            setError((err as Error).message || 'Kunne ikke hente hendelser.');
        } finally {
            setLoadingEvents(false);
        }
    }, [selectedWebsite, buildFilterKey, getDates, urlPaths, pathOperator, period, customStartDate, customEndDate]);

    // Auto-submit when website is selected (from localStorage, URL, or Home page picker)
    useEffect(() => {
        if (selectedWebsite && !hasAutoSubmitted && !loadingEvents) {
            setHasAutoSubmitted(true);
            void fetchEvents();
        }
    }, [selectedWebsite, hasAutoSubmitted, loadingEvents, fetchEvents]);

    const copyShareLink = async () => {
        try {
            await navigator.clipboard.writeText(window.location.href);
            setCopySuccess(true);
            setTimeout(() => setCopySuccess(false), 2000);
        } catch (err) {
            console.error('Failed to copy link:', err);
        }
    };

    // Fetch data when an event is selected
    const fetchEventData = useCallback(async () => {
        if (!selectedWebsite || !selectedEvent) return;

        setLoadingData(true);
        setError(null);
        setSeriesData([]);
        setPropertiesData([]);
        setQueryStats(null);
        setAllParameterValues({});
        setHasLoadedValues(false);

        try {
            const { startAt, endAt } = getDates();

            // Fetch Series Data
            const seriesParams = new URLSearchParams({
                eventName: selectedEvent,
                interval: 'day',
                startAt: startAt.getTime().toString(),
                endAt: endAt.getTime().toString()
            });
            const pagePath = urlPaths.length > 0 ? urlPaths[0] : '';
            if (pagePath) {
                seriesParams.append('urlPath', pagePath);
                seriesParams.append('pathOperator', pathOperator);
            }

            const seriesResponse = await fetch(`/api/bigquery/websites/${selectedWebsite.id}/event-series?${seriesParams.toString()}`);
            if (!seriesResponse.ok) throw new Error('Failed to fetch event series');
            const seriesResult = await seriesResponse.json() as unknown;
            const parsedSeries = parseSeriesResponse(seriesResult);
            setSeriesData(parsedSeries.data ?? []);

            // Fetch Properties Data
            const propsParams = new URLSearchParams({
                eventName: selectedEvent,
                includeParams: 'true',
                startAt: startAt.getTime().toString(),
                endAt: endAt.getTime().toString()
            });
            if (pagePath) {
                propsParams.append('urlPath', pagePath);
                propsParams.append('pathOperator', pathOperator);
            }

            const propsResponse = await fetch(`/api/bigquery/websites/${selectedWebsite.id}/event-properties?${propsParams.toString()}`);
            if (!propsResponse.ok) throw new Error('Failed to fetch event properties');
            const propsResult = await propsResponse.json() as unknown;
            const parsedProps = parsePropertiesResponse(propsResult);

            setPropertiesData(parsedProps.properties ?? []);
            if (parsedProps.gbProcessed !== undefined) {
                const gbProcessed = Number(parsedProps.gbProcessed);
                setQueryStats({
                    totalBytesProcessedGB: Number.isFinite(gbProcessed) ? gbProcessed : undefined,
                    estimatedCostUSD: Number.isFinite(gbProcessed)
                        ? parseFloat(((gbProcessed / 1024) * 6.25).toFixed(3))
                        : undefined
                });
            }

            // Update URL with selected event for sharing
            const newParams = new URLSearchParams(window.location.search);
            newParams.set('period', period);
            newParams.set('event', selectedEvent);
            // Handle multiple paths in URL
            newParams.delete('urlPath');
            newParams.delete('pagePath');
            if (urlPaths.length > 0) {
                urlPaths.forEach(p => newParams.append('urlPath', p));
                newParams.set('pathOperator', pathOperator);
            } else {
                newParams.delete('pathOperator');
            }

            // Persist custom dates
            if (period === 'custom' && customStartDate && customEndDate) {
                newParams.set('from', format(customStartDate, 'yyyy-MM-dd'));
                newParams.set('to', format(customEndDate, 'yyyy-MM-dd'));
            } else {
                newParams.delete('from');
                newParams.delete('to');
            }

            // Update URL without navigation
            window.history.replaceState({}, '', `${window.location.pathname}?${newParams.toString()}`);


        } catch (err) {
            console.error('Error fetching data:', err);
            setError('Det oppstod en feil ved henting av data.');
        } finally {
            setLoadingData(false);
        }
    }, [selectedWebsite, selectedEvent, getDates, urlPaths, pathOperator, period, customStartDate, customEndDate]);

    useEffect(() => {
        void fetchEventData();
    }, [fetchEventData]);

    // Fetch values for ALL parameters
    const fetchAllParameterValues = useCallback(async () => {
        if (!selectedWebsite || !selectedEvent || propertiesData.length === 0) return;

        setLoadingValues(true);
        setAllParameterValues({});

        try {
            const { startAt, endAt } = getDates();

            // Fetch values for all parameters in parallel
            const fetchPromises = propertiesData.map(async (prop) => {
                const params = new URLSearchParams({
                    eventName: selectedEvent,
                    parameterName: prop.propertyName,
                    startAt: startAt.getTime().toString(),
                    endAt: endAt.getTime().toString()
                });
                const pagePath = urlPaths.length > 0 ? urlPaths[0] : '';
                if (pagePath) {
                    params.append('urlPath', pagePath);
                    params.append('pathOperator', pathOperator);
                }

                const response = await fetch(`/api/bigquery/websites/${selectedWebsite.id}/event-parameter-values?${params.toString()}`);
                if (!response.ok) throw new Error(`Failed to fetch values for ${prop.propertyName}`);

                const result = await response.json() as unknown;
                const parsed = parseParameterValuesResponse(result);
                return {
                    parameterName: prop.propertyName,
                    values: parsed.values ?? [],
                    queryStats: parsed.queryStats ?? undefined
                };
            });

            const results = await Promise.all(fetchPromises);

            // Convert array to object for easier lookup
            const valuesMap: Record<string, ParameterValue[]> = {};
            let combinedQueryStats: QueryStats | null = null;
            results.forEach(result => {
                valuesMap[result.parameterName] = result.values;
                // Store the first queryStats we find (they should all be similar)
                if (!combinedQueryStats && result.queryStats) {
                    combinedQueryStats = result.queryStats;
                }
            });

            setAllParameterValues(valuesMap);
            setParameterValuesQueryStats(combinedQueryStats);

            // Also fetch latest 20 events
            const latestParams = new URLSearchParams({
                eventName: selectedEvent,
                startAt: startAt.getTime().toString(),
                endAt: endAt.getTime().toString(),
                limit: '20'
            });
            const latestPagePath = urlPaths.length > 0 ? urlPaths[0] : '';
            if (latestPagePath) {
                latestParams.append('urlPath', latestPagePath);
                latestParams.append('pathOperator', pathOperator);
            }

            console.log('Fetching latest events with params:', latestParams.toString());
            const latestResponse = await fetch(`/api/bigquery/websites/${selectedWebsite.id}/event-latest?${latestParams.toString()}`);
            console.log('Latest events response status:', latestResponse.status);
            if (latestResponse.ok) {
                const latestResult = await latestResponse.json() as unknown;
                const parsedLatest = parseLatestEventsResponse(latestResult);
                setLatestEvents(parsedLatest.events ?? []);
            } else {
                const errorText = await latestResponse.text();
                console.error('Failed to fetch latest events:', errorText);
            }

            setHasLoadedValues(true);
        } catch (err) {
            console.error('Error fetching parameter values:', err);
            setError('Kunne ikke hente parameterverdier.');
        } finally {
            setLoadingValues(false);
        }
    }, [selectedWebsite, selectedEvent, propertiesData, getDates, urlPaths, pathOperator]);

    // Auto-fetch values when drilling down into a parameter
    useEffect(() => {
        if (selectedParameterForDrilldown && !hasLoadedValues && !loadingValues) {
            void fetchAllParameterValues();
        }
    }, [selectedParameterForDrilldown, hasLoadedValues, loadingValues, fetchAllParameterValues]);


    const prepareLineChartData = (includeAverage: boolean = false): ILineChartProps | null => {
        if (!seriesData.length) return null;

        const dataPoints = seriesData.map(item => ({
            x: new Date(item.time),
            y: item.count
        }));

        const lineChartData: { legend: string; data: { x: Date; y: number }[]; color: string; lineOptions?: { lineBorderWidth: number } }[] = [{
            legend: selectedEvent,
            data: dataPoints,
            color: '#0067c5'
        }];

        // Add average line if requested
        if (includeAverage && dataPoints.length > 0) {
            const sum = dataPoints.reduce((acc, point) => acc + point.y, 0);
            const average = sum / dataPoints.length;

            lineChartData.push({
                legend: 'Gjennomsnitt',
                data: dataPoints.map(point => ({
                    x: point.x,
                    y: average
                })),
                color: '#ff6b6b',
                lineOptions: {
                    lineBorderWidth: 2
                }
            });
        }

        return {
            data: {
                lineChartData
            }
        };
    };



    const handleBackToEvents = () => {
        setSelectedEvent('');
        setSeriesData([]);
        setPropertiesData([]);
        setSelectedParameterForDrilldown(null);
    };

    return (
        <ChartLayout
            title="Egendefinerte hendelser"
            description="Utforsk egendefinerte hendelser."
            currentPage="event-explorer"
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
                        className="w-full sm:w-[300px]"
                        label="URL"
                        showOperator={true}

                    />

                    <PeriodPicker
                        period={period}
                        onPeriodChange={setPeriod}
                        startDate={customStartDate}
                        onStartDateChange={setCustomStartDate}
                        endDate={customEndDate}
                        onEndDateChange={setCustomEndDate}
                    />

                    <div className="w-full sm:w-auto self-end pb-[2px]">
                        <Button
                            onClick={fetchEvents}
                            disabled={!selectedWebsite || loadingEvents || !hasUnappliedFilterChanges}
                            loading={loadingEvents}
                            size="small"
                        >
                            Vis hendelser
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

            {loadingEvents && (
                <div className="flex justify-center items-center h-full">
                    <Loader size="xlarge" title="Henter hendelser..." />
                </div>
            )}
            {
                !selectedEvent && !loadingEvents && hasSearched && events.length > 0 && (() => {
                    const filteredEvents = events.filter(event =>
                        event.name.toLowerCase().includes(eventSearch.toLowerCase())
                    );
                    return (
                        <div>
                            <div className="flex justify-between items-end mb-4">
                                <Heading level="3" size="small">Egendefinerte hendelser</Heading>
                                <div className="w-64">
                                    <TextField
                                        label="Søk"
                                        hideLabel
                                        placeholder="Søk..."
                                        size="small"
                                        value={eventSearch}
                                        onChange={(e) => setEventSearch(e.target.value)}
                                    />
                                </div>
                            </div>
                            <div className="border rounded-lg overflow-hidden">
                                <div className="overflow-x-auto">
                                    <Table size="small">
                                        <Table.Header>
                                            <Table.Row>
                                                <Table.HeaderCell>Navn</Table.HeaderCell>
                                                <Table.HeaderCell align="right">Antall tilfeller</Table.HeaderCell>
                                                <Table.HeaderCell></Table.HeaderCell>
                                            </Table.Row>
                                        </Table.Header>
                                        <Table.Body>
                                            {filteredEvents.map((event) => (
                                                <Table.Row key={event.name}>
                                                    <Table.DataCell>{event.name}</Table.DataCell>
                                                    <Table.DataCell align="right">{event.count.toLocaleString('nb-NO')}</Table.DataCell>
                                                    <Table.DataCell>
                                                        <Button
                                                            size="xsmall"
                                                            variant="secondary"
                                                            onClick={() => setSelectedEvent(event.name)}
                                                        >
                                                            Utforsk
                                                        </Button>
                                                    </Table.DataCell>
                                                </Table.Row>
                                            ))}
                                        </Table.Body>
                                    </Table>
                                </div>
                                <div className="flex gap-2 p-3 bg-[var(--ax-bg-neutral-soft)] border-t justify-between items-center">
                                    <div className="flex gap-2">
                                        <Button
                                            size="small"
                                            variant="secondary"
                                            onClick={() => {
                                                const headers = ['Hendelsesnavn', 'Antall'];
                                                const csvRows = [
                                                    headers.join(','),
                                                    ...filteredEvents.map((event) => [
                                                        `"${event.name}"`,
                                                        event.count
                                                    ].join(','))
                                                ];
                                                const csvContent = csvRows.join('\n');
                                                const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
                                                const link = document.createElement('a');
                                                const url = URL.createObjectURL(blob);
                                                link.setAttribute('href', url);
                                                link.setAttribute('download', `hendelser_${selectedWebsite?.name || 'data'}_${new Date().toISOString().slice(0, 10)}.csv`);
                                                link.style.visibility = 'hidden';
                                                document.body.appendChild(link);
                                                link.click();
                                                document.body.removeChild(link);
                                                URL.revokeObjectURL(url);
                                            }}
                                            icon={<Download size={16} />}
                                        >
                                            Last ned CSV
                                        </Button>
                                    </div>
                                    {eventsQueryStats && (
                                        <span className="text-sm text-[var(--ax-text-subtle)]">
                                            Data prosessert: {eventsQueryStats.totalBytesProcessedGB} GB
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })()
            }
            {/* Event Details View */}
            {
                selectedEvent && (
                    <div className="space-y-6">
                        <div className="flex items-center gap-4 mb-4">
                            <Button
                                variant="tertiary"
                                size="small"
                                icon={<ArrowLeft aria-hidden />}
                                onClick={handleBackToEvents}
                            >
                                Alle hendelser
                            </Button>
                        </div>

                        <Heading level="2" size="medium">Hendelse: {selectedEvent}</Heading>

                        {loadingData && (
                            <div className="flex justify-center items-center h-64">
                                <Loader size="xlarge" title="Henter data..." />
                            </div>
                        )}

                        {!loadingData && seriesData.length > 0 && (
                            <div className="flex flex-col gap-8">
                                <div className="flex flex-col gap-4">
                                    <div className="flex justify-end gap-6 -mb-5">
                                        <Switch
                                            checked={showTrendTable}
                                            onChange={(e) => setShowTrendTable(e.target.checked)}
                                            size="small"
                                        >
                                            Vis tabell
                                        </Switch>
                                        <Switch
                                            checked={showAverage}
                                            onChange={(e) => setShowAverage(e.target.checked)}
                                            size="small"
                                        >
                                            Vis gjennomsnitt
                                        </Switch>
                                    </div>
                                    <div style={{ width: '100%', height: '400px' }}>
                                        {(() => {
                                            const chartData = prepareLineChartData(showAverage);
                                            return chartData ? (
                                                <ResponsiveContainer>
                                                    <LineChart
                                                        data={chartData.data}
                                                        legendsOverflowText={'Overflow Items'}
                                                        yAxisTickFormat={(d: number | string) => Number(d).toLocaleString('nb-NO')}
                                                        yAxisTickCount={10}
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
                                            );
                                        })()}
                                    </div>
                                </div>

                                {showTrendTable && (
                                    <div className="border rounded-lg overflow-hidden">
                                        <div className="overflow-x-auto">
                                            <table className="min-w-full divide-y divide-[var(--ax-border-neutral-subtle)]">
                                                <thead className="bg-[var(--ax-bg-neutral-soft)]">
                                                    <tr>
                                                        <th className="px-6 py-3 text-left text-xs font-medium text-[var(--ax-text-default)] uppercase tracking-wider">Dato</th>
                                                        <th className="px-6 py-3 text-left text-xs font-medium text-[var(--ax-text-default)] uppercase tracking-wider">Antall</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="bg-[var(--ax-bg-default)] divide-y divide-[var(--ax-border-neutral-subtle)]">
                                                    {seriesData.map((item, index) => (
                                                        <tr key={index} className="hover:bg-[var(--ax-bg-neutral-soft]">
                                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-[var(--ax-text-default)]">
                                                                {new Date(item.time).toLocaleDateString('nb-NO')}
                                                            </td>
                                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--ax-text-default)]">
                                                                {item.count.toLocaleString('nb-NO')}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                        <div className="flex gap-2 p-3 bg-[var(--ax-bg-neutral-soft)] border-t justify-between items-center">
                                            <div className="flex gap-2">
                                                <Button
                                                    size="small"
                                                    variant="secondary"
                                                    onClick={() => {
                                                        const headers = ['Dato', 'Antall'];
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
                                                        link.setAttribute('download', `${selectedEvent}_${new Date().toISOString().slice(0, 10)}.csv`);
                                                        link.style.visibility = 'hidden';
                                                        document.body.appendChild(link);
                                                        link.click();
                                                        document.body.removeChild(link);
                                                        URL.revokeObjectURL(url);
                                                    }}
                                                    icon={<Download size={16} />}
                                                >
                                                    Last ned CSV
                                                </Button>
                                            </div>
                                            {queryStats && (
                                                <span className="text-sm text-[var(--ax-text-subtle)]">
                                                    Data prosessert: {queryStats.totalBytesProcessedGB} GB
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                )}

                                <div>
                                    {!selectedParameterForDrilldown ? (
                                        <>
                                            <Heading level="3" size="small" className="mb-4">Hendelsesdetaljer</Heading>

                                            {!hasLoadedValues && propertiesData.length > 0 && (
                                                <div className="mt-2 mb-4">
                                                    <Button
                                                        size="small"
                                                        variant="secondary"
                                                        onClick={fetchAllParameterValues}
                                                        loading={loadingValues}
                                                    >
                                                        Vis utsnitt av verdier
                                                    </Button>
                                                </div>
                                            )}
                                            {propertiesData.length > 0 ? (
                                                <div className="overflow-x-auto">
                                                    <Table size="small">
                                                        <Table.Header>
                                                            <Table.Row>
                                                                <Table.HeaderCell>Navn</Table.HeaderCell>
                                                                <Table.HeaderCell align="right">Antall</Table.HeaderCell>
                                                                <Table.HeaderCell></Table.HeaderCell>
                                                            </Table.Row>
                                                        </Table.Header>
                                                        <Table.Body>
                                                            {propertiesData.map((prop, idx) => (
                                                                <Table.Row key={idx}>
                                                                    <Table.DataCell>{prop.propertyName}</Table.DataCell>
                                                                    <Table.DataCell align="right">{prop.total.toLocaleString('nb-NO')}</Table.DataCell>
                                                                    <Table.DataCell>
                                                                        <Button
                                                                            size="xsmall"
                                                                            variant="secondary"
                                                                            onClick={() => setSelectedParameterForDrilldown(prop.propertyName)}
                                                                        >
                                                                            Utforsk
                                                                        </Button>
                                                                    </Table.DataCell>
                                                                </Table.Row>
                                                            ))}
                                                        </Table.Body>
                                                    </Table>
                                                </div>
                                            ) : (
                                                <BodyShort>Ingen parametere funnet for denne hendelsen.</BodyShort>
                                            )}

                                            {loadingValues && (
                                                <div className="flex justify-center items-center py-8">
                                                    <Loader size="large" title="Henter verdier..." />
                                                </div>
                                            )}

                                            {hasLoadedValues && (Object.keys(allParameterValues).length > 0 || latestEvents.length > 0) && (
                                                <div className="mt-6 pt-6 border-t">
                                                    <Tabs value={parameterValuesTab} onChange={setParameterValuesTab}>
                                                        <Tabs.List>
                                                            <Tabs.Tab value="latest" label="Siste 20" />
                                                            <Tabs.Tab value="top" label="Topp verdier" />
                                                        </Tabs.List>

                                                            {/* Latest Events Tab */}
                                                            <Tabs.Panel value="latest" className="pt-4">
                                                                <Heading level="4" size="small" className="mb-4">
                                                                    Siste 20 registrerte hendelser
                                                                </Heading>
                                                                {latestEvents.length > 0 ? (
                                                                    <div className="overflow-x-auto max-w-full">
                                                                        <Table size="small" className="min-w-full">
                                                                            <Table.Header>
                                                                                <Table.Row>
                                                                                    <Table.HeaderCell>Tidspunkt</Table.HeaderCell>
                                                                                    {propertiesData.map((prop, idx) => (
                                                                                        <Table.HeaderCell key={idx}>{prop.propertyName}</Table.HeaderCell>
                                                                                    ))}
                                                                                </Table.Row>
                                                                            </Table.Header>
                                                                            <Table.Body>
                                                                                {latestEvents.map((event, eventIdx) => (
                                                                                    <Table.Row key={eventIdx}>
                                                                                        <Table.DataCell className="whitespace-nowrap">
                                                                                            {new Date(event.created_at).toLocaleString('nb-NO')}
                                                                                        </Table.DataCell>
                                                                                        {propertiesData.map((prop, propIdx) => (
                                                                                            <Table.DataCell key={propIdx} className="max-w-xs truncate" title={event.properties?.[prop.propertyName] || '-'}>
                                                                                                {event.properties?.[prop.propertyName] || '-'}
                                                                                            </Table.DataCell>
                                                                                        ))}
                                                                                    </Table.Row>
                                                                                ))}
                                                                            </Table.Body>
                                                                        </Table>
                                                                    </div>
                                                                ) : (
                                                                    <BodyShort>Ingen hendelser funnet.</BodyShort>
                                                                )}
                                                            </Tabs.Panel>

                                                            {/* Top Values Tab */}
                                                            <Tabs.Panel value="top" className="pt-4">
                                                                <Heading level="4" size="small" className="mb-4">
                                                                    Topp 20 verdier per hendelsesdetaljer
                                                                </Heading>
                                                                <div className="space-y-6">
                                                                    {propertiesData.map((prop, propIdx) => {
                                                                        const values = allParameterValues[prop.propertyName]?.slice(0, 20) || [];
                                                                        if (values.length === 0) return null;

                                                                        return (
                                                                            <div key={propIdx} className="border rounded-lg p-4">
                                                                                <Heading level="5" size="xsmall" className="mb-3">
                                                                                    {prop.propertyName}
                                                                                </Heading>
                                                                                <div className="overflow-x-auto">
                                                                                    <Table size="small">
                                                                                        <Table.Header>
                                                                                            <Table.Row>
                                                                                                <Table.HeaderCell>Verdi</Table.HeaderCell>
                                                                                                <Table.HeaderCell align="right">Antall</Table.HeaderCell>
                                                                                            </Table.Row>
                                                                                        </Table.Header>
                                                                                        <Table.Body>
                                                                                            {values.map((val, valIdx) => (
                                                                                                <Table.Row key={valIdx}>
                                                                                                    <Table.DataCell className="max-w-md truncate" title={val.value || '(tom)'}>
                                                                                                        {val.value || '(tom)'}
                                                                                                    </Table.DataCell>
                                                                                                    <Table.DataCell align="right">{val.count.toLocaleString('nb-NO')}</Table.DataCell>
                                                                                                </Table.Row>
                                                                                            ))}
                                                                                        </Table.Body>
                                                                                    </Table>
                                                                                </div>
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                            </Tabs.Panel>
                                                    </Tabs>
                                                    {parameterValuesQueryStats && (
                                                        <div className="text-sm text-[var(--ax-text-subtle)] text-right mt-4">
                                                            Data prosessert: {parameterValuesQueryStats.totalBytesProcessedGB} GB
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </>
                                    ) : (
                                        <>
                                            <div className="flex items-center gap-4 mb-4">
                                                <Button
                                                    variant="tertiary"
                                                    size="small"
                                                    icon={<ArrowLeft aria-hidden />}
                                                    onClick={() => setSelectedParameterForDrilldown(null)}
                                                >
                                                    Alle hendelsesdetaljer
                                                </Button>
                                            </div>

                                            <Heading level="3" size="medium" className="mb-6">
                                                {selectedParameterForDrilldown}
                                            </Heading>

                                            <div className="border rounded-lg p-4">
                                                <Heading level="4" size="small" className="mb-4">
                                                    Topp 20 verdier
                                                </Heading>
                                                {allParameterValues[selectedParameterForDrilldown]?.slice(0, 20).length > 0 ? (
                                                    <div className="overflow-x-auto">
                                                        <Table size="small">
                                                            <Table.Header>
                                                                <Table.Row>
                                                                    <Table.HeaderCell>Verdi</Table.HeaderCell>
                                                                    <Table.HeaderCell align="right">Antall</Table.HeaderCell>
                                                                </Table.Row>
                                                            </Table.Header>
                                                            <Table.Body>
                                                                {allParameterValues[selectedParameterForDrilldown]?.slice(0, 20).map((val, idx) => (
                                                                    <Table.Row key={idx}>
                                                                        <Table.DataCell className="max-w-md truncate" title={val.value || '(tom)'}>
                                                                            {val.value || '(tom)'}
                                                                        </Table.DataCell>
                                                                        <Table.DataCell align="right">{val.count.toLocaleString('nb-NO')}</Table.DataCell>
                                                                    </Table.Row>
                                                                ))}
                                                            </Table.Body>
                                                        </Table>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <Skeleton variant="text" width={80} height={20} />
                                                        <Skeleton variant="text" width={100} height={20} />
                                                    </>
                                                )}
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        )}

                        {!loadingData && !seriesData.length && !error && (
                            <div className="flex justify-center items-center h-full text-gray-500">
                                Ingen data funnet for denne hendelsen.
                            </div>
                        )}
                    </div>
                )
            }

            {
                !loadingEvents && hasSearched && (events.length > 0 || selectedEvent) && (
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
                )
            }

            {/* Empty States */}
            {
                !selectedEvent && !loadingEvents && hasSearched && events.length === 0 && !error && (
                    <div className="flex justify-center items-center h-full text-gray-500">
                        Ingen egendefinerte hendelser funnet for valgt periode og filter.
                    </div>
                )
            }
        </ChartLayout >
    );
};

export default EventExplorer;

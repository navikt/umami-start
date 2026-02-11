import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Heading, Button, Alert, Loader, BodyShort, Table, Tabs, Skeleton, Switch, TextField } from '@navikt/ds-react';
import { LineChart, ResponsiveContainer } from '@fluentui/react-charting';
import { Download, ArrowLeft, Share2, Check } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import ChartLayout from '../../components/analysis/ChartLayout';
import WebsitePicker from '../../components/analysis/WebsitePicker';
import PeriodPicker from '../../components/analysis/PeriodPicker';
import UrlPathFilter from '../../components/analysis/UrlPathFilter';
import { Website } from '../../types/chart';
import { ILineChartProps } from '@fluentui/react-charting';
import { normalizeUrlToPath, getDateRangeFromPeriod, getStoredPeriod, savePeriodPreference } from '../../lib/utils';


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

    // Data states
    const [seriesData, setSeriesData] = useState<any[]>([]);
    const [propertiesData, setPropertiesData] = useState<any[]>([]);
    const [loadingData, setLoadingData] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [queryStats, setQueryStats] = useState<any>(null);
    const [eventsQueryStats, setEventsQueryStats] = useState<any>(null);

    // Parameter values state - now storing values for ALL parameters
    const [allParameterValues, setAllParameterValues] = useState<Record<string, { value: string; count: number }[]>>({});
    const [loadingValues, setLoadingValues] = useState<boolean>(false);
    const [hasLoadedValues, setHasLoadedValues] = useState<boolean>(false);
    const [parameterValuesTab, setParameterValuesTab] = useState<string>('latest');
    const [latestEvents, setLatestEvents] = useState<any[]>([]);
    const [selectedParameterForDrilldown, setSelectedParameterForDrilldown] = useState<string | null>(null);
    const [parameterValuesQueryStats, setParameterValuesQueryStats] = useState<any>(null);
    const [copySuccess, setCopySuccess] = useState<boolean>(false);
    const [hasAutoSubmitted, setHasAutoSubmitted] = useState<boolean>(false);
    const [eventSearch, setEventSearch] = useState<string>('');

    // Auto-submit when website is selected (from localStorage, URL, or Home page picker)
    useEffect(() => {
        if (selectedWebsite && !hasAutoSubmitted && !loadingEvents) {
            setHasAutoSubmitted(true);
            fetchEvents();
        }
    }, [selectedWebsite]);

    const copyShareLink = async () => {
        try {
            await navigator.clipboard.writeText(window.location.href);
            setCopySuccess(true);
            setTimeout(() => setCopySuccess(false), 2000);
        } catch (err) {
            console.error('Failed to copy link:', err);
        }
    };

    // Calculate dates based on selection using centralized utility
    const getDates = () => {
        const dateRange = getDateRangeFromPeriod(period, customStartDate, customEndDate);
        if (!dateRange) {
            throw new Error('Vennligst velg en gyldig periode.');
        }
        return { startAt: dateRange.startDate, endAt: dateRange.endDate };
    };

    // Fetch available events (triggered by button)
    const fetchEvents = async () => {
        if (!selectedWebsite) return;

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

            const result = await response.json();
            setEvents(result.events || []);
            if (result.queryStats) {
                setEventsQueryStats(result.queryStats);
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
        } catch (err) {
            console.error('Error fetching events:', err);
            setError((err as Error).message || 'Kunne ikke hente hendelser.');
        } finally {
            setLoadingEvents(false);
        }
    };

    // Fetch data when an event is selected
    useEffect(() => {
        const fetchData = async () => {
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
                const seriesResult = await seriesResponse.json();
                setSeriesData(seriesResult.data || []);

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
                const propsResult = await propsResponse.json();

                setPropertiesData(propsResult.properties || []);
                if (propsResult.gbProcessed) {
                    setQueryStats({
                        totalBytesProcessedGB: propsResult.gbProcessed,
                        estimatedCostUSD: ((parseFloat(propsResult.gbProcessed) / 1024) * 6.25).toFixed(3)
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
        };

        fetchData();
    }, [selectedEvent, selectedWebsite]);

    // Fetch values for ALL parameters
    const fetchAllParameterValues = async () => {
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

                const result = await response.json();
                return {
                    parameterName: prop.propertyName,
                    values: result.values || [],
                    queryStats: result.queryStats
                };
            });

            const results = await Promise.all(fetchPromises);

            // Convert array to object for easier lookup
            const valuesMap: Record<string, { value: string; count: number }[]> = {};
            let combinedQueryStats: any = null;
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
                const latestResult = await latestResponse.json();
                console.log('Latest events result:', latestResult);
                setLatestEvents(latestResult.events || []);
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
    };

    // Auto-fetch values when drilling down into a parameter
    useEffect(() => {
        if (selectedParameterForDrilldown && !hasLoadedValues && !loadingValues) {
            fetchAllParameterValues();
        }
    }, [selectedParameterForDrilldown]);


    const prepareLineChartData = (includeAverage: boolean = false): ILineChartProps | null => {
        if (!seriesData.length) return null;

        const dataPoints = seriesData.map(item => ({
            x: new Date(item.time),
            y: item.count
        }));

        const lineChartData: any[] = [{
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
                    lineBorderWidth: '2',
                    strokeDasharray: '5 5'
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
                        label="Side eller URL"
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
                            disabled={!selectedWebsite || loadingEvents}
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
                                <Heading level="3" size="small">Hendelser</Heading>
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
                                                <Table.HeaderCell>Hendelsesnavn</Table.HeaderCell>
                                                <Table.HeaderCell align="right">Antall</Table.HeaderCell>
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
                                                        yAxisTickFormat={(d: any) => d.toLocaleString('nb-NO')}
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
                                                        <tr key={index} className="hover:bg-[var(--ax-bg-neutral-soft)]">
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

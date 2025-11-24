import { useState, useEffect } from 'react';
import { Heading, TextField, Button, Alert, Loader, BodyShort, RadioGroup, Radio, Table, Tabs, Skeleton, Switch } from '@navikt/ds-react';
import { LineChart, ResponsiveContainer } from '@fluentui/react-charting';
import { Download, ArrowLeft } from 'lucide-react';
import ChartLayout from '../components/ChartLayout';
import WebsitePicker from '../components/WebsitePicker';
import { Website } from '../types/chart';
import { ILineChartProps } from '@fluentui/react-charting';

const EventExplorer = () => {
    const [selectedWebsite, setSelectedWebsite] = useState<Website | null>(null);
    const [pagePath, setPagePath] = useState<string>('');
    const [selectedEvent, setSelectedEvent] = useState<string>('');
    const [events, setEvents] = useState<{ name: string; count: number }[]>([]);
    const [loadingEvents, setLoadingEvents] = useState<boolean>(false);
    const [dateRange, setDateRange] = useState<'thisMonth' | 'lastMonth'>('thisMonth');
    const [hasSearched, setHasSearched] = useState<boolean>(false);
    const [activeTab, setActiveTab] = useState<string>('usage');
    const [showAverage, setShowAverage] = useState<boolean>(false);

    // Data states
    const [seriesData, setSeriesData] = useState<any[]>([]);
    const [propertiesData, setPropertiesData] = useState<any[]>([]);
    const [loadingData, setLoadingData] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [queryStats, setQueryStats] = useState<any>(null);

    // Parameter values state - now storing values for ALL parameters
    const [allParameterValues, setAllParameterValues] = useState<Record<string, { value: string; count: number }[]>>({});
    const [loadingValues, setLoadingValues] = useState<boolean>(false);
    const [hasLoadedValues, setHasLoadedValues] = useState<boolean>(false);
    const [parameterValuesTab, setParameterValuesTab] = useState<string>('latest');
    const [latestEvents, setLatestEvents] = useState<any[]>([]);
    const [selectedParameterForDrilldown, setSelectedParameterForDrilldown] = useState<string | null>(null);

    // Calculate dates based on selection
    const getDates = () => {
        const now = new Date();
        let startAt, endAt;

        if (dateRange === 'thisMonth') {
            startAt = new Date(now.getFullYear(), now.getMonth(), 1);
            endAt = now;
        } else {
            startAt = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            endAt = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
        }
        return { startAt, endAt };
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
            if (pagePath) params.append('urlPath', pagePath);

            const response = await fetch(`/api/bigquery/websites/${selectedWebsite.id}/events?${params.toString()}`);
            if (!response.ok) throw new Error('Failed to fetch events');

            const result = await response.json();
            setEvents(result.events || []);
        } catch (err) {
            console.error('Error fetching events:', err);
            setError('Kunne ikke hente hendelser.');
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
                if (pagePath) seriesParams.append('urlPath', pagePath);

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
                if (pagePath) propsParams.append('urlPath', pagePath);

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
                if (pagePath) params.append('urlPath', pagePath);

                const response = await fetch(`/api/bigquery/websites/${selectedWebsite.id}/event-parameter-values?${params.toString()}`);
                if (!response.ok) throw new Error(`Failed to fetch values for ${prop.propertyName}`);

                const result = await response.json();
                return {
                    parameterName: prop.propertyName,
                    values: result.values || []
                };
            });

            const results = await Promise.all(fetchPromises);

            // Convert array to object for easier lookup
            const valuesMap: Record<string, { value: string; count: number }[]> = {};
            results.forEach(result => {
                valuesMap[result.parameterName] = result.values;
            });

            setAllParameterValues(valuesMap);

            // Also fetch latest 20 events
            const latestParams = new URLSearchParams({
                eventName: selectedEvent,
                startAt: startAt.getTime().toString(),
                endAt: endAt.getTime().toString(),
                limit: '20'
            });
            if (pagePath) latestParams.append('urlPath', pagePath);

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
    };

    return (
        <ChartLayout
            title="Egendefinerte hendelser"
            description="Utforsk egendefinerte hendelser."
            currentPage="event-explorer"
            filters={
                <>
                    <WebsitePicker
                        selectedWebsite={selectedWebsite}
                        onWebsiteChange={setSelectedWebsite}
                        variant="minimal"
                    />

                    <RadioGroup
                        legend="Velg periode"
                        value={dateRange}
                        onChange={(val: 'thisMonth' | 'lastMonth') => setDateRange(val)}
                    >
                        <Radio value="thisMonth">Denne måneden</Radio>
                        <Radio value="lastMonth">Forrige måned</Radio>
                    </RadioGroup>

                    <TextField
                        label="URL-sti (valgfritt)"
                        description="F.eks. / for forsiden"
                        value={pagePath}
                        onChange={(e) => setPagePath(e.target.value)}
                    />

                    <Button
                        onClick={fetchEvents}
                        disabled={!selectedWebsite || loadingEvents}
                        loading={loadingEvents}
                        className="w-full"
                    >
                        Vis hendelser
                    </Button>
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

            {/* Event List View */}
            {!selectedEvent && !loadingEvents && hasSearched && events.length > 0 && (
                <div>
                    <Heading level="2" size="medium" className="mb-2">Hendelser</Heading>
                    {pagePath && (
                        <BodyShort className="text-gray-600 mb-4">
                            Viser hendelser for URL-sti: {pagePath}
                        </BodyShort>
                    )}
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
                                {events.map((event) => (
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
                </div>
            )}

            {/* Event Details View */}
            {selectedEvent && (
                <div className="space-y-6">
                    <div className="flex items-center gap-4 mb-4">
                        <Button
                            variant="tertiary"
                            size="small"
                            icon={<ArrowLeft aria-hidden />}
                            onClick={handleBackToEvents}
                        >
                            Tilbake til oversikt
                        </Button>
                    </div>

                    <Heading level="2" size="medium">{selectedEvent}</Heading>

                    {loadingData && (
                        <div className="flex justify-center items-center h-64">
                            <Loader size="xlarge" title="Henter data..." />
                        </div>
                    )}

                    {!loadingData && seriesData.length > 0 && (
                        <Tabs value={activeTab} onChange={setActiveTab}>
                            <Tabs.List>
                                <Tabs.Tab value="usage" label="Bruk av hendelse" />
                                <Tabs.Tab value="parameters" label="Hendelsdetaljer" />
                            </Tabs.List>

                            {/* Usage Tab */}
                            <Tabs.Panel value="usage" className="pt-6">
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

                                    {/* Table */}
                                    <div className="border rounded-lg overflow-hidden">
                                        <div className="overflow-x-auto">
                                            <table className="min-w-full divide-y divide-gray-200">
                                                <thead className="bg-gray-100">
                                                    <tr>
                                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Dato</th>
                                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Antall</th>
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
                                                <span className="text-sm text-gray-600">
                                                    Data prosessert: {queryStats.totalBytesProcessedGB} GB
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </Tabs.Panel>

                            {/* Parameters Tab */}
                            <Tabs.Panel value="parameters" className="pt-6">
                                <div>
                                    {!selectedParameterForDrilldown ? (
                                        <>
                                            <Heading level="3" size="small" className="mb-4">Hendelsesdetaljer</Heading>

                                            {!hasLoadedValues && propertiesData.length > 0 && (
                                                <div className="mb-4">
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
                                                    Tilbake til oversikt
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
                            </Tabs.Panel>
                        </Tabs>
                    )}

                    {!loadingData && !seriesData.length && !error && (
                        <div className="flex justify-center items-center h-full text-gray-500">
                            Ingen data funnet for denne hendelsen.
                        </div>
                    )}
                </div>
            )}

            {/* Empty States */}
            {!selectedEvent && !loadingEvents && hasSearched && events.length === 0 && !error && (
                <div className="flex justify-center items-center h-full text-gray-500">
                    Ingen egendefinerte hendelser funnet for valgt periode og filter.
                </div>
            )}
        </ChartLayout>
    );
};

export default EventExplorer;

import { useState } from 'react';
import { Heading, Button, Alert, Loader, BodyShort, Table, Tabs, Skeleton, Switch, TextField } from '@navikt/ds-react';
import { LineChart, ResponsiveContainer } from '@fluentui/react-charting';
import { Download, ArrowLeft, Share2, Check } from 'lucide-react';
import ChartLayout from '../../analysis/ui/ChartLayout.tsx';
import WebsitePicker from '../../analysis/ui/WebsitePicker.tsx';
import PeriodPicker from '../../analysis/ui/PeriodPicker.tsx';
import UrlPathFilter from '../../analysis/ui/UrlPathFilter.tsx';
import { useEventExplorer } from '../hooks/useEventExplorer.ts';
import { prepareLineChartData } from '../utils/chartHelpers.ts';
import { copyToClipboard } from '../utils/clipboard.ts';

const EventExplorer = () => {
    const {
        selectedWebsite,
        setSelectedWebsite,
        urlPaths,
        setUrlPaths,
        pathOperator,
        setPathOperator,
        selectedEvent,
        setSelectedEvent,
        events,
        loadingEvents,
        period,
        setPeriod,
        customStartDate,
        setCustomStartDate,
        customEndDate,
        setCustomEndDate,
        hasSearched,
        seriesData,
        propertiesData,
        loadingData,
        error,
        queryStats,
        eventsQueryStats,
        allParameterValues,
        loadingValues,
        hasLoadedValues,
        latestEvents,
        selectedParameterForDrilldown,
        setSelectedParameterForDrilldown,
        parameterValuesQueryStats,
        hasUnappliedFilterChanges,
        fetchEventsData,
        fetchAllParameterValues
    } = useEventExplorer();

    const [showAverage, setShowAverage] = useState<boolean>(false);
    const [showTrendTable, setShowTrendTable] = useState<boolean>(false);
    const [parameterValuesTab, setParameterValuesTab] = useState<string>('latest');
    const [copySuccess, setCopySuccess] = useState<boolean>(false);
    const [eventSearch, setEventSearch] = useState<string>('');

    const copyShareLink = async () => {
        const success = await copyToClipboard(window.location.href);
        if (success) {
            setCopySuccess(true);
            setTimeout(() => setCopySuccess(false), 2000);
        }
    };

    const handleBackToEvents = () => {
        setSelectedEvent('');
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
                            onClick={fetchEventsData}
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

            {!selectedEvent && !loadingEvents && hasSearched && events.length > 0 && (() => {
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
            })()}

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
                                        const chartData = prepareLineChartData(seriesData, selectedEvent, showAverage);
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
            )}

            {!loadingEvents && hasSearched && (events.length > 0 || selectedEvent) && (
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
            )}

            {!selectedEvent && !loadingEvents && hasSearched && events.length === 0 && !error && (
                <div className="flex justify-center items-center h-full text-gray-500">
                    Ingen egendefinerte hendelser funnet for valgt periode og filter.
                </div>
            )}
        </ChartLayout>
    );
};

export default EventExplorer;


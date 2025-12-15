import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { TextField, Button, Alert, Loader, Heading, Table, Modal, Label } from '@navikt/ds-react';
import { Share2, Check } from 'lucide-react';
import ChartLayout from '../components/ChartLayout';
import WebsitePicker from '../components/WebsitePicker';
import PeriodPicker from '../components/PeriodPicker';
import { Website } from '../types/chart';

const EventJourney = () => {
    const [selectedWebsite, setSelectedWebsite] = useState<Website | null>(null);
    const [searchParams] = useSearchParams();

    // Initialize state from URL params
    const [urlPath, setUrlPath] = useState<string>(() => searchParams.get('urlPath') || '/');
    const [period, setPeriod] = useState<string>(() => searchParams.get('period') || 'current_month');
    const [customStartDate, setCustomStartDate] = useState<Date | undefined>(undefined);
    const [customEndDate, setCustomEndDate] = useState<Date | undefined>(undefined);

    // Client-side filter state
    const [filterText, setFilterText] = useState<string>('');

    const [data, setData] = useState<{ path: string[], count: number }[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [queryStats, setQueryStats] = useState<any>(null);
    const [dryRunStats, setDryRunStats] = useState<any>(null);
    const [copySuccess, setCopySuccess] = useState<boolean>(false);
    const [hasAutoSubmitted, setHasAutoSubmitted] = useState<boolean>(false);

    // Modal state
    const [selectedStepDetails, setSelectedStepDetails] = useState<{ title: string, details: string[] } | null>(null);


    // Auto-submit when URL parameters are present (for shared links)
    useEffect(() => {
        const hasConfigParams = searchParams.has('period') || searchParams.has('urlPath');
        if (selectedWebsite && hasConfigParams && !hasAutoSubmitted && !loading) {
            setHasAutoSubmitted(true);
            fetchData();
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

    const fetchData = async () => {
        if (!selectedWebsite) return;

        setLoading(true);
        setError(null);
        setData([]);

        // Calculate date range
        const now = new Date();
        let startDate: Date;
        let endDate: Date;

        if (period === 'current_month') {
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
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
            startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            endDate = new Date(now.getFullYear(), now.getMonth(), 0);
        }

        try {
            const response = await fetch('/api/bigquery/event-journeys', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    websiteId: selectedWebsite.id,
                    urlPath,
                    startDate: startDate.toISOString(),
                    endDate: endDate.toISOString(),
                    minEvents: 1 // Allow paths of length 1
                }),
            });

            if (!response.ok) {
                throw new Error('Failed to fetch event journeys');
            }

            const result = await response.json();
            setData(result.journeys || []);
            setQueryStats(result.journeyStats);
            setDryRunStats(result.queryStats);

            // Update URL
            const newParams = new URLSearchParams(window.location.search);
            newParams.set('period', period);
            newParams.set('urlPath', urlPath);
            newParams.delete('minEvents');
            window.history.replaceState({}, '', `${window.location.pathname}?${newParams.toString()}`);

        } catch (err) {
            console.error(err);
            setError('Kunne ikke laste hendelsesreiser. Prøv igjen senere.');
        } finally {
            setLoading(false);
        }
    };

    // Filter data client-side
    const filteredData = data.filter(journey => {
        if (!filterText) return true;
        const lowerFilter = filterText.toLowerCase();
        // Check if any step in the path contains the filter text
        return journey.path.some(step => step.toLowerCase().includes(lowerFilter));
    });

    const formatNumber = (num: number) => num.toLocaleString('nb-NO');

    const getPercentage = (count: number, total: number) => {
        if (!total) return '0.0%';
        return ((count / total) * 100).toFixed(1) + '%';
    };

    const getMaxSteps = () => {
        if (!filteredData.length) return 0;
        return Math.max(...filteredData.map(d => d.path.length));
    };

    return (
        <ChartLayout
            title="Hendelsesflyt"
            description="Se rekkefølgen av hendelser brukere gjør på en spesifikk side."
            currentPage="hendelsesreiser" // Need to update type in AnalyticsNavigation probably
            filters={
                <>
                    <WebsitePicker
                        selectedWebsite={selectedWebsite}
                        onWebsiteChange={setSelectedWebsite}
                        variant="minimal"
                    />

                    <TextField
                        label="URL-sti"
                        description="Hvilken side vil du analysere?"
                        value={urlPath}
                        onChange={(e) => setUrlPath(e.target.value)}
                    />

                    <PeriodPicker
                        period={period}
                        onPeriodChange={setPeriod}
                        startDate={customStartDate}
                        onStartDateChange={setCustomStartDate}
                        endDate={customEndDate}
                        onEndDateChange={setCustomEndDate}
                    />

                    <Button
                        onClick={fetchData}
                        disabled={!selectedWebsite || loading}
                        loading={loading}
                    >
                        Vis reiser
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
                    <Loader size="xlarge" title="Laster hendelsesreiser..." />
                </div>
            )}

            {!loading && data.length > 0 && (
                <>
                    {/* Stats Summary */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                        {/* Unique Visitors */}
                        <div className="bg-white border text-center rounded-lg p-6 flex flex-col h-full shadow-sm">
                            <div className="h-12 flex items-center justify-center mb-2">
                                <Label size="small" className="text-gray-600">Unike besøkende</Label>
                            </div>
                            <div className="flex-1 flex flex-col justify-center">
                                <div className="text-xl lg:text-2xl font-bold mb-1">{formatNumber(queryStats?.total_sessions || 0)}</div>
                                <div className="text-sm font-medium invisible">placeholder</div>
                            </div>
                        </div>

                        {/* Interactive */}
                        <div className="bg-blue-50 border border-blue-100 text-center rounded-lg p-6 flex flex-col h-full shadow-sm">
                            <div className="h-12 flex items-center justify-center mb-2">
                                <Label size="small" className="text-blue-900">Utførte handlinger</Label>
                            </div>
                            <div className="flex-1 flex flex-col justify-center">
                                <div className="text-xl lg:text-2xl font-bold text-blue-900 mb-1">
                                    {getPercentage(queryStats?.sessions_with_events || 0, queryStats?.total_sessions || 0)}
                                </div>
                                <div className="text-sm font-medium text-blue-800">
                                    {formatNumber(queryStats?.sessions_with_events || 0)} sesjoner
                                </div>
                            </div>
                        </div>

                        {/* Navigated No Events */}
                        <div className="bg-green-50 border border-green-100 text-center rounded-lg p-6 flex flex-col h-full shadow-sm">
                            <div className="h-12 flex items-center justify-center mb-2">
                                <Label size="small" className="text-green-900">Navigering uten handling</Label>
                            </div>
                            <div className="flex-1 flex flex-col justify-center">
                                <div className="text-xl lg:text-2xl font-bold text-green-900 mb-1">
                                    {getPercentage(queryStats?.sessions_no_events_navigated || 0, queryStats?.total_sessions || 0)}
                                </div>
                                <div className="text-sm font-medium text-green-800">
                                    {formatNumber(queryStats?.sessions_no_events_navigated || 0)} sesjoner
                                </div>
                            </div>
                        </div>

                        {/* Bounced */}
                        <div className="bg-red-50 border border-red-100 text-center rounded-lg p-6 flex flex-col h-full shadow-sm">
                            <div className="h-12 flex items-center justify-center mb-2">
                                <Label size="small" className="text-red-900">Forlot nettstedet</Label>
                            </div>
                            <div className="flex-1 flex flex-col justify-center">
                                <div className="text-xl lg:text-2xl font-bold text-red-900 mb-1">
                                    {getPercentage(queryStats?.sessions_no_events_bounced || 0, queryStats?.total_sessions || 0)}
                                </div>
                                <div className="text-sm font-medium text-red-800">
                                    {formatNumber(queryStats?.sessions_no_events_bounced || 0)} sesjoner
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-between items-end mb-4">
                        <Heading level="2" size="medium">Hendelsesflyt</Heading>
                        <div className="flex items-center gap-4">
                            <TextField
                                label="Søk i reiser"
                                hideLabel
                                placeholder="Filtrer reiser..."
                                size="small"
                                value={filterText}
                                onChange={(e) => setFilterText(e.target.value)}
                                className="w-64"
                            />
                            <Button
                                size="small"
                                variant="secondary"
                                icon={copySuccess ? <Check size={16} /> : <Share2 size={16} />}
                                onClick={copyShareLink}
                            >
                                {copySuccess ? 'Kopiert!' : 'Del analyse'}
                            </Button>
                        </div>
                    </div>

                    <div className="bg-white border rounded-lg p-4 mb-4 overflow-x-auto">
                        <div className="min-w-max">
                            {filteredData.length > 0 ? (
                                filteredData.map((journey, idx) => (
                                    <div key={idx} className="mb-8 last:mb-0">
                                        <div className="flex items-center text-sm text-gray-500 mb-2">
                                            <span className="font-semibold text-gray-900 mr-2">{journey.count} sesjoner</span>
                                            <span>({((journey.count / data.reduce((a, b) => a + b.count, 0)) * 100).toFixed(1)}% av totalt)</span>
                                        </div>
                                        <div className="flex items-start overflow-x-auto pb-6 pt-2 px-1">
                                            {journey.path.map((step, stepIdx) => {
                                                // Parse step: "EventName: Key: Value||Key2: Value2"
                                                const parts = step.split(': ');
                                                const eventName = parts[0];
                                                const rawDetails = parts.length > 1 ? step.substring(eventName.length + 2) : '';
                                                const details = rawDetails.split('||').filter(Boolean);

                                                // Find a nice title for the card from details
                                                let cardTitle = eventName;
                                                let cardSubtitle = '';

                                                // Extract useful info for preview
                                                const detailMap: Record<string, string> = {};
                                                details.forEach(d => {
                                                    const [k, v] = d.split(': ');
                                                    if (k && v) detailMap[k] = v;
                                                });

                                                // Priority for subtitle
                                                if (detailMap['destinasjon']) cardSubtitle = detailMap['destinasjon'];
                                                else if (detailMap['lenketekst']) cardSubtitle = detailMap['lenketekst'];
                                                else if (detailMap['tittel']) cardSubtitle = detailMap['tittel'];
                                                else if (detailMap['label']) cardSubtitle = detailMap['label'];
                                                else if (detailMap['url']) cardSubtitle = detailMap['url'];

                                                return (
                                                    <div key={stepIdx} className="flex items-center flex-shrink-0">
                                                        <div className="flex flex-col items-center group relative">
                                                            <button
                                                                className="bg-white border rounded-lg shadow-sm p-3 min-w-[160px] max-w-[220px] hover:shadow-md hover:border-blue-300 transition-all text-left focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                                onClick={() => setSelectedStepDetails({ title: eventName, details })}
                                                            >
                                                                <div className="font-semibold text-gray-800 text-sm mb-1 truncate" title={cardTitle}>
                                                                    {cardTitle}
                                                                </div>
                                                                {cardSubtitle && (
                                                                    <div className="text-xs text-blue-800 bg-blue-50 rounded px-1.5 py-0.5 break-words line-clamp-2 mb-1" title={cardSubtitle}>
                                                                        {cardSubtitle}
                                                                    </div>
                                                                )}
                                                                <div className="text-[10px] text-gray-400 mt-1">
                                                                    Klikk for {details.length} detaljer
                                                                </div>
                                                            </button>
                                                            {/* Step number badge - positioned to not be cut off */}
                                                            <div className="absolute -top-2 -right-2 bg-gray-100 text-gray-600 text-[10px] font-bold px-1.5 py-0.5 rounded-full border shadow-sm z-10">
                                                                {stepIdx + 1}
                                                            </div>
                                                        </div>
                                                        {stepIdx < journey.path.length - 1 && (
                                                            <div className="w-8 h-px bg-gray-300 mx-2"></div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center text-gray-500 py-8">
                                    Ingen reiser matcher søket ditt.
                                </div>
                            )}
                        </div>
                    </div>

                    <Modal
                        open={!!selectedStepDetails}
                        onClose={() => setSelectedStepDetails(null)}
                        header={{ heading: selectedStepDetails?.title || 'Detaljer' }}
                    >
                        <Modal.Body>
                            <Table>
                                <Table.Header>
                                    <Table.Row>
                                        <Table.HeaderCell>Egenskap</Table.HeaderCell>
                                        <Table.HeaderCell>Verdi</Table.HeaderCell>
                                    </Table.Row>
                                </Table.Header>
                                <Table.Body>
                                    {selectedStepDetails?.details && selectedStepDetails.details.length > 0 ? (
                                        selectedStepDetails.details.map((detail, i) => {
                                            const [key, ...values] = detail.split(': ');
                                            const value = values.join(': ');
                                            return (
                                                <Table.Row key={i}>
                                                    <Table.DataCell className="font-semibold capitalize text-gray-700 w-1/3">
                                                        {key}
                                                    </Table.DataCell>
                                                    <Table.DataCell className="break-all">
                                                        {value}
                                                    </Table.DataCell>
                                                </Table.Row>
                                            );
                                        })
                                    ) : (
                                        <Table.Row>
                                            <Table.DataCell colSpan={2}>Ingen ytterligere detaljer tilgjengelig.</Table.DataCell>
                                        </Table.Row>
                                    )}
                                </Table.Body>
                            </Table>
                        </Modal.Body>
                        <Modal.Footer>
                            <Button type="button" variant="primary" onClick={() => setSelectedStepDetails(null)}>
                                Lukk
                            </Button>
                        </Modal.Footer>
                    </Modal>

                    <div className="border rounded-lg overflow-hidden mt-8">
                        <Heading level="3" size="small" className="p-4 bg-gray-50 border-b">Detaljert tabell</Heading>
                        <div className="overflow-x-auto">
                            <Table>
                                <Table.Header>
                                    <Table.Row>
                                        <Table.HeaderCell>Antall</Table.HeaderCell>
                                        <Table.HeaderCell>Andel</Table.HeaderCell>
                                        {Array.from({ length: getMaxSteps() }).map((_, i) => (
                                            <Table.HeaderCell key={i}>Steg {i + 1}</Table.HeaderCell>
                                        ))}
                                    </Table.Row>
                                </Table.Header>
                                <Table.Body>
                                    {filteredData.map((journey, idx) => (
                                        <Table.Row key={idx}>
                                            <Table.DataCell>{journey.count}</Table.DataCell>
                                            <Table.DataCell>{((journey.count / data.reduce((a, b) => a + b.count, 0)) * 100).toFixed(1)}%</Table.DataCell>
                                            {Array.from({ length: getMaxSteps() }).map((_, i) => {
                                                const step = journey.path[i];
                                                if (!step) return <Table.DataCell key={i}>-</Table.DataCell>;
                                                const parts = step.split(': ');
                                                return <Table.DataCell key={i}>{parts[0]}</Table.DataCell>;
                                            })}
                                        </Table.Row>
                                    ))}
                                </Table.Body>
                            </Table>
                        </div>
                    </div>

                    {dryRunStats && dryRunStats.totalBytesProcessedGB && (
                        <div className="text-sm text-gray-600 text-right mt-4">
                            Data prosessert: {Math.round(parseFloat(dryRunStats.totalBytesProcessedGB))} GB
                        </div>
                    )}
                </>
            )}

            {!loading && data.length === 0 && !error && (
                <div className="text-center text-gray-500 mt-12">
                    Ingen reiser funnet for valgt periode og innstillinger.
                </div>
            )}
        </ChartLayout>
    );
};

export default EventJourney;

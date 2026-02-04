import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Alert, Loader, Radio, RadioGroup, Table, Heading, Tooltip, Tabs } from '@navikt/ds-react';
import { AlertTriangle, CheckCircle, X } from 'lucide-react';
import ChartLayout from '../../components/analysis/ChartLayoutOriginal';
import WebsitePicker from '../../components/analysis/WebsitePicker';
import PeriodPicker from '../../components/analysis/PeriodPicker';
import { Website } from '../../types/chart';
import { format, parseISO } from 'date-fns';
import { nb } from 'date-fns/locale';
import { LineChart, ILineChartDataPoint, ILineChartProps } from '@fluentui/react-charting';

interface DiagnosisData {
    website_id: string;
    website_name: string;
    domain: string | null;
    pageviews: number;
    custom_events: number;
    last_event_at: string | null;
}

interface HistoryData {
    month: string;
    pageviews: number;
    custom_events: number;
}

const Diagnosis = () => {
    const [searchParams] = useSearchParams();

    // Initialize state from URL params
    const [period, setPeriod] = useState<string>(() => searchParams.get('period') || 'current_month');

    // Support custom dates from URL
    const fromDateFromUrl = searchParams.get("from");
    const toDateFromUrl = searchParams.get("to");
    const initialCustomStartDate = fromDateFromUrl ? parseISO(fromDateFromUrl) : undefined;
    const initialCustomEndDate = toDateFromUrl ? parseISO(toDateFromUrl) : undefined;

    const [customStartDate, setCustomStartDate] = useState<Date | undefined>(initialCustomStartDate);
    const [customEndDate, setCustomEndDate] = useState<Date | undefined>(initialCustomEndDate);
    const [data, setData] = useState<DiagnosisData[] | null>(null);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [queryStats, setQueryStats] = useState<any>(null);
    const [environment, setEnvironment] = useState<string>('all');
    const [activeTab, setActiveTab] = useState<string>('all');
    const [selectedWebsiteFilter, setSelectedWebsiteFilter] = useState<Website | null>(null);

    // Deep Diagnosis State
    const [selectedWebsite, setSelectedWebsite] = useState<DiagnosisData | null>(null);
    const [historyData, setHistoryData] = useState<HistoryData[] | null>(null);
    const [historyLoading, setHistoryLoading] = useState<boolean>(false);
    const [absoluteLastEvent, setAbsoluteLastEvent] = useState<string | null>(null);
    const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
    const [historyQueryStats, setHistoryQueryStats] = useState<any>(null);

    const fetchData = async () => {
        setLoading(true);
        setError(null);
        setData(null);
        setQueryStats(null);

        // Calculate date range based on period
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
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            endDate = now;
        }

        try {
            const response = await fetch('/api/bigquery/diagnosis', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    startDate: startDate.toISOString(),
                    endDate: endDate.toISOString(),
                }),
            });

            if (!response.ok) {
                throw new Error('Kunne ikke hente data');
            }

            const result = await response.json();

            if (result.error) {
                setError(result.error);
            } else {
                setData(result.data);
                setQueryStats(result.queryStats);
            }
        } catch (err) {
            console.error('Error fetching diagnosis data:', err);
            setError('Det oppstod en feil ved henting av data.');
        } finally {
            setLoading(false);
        }
    };

    // Fetch data when period changes
    useEffect(() => {
        fetchData();
    }, [period]);

    const [sort, setSort] = useState<{ orderBy: string; direction: 'ascending' | 'descending' }>({
        orderBy: 'total',
        direction: 'descending'
    });

    const handleSort = (sortKey: string) => {
        setSort(prev => ({
            orderBy: sortKey,
            direction: prev.orderBy === sortKey && prev.direction === 'descending' ? 'ascending' : 'descending'
        }));
    };

    const isDevDomain = (domain: string | null) => {
        if (!domain) return false;
        const d = domain.toLowerCase();
        return d.includes('dev') || d.includes('test') || d.includes('localhost');
    };

    // Filter data by environment first (used for stats and table)
    const environmentData = data ? data.filter(row => {
        if (environment === 'prod') {
            if (isDevDomain(row.domain)) return false;
        } else if (environment === 'dev') {
            if (!isDevDomain(row.domain)) return false;
        }
        return true;
    }) : [];

    // Filter by tab (used for table only)
    const filteredData = environmentData.filter(row => {
        if (activeTab === 'attention') {
            if (row.last_event_at) return false;
        }
        return true;
    });

    const sortedData = [...filteredData].sort((a, b) => {
        const { orderBy, direction } = sort;
        let aValue: any, bValue: any;

        if (orderBy === 'pageviews') {
            aValue = a.pageviews;
            bValue = b.pageviews;
        } else if (orderBy === 'custom_events') {
            aValue = a.custom_events;
            bValue = b.custom_events;
        } else if (orderBy === 'total') {
            aValue = a.pageviews + a.custom_events;
            bValue = b.pageviews + b.custom_events;
        } else if (orderBy === 'last_event_at') {
            aValue = a.last_event_at ? new Date(a.last_event_at).getTime() : 0;
            bValue = b.last_event_at ? new Date(b.last_event_at).getTime() : 0;
        } else {
            return 0;
        }

        if (aValue < bValue) return direction === 'ascending' ? -1 : 1;
        if (aValue > bValue) return direction === 'ascending' ? 1 : -1;
        return 0;
    });

    const totalWebsites = environmentData.length;
    const activeWebsites = environmentData.filter(d => d.last_event_at).length;
    const inactiveWebsites = environmentData.filter(d => !d.last_event_at).length;

    // Find selected website in data for highlighting
    const highlightedWebsite = selectedWebsiteFilter && environmentData
        ? environmentData.find(row => row.website_id === selectedWebsiteFilter.id)
        : null;

    const getEnvironmentTitle = () => {
        switch (environment) {
            case 'prod': return 'Prod-miljø';
            case 'dev': return 'Dev-miljø';
            default: return 'Alle miljø';
        }
    };

    const handleExplore = async (website: DiagnosisData) => {
        setSelectedWebsite(website);
        setIsModalOpen(true);
        setHistoryLoading(true);
        setHistoryData(null);
        setAbsoluteLastEvent(null);
        setHistoryQueryStats(null);

        try {
            const response = await fetch('/api/bigquery/diagnosis-history', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ websiteId: website.website_id })
            });

            if (!response.ok) throw new Error('Failed to fetch history');

            const result = await response.json();
            setHistoryData(result.history);
            setAbsoluteLastEvent(result.lastEventAt);
            setHistoryQueryStats(result.queryStats);
        } catch (error) {
            console.error('Error fetching history:', error);
        } finally {
            setHistoryLoading(false);
        }
    };

    // Prepare Chart Data for Fluent UI
    const chartData: ILineChartProps | null = useMemo(() => {
        if (!historyData || historyData.length === 0) return null;

        const pageviewPoints: ILineChartDataPoint[] = historyData.map(item => ({
            x: new Date(item.month + '-01'), // Approximate to 1st of month
            y: item.pageviews,
            legend: item.month,
            xAxisCalloutData: item.month,
            yAxisCalloutData: `${item.pageviews} sidevisninger`
        }));

        const customEventPoints: ILineChartDataPoint[] = historyData.map(item => ({
            x: new Date(item.month + '-01'),
            y: item.custom_events,
            legend: item.month,
            xAxisCalloutData: item.month,
            yAxisCalloutData: `${item.custom_events} egendefinerte`
        }));

        return {
            data: {
                lineChartData: [
                    {
                        legend: 'Sidevisninger',
                        data: pageviewPoints,
                        color: '#0067c5',
                    },
                    {
                        legend: 'Egendefinerte',
                        data: customEventPoints,
                        color: '#c30000',
                    }
                ]
            }
        };
    }, [historyData]);

    return (
        <ChartLayout
            title="Diagnoseverktøy"
            description="Oversikt over aktivitet på alle nettsteder og apper."
            currentPage="diagnose"
            filters={
                <>
                    <WebsitePicker
                        selectedWebsite={selectedWebsiteFilter}
                        onWebsiteChange={setSelectedWebsiteFilter}
                        variant="minimal"
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
                        legend="Miljø"
                        value={environment}
                        onChange={(val: string) => setEnvironment(val)}
                    >
                        <div className="flex gap-4">
                            <Radio value="all">Alle miljø</Radio>
                            <Radio value="prod">Prod-miljø</Radio>
                            <Radio value="dev">Dev-miljø</Radio>
                        </div>
                    </RadioGroup>
                </>
            }
        >
            {error && (
                <Alert variant="error" className="mb-4">
                    {error}
                </Alert>
            )}

            {loading && (
                <div className="flex flex-col justify-center items-center h-full gap-4">
                    <Loader size="xlarge" title="Henter diagnose..." />
                    <div className="text-center text-[var(--ax-text-subtle)]">
                        <p className="font-medium">Dette kan ta noen sekunder</p>
                        <p className="text-sm">Vi analyserer alle data i valgt periode</p>
                    </div>
                </div>
            )}

            {!loading && data && (
                <div className="flex flex-col gap-6">
                    {/* Highlighted Website Section */}
                    {highlightedWebsite && (
                        <div className="flex flex-col gap-4 mb-3">
                            <Heading level="2" size="medium">Valgt nettsted eller app</Heading>
                            <div className="bg-[var(--ax-bg-default)] border border-gray-300 rounded-lg p-5 shadow-sm">
                                <div className="flex items-center gap-3 mb-4">
                                    <Heading level="3" size="medium">{highlightedWebsite.website_name || highlightedWebsite.website_id}</Heading>
                                    {highlightedWebsite.last_event_at ? (
                                        <Tooltip content="Aktiv i perioden">
                                            <CheckCircle size={20} className="text-green-500" />
                                        </Tooltip>
                                    ) : (
                                        <Tooltip content="Ingen aktivitet registrert i perioden">
                                            <><AlertTriangle size={20} className="text-yellow-500" /> (trenger tilsyn)</>
                                        </Tooltip>
                                    )}
                                </div>
                                {highlightedWebsite.domain && (
                                    <div className="text-sm text-gray-500 -mt-2 mb-4">{highlightedWebsite.domain}</div>
                                )}
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                                    <div className="p-4 rounded-lg border border-[var(--ax-border-neutral-subtle)]">
                                        <div className="text-sm text-gray-500 mb-1 font-medium">Sidevisninger</div>
                                        <div className="text-2xl font-bold">{highlightedWebsite.pageviews.toLocaleString('no-NO')}</div>
                                    </div>
                                    <div className="p-4 rounded-lg border border-[var(--ax-border-neutral-subtle)]">
                                        <div className="text-sm text-gray-500 mb-1 font-medium">Egendefinerte</div>
                                        <div className="text-2xl font-bold">{highlightedWebsite.custom_events.toLocaleString('no-NO')}</div>
                                    </div>
                                    <div className="p-4 rounded-lg border border-[var(--ax-border-neutral-subtle)]">
                                        <div className="text-sm text-gray-500 mb-1 font-medium">Siste aktivitet</div>
                                        <div className="text-xl font-semibold">
                                            {highlightedWebsite.last_event_at
                                                ? format(new Date(highlightedWebsite.last_event_at), 'd. MMM yyyy', { locale: nb })
                                                : <span className="text-red-600">Ingen for valgt periode</span>
                                            }
                                        </div>
                                    </div>
                                </div>
                                {!highlightedWebsite.last_event_at ? (
                                    <button
                                        onClick={() => handleExplore(highlightedWebsite)}
                                        className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-md font-medium transition-colors shadow-sm"
                                    >
                                        Kjør diagnose
                                    </button>
                                ) : (
                                    <></>
                                )}
                            </div>
                        </div>
                    )}

                    <div className="flex flex-col gap-2">
                        <Heading level="2" size="medium">Resultater for {getEnvironmentTitle()}</Heading>
                    </div>

                    {/* Quick Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-[var(--ax-bg-default)] p-4 rounded-lg border border-[var(--ax-border-neutral-subtle)] shadow-sm">
                            <div className="text-sm text-gray-500 font-medium">Totalt antall nettsteder</div>
                            <div className="text-2xl font-bold mt-1">{totalWebsites}</div>
                        </div>
                        <div className="bg-[var(--ax-bg-default)] p-4 rounded-lg border border-[var(--ax-border-neutral-subtle)] shadow-sm">
                            <div className="text-sm text-gray-500 font-medium">Active i perioden</div>
                            <div className="text-2xl font-bold mt-1 text-green-600">{activeWebsites}</div>
                        </div>
                        <div className="bg-[var(--ax-bg-default)] p-4 rounded-lg border border-[var(--ax-border-neutral-subtle)] shadow-sm">
                            <div className="text-sm text-gray-500 font-medium">Ingen aktivitet i perioden</div>
                            <div className="text-2xl font-bold mt-1 text-red-600">{inactiveWebsites}</div>
                        </div>
                    </div>

                    <div className="bg-[var(--ax-bg-default)] rounded-lg border border-[var(--ax-border-neutral-subtle)] shadow-sm overflow-hidden">
                        <div className="p-4 border-b border-[var(--ax-border-neutral-subtle)]">
                            <Tabs value={activeTab} onChange={setActiveTab}>
                                <Tabs.List>
                                    <Tabs.Tab value="all" label="Alle" />
                                    <Tabs.Tab value="attention" label="Trenger tilsyn" icon={<AlertTriangle size={16} className="text-yellow-500" />} />
                                </Tabs.List>
                            </Tabs>
                        </div>

                        <div className="overflow-x-auto">
                            <Table sort={sort} onSortChange={handleSort}>
                                <Table.Header>
                                    <Table.Row>
                                        <Table.HeaderCell>Status</Table.HeaderCell>
                                        <Table.HeaderCell>Nettsted</Table.HeaderCell>
                                        <Table.HeaderCell onClick={() => handleSort('pageviews')} align="right" className="cursor-pointer hover:bg-[var(--ax-bg-neutral-soft)]">
                                            Sidevisninger
                                        </Table.HeaderCell>
                                        <Table.HeaderCell onClick={() => handleSort('custom_events')} align="right" className="cursor-pointer hover:bg-[var(--ax-bg-neutral-soft)]">
                                            Egendefinerte
                                        </Table.HeaderCell>
                                        <Table.HeaderCell onClick={() => handleSort('total')} align="right" className="cursor-pointer hover:bg-[var(--ax-bg-neutral-soft)]">
                                            Totalt
                                        </Table.HeaderCell>
                                        {activeTab !== 'attention' && (
                                            <Table.HeaderCell onClick={() => handleSort('last_event_at')} align="right" className="cursor-pointer hover:bg-[var(--ax-bg-neutral-soft)]">
                                                Siste aktivitet
                                            </Table.HeaderCell>
                                        )}
                                    </Table.Row>
                                </Table.Header>
                                <Table.Body>
                                    {sortedData.map((row) => (
                                        <Table.Row key={row.website_id}>
                                            <Table.DataCell>
                                                {row.last_event_at ? (
                                                    <Tooltip content="Aktiv i perioden">
                                                        <CheckCircle size={20} className="text-green-500" />
                                                    </Tooltip>
                                                ) : (
                                                    <Tooltip content="Ingen aktivitet registrert i perioden">
                                                        <AlertTriangle size={20} className="text-yellow-500" />
                                                    </Tooltip>
                                                )}
                                            </Table.DataCell>
                                            <Table.DataCell className="font-medium">
                                                <button
                                                    onClick={() => handleExplore(row)}
                                                    className="text-blue-600 hover:underline text-left"
                                                >
                                                    {row.website_name || row.website_id}
                                                </button>
                                                {row.domain && <div className="text-xs text-gray-500">{row.domain}</div>}
                                            </Table.DataCell>
                                            <Table.DataCell align="right">
                                                {row.pageviews.toLocaleString('no-NO')}
                                            </Table.DataCell>
                                            <Table.DataCell align="right">
                                                {row.custom_events.toLocaleString('no-NO')}
                                            </Table.DataCell>
                                            <Table.DataCell align="right" className="font-semibold">
                                                {(row.pageviews + row.custom_events).toLocaleString('no-NO')}
                                            </Table.DataCell>
                                            {activeTab !== 'attention' && (
                                                <Table.DataCell align="right" className="whitespace-nowrap">
                                                    {row.last_event_at
                                                        ? format(new Date(row.last_event_at), 'd. MMM yyyy HH:mm', { locale: nb })
                                                        : <span className="text-gray-400">-</span>
                                                    }
                                                </Table.DataCell>
                                            )}
                                        </Table.Row>
                                    ))}
                                </Table.Body>
                            </Table>
                        </div>
                        {queryStats && (
                            <div className="p-4 border-t border-[var(--ax-border-neutral-subtle)] bg-[var(--ax-bg-neutral-soft)] text-xs text-gray-500 text-right">
                                Data prosessert: {queryStats.totalBytesProcessedGB} GB
                            </div>
                        )}
                    </div>
                </div>
            )}

            {isModalOpen && (
                <div
                    className="fixed inset-0 flex items-center justify-center p-4"
                    style={{
                        zIndex: 9999,
                        backgroundColor: 'rgba(0, 0, 0, 0.7)',
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0
                    }}
                    onClick={() => setIsModalOpen(false)}
                >
                    <div
                        className="bg-[var(--ax-bg-default)] rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="sticky top-0 bg-[var(--ax-bg-default)] border-b border-[var(--ax-border-neutral-subtle)] px-6 py-4 flex justify-between items-center">
                            <Heading level="2" size="medium">
                                {selectedWebsite?.website_name || 'Nettstedsanalyse'}
                            </Heading>
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="text-gray-400 hover:text-[var(--ax-text-subtle)] transition-colors"
                            >
                                <X size={24} />
                            </button>
                        </div>

                        <div className="px-6 py-6">
                            {historyLoading ? (
                                <div className="flex justify-center p-8">
                                    <Loader size="large" />
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    <div className="bg-[var(--ax-bg-neutral-soft)] p-4 rounded-lg border border-[var(--ax-border-neutral-subtle)]">
                                        <Heading level="3" size="xsmall" className="mb-1 text-[var(--ax-text-subtle)]">
                                            Siste registrerte aktivitet
                                        </Heading>
                                        <div className="text-xl font-bold">
                                            {absoluteLastEvent
                                                ? format(new Date(absoluteLastEvent), 'd. MMMM yyyy HH:mm', { locale: nb })
                                                : 'Aldri registrert aktivitet'
                                            }
                                        </div>
                                    </div>

                                    <div>
                                        <Heading level="3" size="small" className="mb-4">
                                            Aktivitet siste 6 måneder
                                        </Heading>
                                        <div className="h-64 w-full">
                                            {chartData ? (
                                                <LineChart
                                                    data={chartData.data}
                                                    legendsOverflowText={'Overflow Items'}
                                                    yAxisTickFormat={(d: any) => d.toLocaleString('nb-NO')}
                                                    yAxisTickCount={5}
                                                    allowMultipleShapesForPoints={false}
                                                    enablePerfOptimization={true}
                                                    margins={{ left: 35, right: 20, top: 20, bottom: 35 }}
                                                    legendProps={{
                                                        allowFocusOnLegends: true,
                                                        styles: {
                                                            text: { color: 'var(--ax-text-default)' },
                                                        }
                                                    }}
                                                />
                                            ) : (
                                                <div className="flex items-center justify-center h-full text-gray-500">
                                                    Ingen data funnet for siste 6 måneder
                                                </div>
                                            )}
                                        </div>
                                        {historyQueryStats && (
                                            <div className="text-sm text-[var(--ax-text-subtle)] text-right mt-2">
                                                Data prosessert: {historyQueryStats.totalBytesProcessedGB} GB
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </ChartLayout>
    );
};

export default Diagnosis;

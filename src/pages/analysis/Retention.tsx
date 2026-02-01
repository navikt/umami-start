
import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button, Alert, Loader, Tabs, TextField, Heading, BodyShort } from '@navikt/ds-react';
import { LineChart, ILineChartDataPoint, ILineChartProps, ResponsiveContainer } from '@fluentui/react-charting';
import { Download, Share2, Check } from 'lucide-react';
import { parseISO } from 'date-fns';
import ChartLayout from '../../components/analysis/ChartLayout';
import WebsitePicker from '../../components/analysis/WebsitePicker';
import PeriodPicker from '../../components/analysis/PeriodPicker';
import { Website } from '../../types/chart';
import { normalizeUrlToPath, getStoredPeriod, savePeriodPreference } from '../../lib/utils';


const Retention = () => {
    const [selectedWebsite, setSelectedWebsite] = useState<Website | null>(null);
    const [searchParams] = useSearchParams();

    // Initialize state from URL params
    const [urlPath, setUrlPath] = useState<string>(() => searchParams.get('urlPath') || '');
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

    const [retentionData, setRetentionData] = useState<any[]>([]);
    const [chartData, setChartData] = useState<ILineChartProps | null>(null);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<string>('chart');
    const [hasAttemptedFetch, setHasAttemptedFetch] = useState<boolean>(false);
    const [queryStats, setQueryStats] = useState<any>(null);
    const [copySuccess, setCopySuccess] = useState<boolean>(false);
    const [hasAutoSubmitted, setHasAutoSubmitted] = useState<boolean>(false);

    // Auto-submit when website is selected (from localStorage, URL, or Home page picker)
    useEffect(() => {
        if (selectedWebsite && !hasAutoSubmitted && !loading) {
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

    // Helper function to normalize URL input - extracts path from full URLs

    const fetchData = async () => {
        if (!selectedWebsite) return;

        setLoading(true);
        setError(null);
        setRetentionData([]);
        setChartData(null);
        setHasAttemptedFetch(true);

        const normalizedUrl = normalizeUrlToPath(urlPath);

        // Calculate date range based on period
        const now = new Date();
        let startDate: Date;
        let endDate: Date;

        if (period === 'current_month') {
            // First day of current month to now
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            endDate = now;
        } else if (period === 'last_month') {
            // First day to last day of previous month
            startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            endDate = new Date(now.getFullYear(), now.getMonth(), 0); // Last day of previous month
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
            // Default fallback
            startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            endDate = new Date(now.getFullYear(), now.getMonth(), 0);
        }

        try {
            const response = await fetch('/api/bigquery/retention', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    websiteId: selectedWebsite.id,
                    startDate: startDate.toISOString(),
                    endDate: endDate.toISOString(),
                    urlPath: normalizedUrl,
                }),
            });

            if (!response.ok) {
                throw new Error('Kunne ikke hente retensjonsdata');
            }

            const result = await response.json();
            console.log('Retention data received:', result);

            if (result.error) {
                setError(result.error);
            } else {
                setRetentionData(result.data);

                // Prepare data for FluentUI LineChart
                const points: ILineChartDataPoint[] = result.data.map((item: any) => ({
                    x: item.day,
                    y: item.percentage,
                    legend: `Dag ${item.day} `,
                    xAxisCalloutData: `Dag ${item.day}: ${item.percentage}% (${item.returning_users.toLocaleString('nb-NO')} brukere)`,
                    yAxisCalloutData: `${item.percentage}% `
                }));

                const chartData: ILineChartProps = {
                    data: {
                        lineChartData: [
                            {
                                legend: 'All Users',
                                data: points,
                                color: '#0078d4',
                            }
                        ]
                    },
                };
                setChartData(chartData);

                // Store query stats if available
                if (result.queryStats) {
                    setQueryStats(result.queryStats);
                }

                // Update URL with configuration for sharing
                const newParams = new URLSearchParams(window.location.search);
                newParams.set('period', period);
                if (normalizedUrl) {
                    newParams.set('urlPath', normalizedUrl);
                } else {
                    newParams.delete('urlPath');
                }

                // Update URL without navigation
                window.history.replaceState({}, '', `${window.location.pathname}?${newParams.toString()}`);
            }
        } catch (err) {
            console.error('Error fetching retention data:', err);
            setError('Det oppstod en feil ved henting av data.');
        } finally {
            setLoading(false);
        }
    };

    const downloadCSV = () => {
        if (!retentionData || retentionData.length === 0) return;

        const headers = ['Dag', 'Antall brukere', 'Prosent'];
        const csvRows = [
            headers.join(','),
            ...retentionData.map((item) => {
                return [
                    `Dag ${item.day} `,
                    item.returning_users,
                    `${item.percentage}% `
                ].join(',');
            })
        ];

        const csvContent = csvRows.join('\n');
        const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `retention_${selectedWebsite?.name || 'data'}_${new Date().toISOString().slice(0, 10)}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    // Calculate retention stats
    const retentionStats = useMemo(() => {
        if (!retentionData || retentionData.length === 0) return null;

        const returningData = retentionData.filter((item: any) => item.day > 0);
        if (returningData.length === 0) return null;

        const day0Data = retentionData.find((item: any) => item.day === 0);
        const baseline = day0Data?.returning_users || Math.max(...retentionData.map((item: any) => item.returning_users));






        // Find Day 1 and Day 7 data for specific loyalty checkpoints
        const day1 = retentionData.find((item: any) => item.day === 1);
        const day7 = retentionData.find((item: any) => item.day === 7);
        // Fallback to last day if Day 7 isn't available but we have data (e.g. short ranges)
        const lastDay = returningData[returningData.length - 1];

        return {
            baseline,
            day1,
            day7,
            lastDay
        };
    }, [retentionData]);

    const isCurrentMonthData = useMemo(() => {
        if (period === 'current_month') return true;
        if (period === 'custom' && customEndDate) {
            const now = new Date();
            const isToday = customEndDate.getDate() === now.getDate() &&
                customEndDate.getMonth() === now.getMonth() &&
                customEndDate.getFullYear() === now.getFullYear();
            return isToday;
        }
        return false;
    }, [period, customEndDate]);

    const RetentionStats = () => {
        if (!retentionStats) return null;

        return (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-[var(--ax-bg-default)] p-4 rounded-lg border border-[var(--ax-border-neutral-subtle)] shadow-sm">
                    <div className="text-sm text-[var(--ax-text-default)] font-medium mb-1">Totalt antall brukere</div>
                    <div className="text-2xl font-bold text-[var(--ax-text-default)]">
                        {retentionStats.baseline.toLocaleString('nb-NO')}
                    </div>
                    <div className="text-sm text-[var(--ax-text-subtle)] mt-1">
                        Unike brukere (Dag 0)
                    </div>
                </div>
                <div className="bg-[var(--ax-bg-default)] p-4 rounded-lg border border-[var(--ax-border-neutral-subtle)] shadow-sm">
                    <div className="text-sm text-[var(--ax-text-default)] font-medium mb-1">Kom tilbake etter 1 dag</div>
                    <div className="text-2xl font-bold text-[var(--ax-text-default)]">
                        {retentionStats.day1 ? ((retentionStats.day1.returning_users / retentionStats.baseline) * 100).toFixed(1) : 0}%
                    </div>
                    <div className="text-sm text-[var(--ax-text-subtle)] mt-1">
                        {retentionStats.day1 ? retentionStats.day1.returning_users.toLocaleString('nb-NO') : 0} unike brukere
                    </div>
                </div>
                <div className="bg-[var(--ax-bg-default)] p-4 rounded-lg border border-[var(--ax-border-neutral-subtle)] shadow-sm">
                    <div className="text-sm text-[var(--ax-text-default)] font-medium mb-1">
                        {retentionStats.day7 ? 'Kom tilbake etter 1 uke' : `Kom tilbake etter ${retentionStats.lastDay?.day || 0} dager`}
                    </div>
                    <div className="text-2xl font-bold text-[var(--ax-text-default)]">
                        {retentionStats.day7
                            ? ((retentionStats.day7.returning_users / retentionStats.baseline) * 100).toFixed(1)
                            : (retentionStats.lastDay ? ((retentionStats.lastDay.returning_users / retentionStats.baseline) * 100).toFixed(1) : 0)}%
                    </div>
                    <div className="text-sm text-[var(--ax-text-subtle)] mt-1">
                        {retentionStats.day7
                            ? retentionStats.day7.returning_users.toLocaleString('nb-NO')
                            : (retentionStats.lastDay ? retentionStats.lastDay.returning_users.toLocaleString('nb-NO') : 0)} unike brukere
                    </div>
                </div>
            </div>
        );
    };

    return (
        <ChartLayout
            title="Brukerlojalitet"
            description="Se hvor mange som kommer tilbake etter sitt første besøk."
            currentPage="brukerlojalitet"
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
                    <div className="w-full sm:w-[300px]">
                        <TextField
                            size="small"
                            label="Side eller URL"
                            value={urlPath}
                            onChange={(e) => setUrlPath(e.target.value)}
                            onBlur={(e) => setUrlPath(normalizeUrlToPath(e.target.value))}
                        />
                    </div>

                    <PeriodPicker
                        period={period}
                        onPeriodChange={setPeriod}
                        startDate={customStartDate}
                        onStartDateChange={setCustomStartDate}
                        endDate={customEndDate}
                        onEndDateChange={setCustomEndDate}
                    />

                    <div className="flex items-end pb-[2px]">
                        <Button
                            onClick={fetchData}
                            size="small"
                            disabled={!selectedWebsite || loading}
                            loading={loading}
                        >
                            Vis brukerlojalitet
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

            {loading && (
                <div className="flex justify-center items-center h-full">
                    <Loader size="xlarge" title="Beregner retensjon..." />
                </div>
            )}

            {!loading && retentionData.length > 0 && (
                <>

                    {isCurrentMonthData && hasAttemptedFetch && retentionData.length > 0 && (
                        <Alert variant="warning" className="mb-4">
                            <Heading spacing size="small" level="3">
                                Ufullstendige data for inneværende måned
                            </Heading>
                            <BodyShort spacing>
                                Med Umami får brukere ny anonym ID ved starten av hver måned.
                                Det gjør at tall for inneværende måned kan være ufullstendige.
                                For mest pålitelige tall anbefales det å se på en fullført måned.
                            </BodyShort>
                            <Button
                                size="small"
                                variant="secondary"
                                onClick={() => setPeriod('last_month')}
                                className="mt-2"
                            >
                                Bytt til forrige måned
                            </Button>
                        </Alert>
                    )}



                    <RetentionStats />

                    <Tabs value={activeTab} onChange={setActiveTab}>
                        <Tabs.List>
                            <Tabs.Tab value="chart" label="Linjediagram" />
                            <Tabs.Tab value="table" label="Tabell" />
                        </Tabs.List>

                        <Tabs.Panel value="chart" className="pt-4">
                            <div style={{ width: '100%', height: '500px' }}>
                                {chartData && (
                                    <ResponsiveContainer>
                                        <LineChart
                                            data={chartData.data}
                                            legendsOverflowText={'Overflow Items'}
                                            yAxisTickFormat={(d: any) => `${d}% `}
                                            legendProps={{
                                                allowFocusOnLegends: true,
                                                styles: {
                                                    text: { color: 'var(--ax-text-default)' },
                                                }
                                            }}
                                        />
                                    </ResponsiveContainer>
                                )}
                            </div>
                            {queryStats && (
                                <div className="text-sm text-[var(--ax-text-subtle)] text-right mt-4">
                                    Data prosessert: {queryStats.totalBytesProcessedGB} GB
                                </div>
                            )}
                        </Tabs.Panel>

                        <Tabs.Panel value="table" className="pt-4">
                            <div className="border rounded-lg overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="min-w-full divide-y divide-[var(--ax-border-neutral-subtle)]">
                                        <thead className="bg-[var(--ax-bg-neutral-soft)]">
                                            <tr>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-[var(--ax-text-default)] uppercase tracking-wider">Dag</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-[var(--ax-text-default)] uppercase tracking-wider">Antall brukere</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-[var(--ax-text-default)] uppercase tracking-wider">Prosent</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-[var(--ax-bg-default)] divide-y divide-[var(--ax-border-neutral-subtle)]">
                                            {retentionData.map((item, index) => (
                                                <tr key={index} className="hover:bg-[var(--ax-bg-neutral-soft)]">
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-[var(--ax-text-default)]">
                                                        Dag {item.day}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--ax-text-default)]">
                                                        {item.returning_users.toLocaleString('nb-NO')}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--ax-text-default)]">
                                                        {item.percentage}%
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                <div className="flex gap-2 p-3 bg-[var(--ax-bg-neutral-soft)] border-t justify-between items-center">
                                    <Button
                                        size="small"
                                        variant="secondary"
                                        onClick={downloadCSV}
                                        icon={<Download size={16} />}
                                    >
                                        Last ned CSV
                                    </Button>
                                    {queryStats && (
                                        <span className="text-sm text-[var(--ax-text-subtle)]">
                                            Data prosessert: {queryStats.totalBytesProcessedGB} GB
                                        </span>
                                    )}
                                </div>
                            </div>
                        </Tabs.Panel>
                    </Tabs>
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
            )}

            {!loading && !error && retentionData.length === 0 && hasAttemptedFetch && (
                <div className="text-center p-8 text-gray-500 bg-[var(--ax-bg-neutral-soft)] rounded-lg border border-[var(--ax-border-neutral-subtle)] mt-4">
                    Ingen data funnet for valgt periode.
                </div>
            )}
        </ChartLayout>
    );
};

export default Retention;

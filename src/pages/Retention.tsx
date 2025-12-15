
import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button, Alert, Loader, Tabs, TextField, Switch, Heading } from '@navikt/ds-react';
import { LineChart, ILineChartDataPoint, ILineChartProps, ResponsiveContainer } from '@fluentui/react-charting';
import { Download, Share2, Check } from 'lucide-react';
import ChartLayout from '../components/ChartLayout';
import WebsitePicker from '../components/WebsitePicker';
import PeriodPicker from '../components/PeriodPicker';
import { Website } from '../types/chart';

const Retention = () => {
    const [selectedWebsite, setSelectedWebsite] = useState<Website | null>(null);
    const [searchParams] = useSearchParams();

    // Initialize state from URL params
    const [urlPath, setUrlPath] = useState<string>(() => searchParams.get('urlPath') || '');
    const [period, setPeriod] = useState<string>(() => searchParams.get('period') || 'current_month');
    const [customStartDate, setCustomStartDate] = useState<Date | undefined>(undefined);
    const [customEndDate, setCustomEndDate] = useState<Date | undefined>(undefined);
    const [businessDaysOnly, setBusinessDaysOnly] = useState<boolean>(() => {
        const param = searchParams.get('businessDaysOnly');
        return param === 'true';
    });
    const [retentionData, setRetentionData] = useState<any[]>([]);
    const [chartData, setChartData] = useState<ILineChartProps | null>(null);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<string>('chart');
    const [hasAttemptedFetch, setHasAttemptedFetch] = useState<boolean>(false);
    const [queryStats, setQueryStats] = useState<any>(null);
    const [copySuccess, setCopySuccess] = useState<boolean>(false);
    const [hasAutoSubmitted, setHasAutoSubmitted] = useState<boolean>(false);

    // Auto-submit when URL parameters are present (for shared links)
    useEffect(() => {
        // Only auto-submit if there are config params beyond just websiteId
        const hasConfigParams = searchParams.has('period') || searchParams.has('urlPath') || searchParams.has('businessDaysOnly');
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

    // Helper function to normalize URL input - extracts path from full URLs
    const normalizeUrlToPath = (input: string): string => {
        if (!input.trim()) return '';

        let trimmed = input.trim();

        try {
            // Check if input looks like a full URL (contains protocol)
            if (trimmed.includes('://')) {
                const url = new URL(trimmed);
                return url.pathname;
            }

            // Handle cases like "/nav.no/arbeid" - remove leading slash if it looks like a domain
            if (trimmed.startsWith('/') && trimmed.includes('.')) {
                const withoutLeadingSlash = trimmed.substring(1);
                // Check if removing the slash reveals a domain pattern
                if (withoutLeadingSlash.includes('/') && !withoutLeadingSlash.startsWith('/')) {
                    trimmed = withoutLeadingSlash;
                }
            }

            // Check if input looks like a domain without protocol
            // e.g., "nav.no/arbeid" or "www.nav.no/arbeid"
            // Pattern: contains a dot, doesn't start with /, and has a path separator
            if (!trimmed.startsWith('/') && trimmed.includes('.') && trimmed.includes('/')) {
                // Prepend protocol and try to parse
                const url = new URL('https://' + trimmed);
                return url.pathname;
            }
        } catch (e) {
            // If URL parsing fails, treat as path
        }

        return trimmed;
    };

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
                    businessDaysOnly
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
                    xAxisCalloutData: `Dag ${item.day}: ${item.percentage}% (${item.returning_users} brukere)`,
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
                newParams.set('businessDaysOnly', String(businessDaysOnly));
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

    return (
        <ChartLayout
            title="Brukerlojalitet"
            description="Se hvor mange som kommer tilbake etter sitt første besøk."
            currentPage="brukerlojalitet"
            filters={
                <>
                    <WebsitePicker
                        selectedWebsite={selectedWebsite}
                        onWebsiteChange={setSelectedWebsite}
                        variant="minimal"
                    />

                    <TextField
                        label="Url-sti (valgfritt)"
                        description="F.eks. / for forsiden"
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

                    <Switch
                        size="small"
                        checked={businessDaysOnly}
                        onChange={(e) => setBusinessDaysOnly(e.target.checked)}
                    >
                        Vis kun virkedager
                    </Switch>

                    <Button
                        onClick={fetchData}
                        disabled={!selectedWebsite || loading}
                        loading={loading}
                        className="w-full"
                    >
                        Vis brukerlojalitet
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
                    <Loader size="xlarge" title="Beregner retensjon..." />
                </div>
            )}

            {!loading && retentionData.length > 0 && (
                <>
                    <div className="flex justify-between items-center mb-4">
                        <Heading level="2" size="medium">Resultater</Heading>
                        <Button
                            size="small"
                            variant="secondary"
                            icon={copySuccess ? <Check size={16} /> : <Share2 size={16} />}
                            onClick={copyShareLink}
                        >
                            {copySuccess ? 'Kopiert!' : 'Del analyse'}
                        </Button>
                    </div>
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
                                        />
                                    </ResponsiveContainer>
                                )}
                            </div>
                            {queryStats && (
                                <div className="text-sm text-gray-600 text-right mt-4">
                                    Data prosessert: {queryStats.totalBytesProcessedGB} GB
                                </div>
                            )}
                        </Tabs.Panel>

                        <Tabs.Panel value="table" className="pt-4">
                            <div className="border rounded-lg overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="min-w-full divide-y divide-gray-200">
                                        <thead className="bg-gray-100">
                                            <tr>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Dag</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Antall brukere</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Prosent</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-200">
                                            {retentionData.map((item, index) => (
                                                <tr key={index} className="hover:bg-gray-50">
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                                        Dag {item.day}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                        {item.returning_users.toLocaleString('nb-NO')}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                        {item.percentage}%
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                <div className="flex gap-2 p-3 bg-gray-50 border-t justify-between items-center">
                                    <Button
                                        size="small"
                                        variant="secondary"
                                        onClick={downloadCSV}
                                        icon={<Download size={16} />}
                                    >
                                        Last ned CSV
                                    </Button>
                                    {queryStats && (
                                        <span className="text-sm text-gray-600">
                                            Data prosessert: {queryStats.totalBytesProcessedGB} GB
                                        </span>
                                    )}
                                </div>
                            </div>
                        </Tabs.Panel>
                    </Tabs>
                </>
            )}

            {!loading && !error && retentionData.length === 0 && hasAttemptedFetch && (
                <div className="text-center p-8 text-gray-500 bg-gray-50 rounded-lg border border-gray-200 mt-4">
                    Ingen data funnet for valgt periode.
                </div>
            )}
        </ChartLayout>
    );
};

export default Retention;

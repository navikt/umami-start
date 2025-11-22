
import { useState } from 'react';
import { Heading, Button, Alert, Loader, BodyShort, Tabs, TextField, Radio, RadioGroup, Switch } from '@navikt/ds-react';
import { LineChart, ILineChartDataPoint, ILineChartProps } from '@fluentui/react-charting';
import { Download } from 'lucide-react';
import WebsitePicker from '../components/WebsitePicker';
import { Website } from '../types/chart';

const Retention = () => {
    const [selectedWebsite, setSelectedWebsite] = useState<Website | null>(null);
    const [urlPath, setUrlPath] = useState<string>('');
    const [period, setPeriod] = useState<string>('current_month');
    const [businessDaysOnly, setBusinessDaysOnly] = useState<boolean>(false);
    const [retentionData, setRetentionData] = useState<any[]>([]);
    const [chartData, setChartData] = useState<ILineChartProps | null>(null);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<string>('chart');
    const [hasAttemptedFetch, setHasAttemptedFetch] = useState<boolean>(false);

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
        } else {
            // First day to last day of previous month
            startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            endDate = new Date(now.getFullYear(), now.getMonth(), 0); // Last day of previous month
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
        <div className="py-8 max-w-[1600px] mx-auto">
            <div className="mb-8">
                <Heading level="1" size="xlarge" className="mb-2">
                    Brukerlojalitet
                </Heading>
                <BodyShort className="text-gray-600">
                    Viser hvor mange brukere som kommer tilbake etter sitt første besøk.
                </BodyShort>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
                <div className="space-y-6">
                    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                        <div className="space-y-4">
                            <div className="pb-2">
                                <WebsitePicker
                                    selectedWebsite={selectedWebsite}
                                    onWebsiteChange={setSelectedWebsite}
                                />
                            </div>

                            <RadioGroup
                                legend="Periode"
                                value={period}
                                onChange={(val: string) => setPeriod(val)}
                            >
                                <Radio value="current_month">Denne måneden</Radio>
                                <Radio value="last_month">Forrige måned</Radio>
                            </RadioGroup>

                            <TextField
                                label="Url-sti (valgfritt)"
                                description="F.eks. / for forsiden"
                                value={urlPath}
                                onChange={(e) => setUrlPath(e.target.value)}
                            />

                            <Switch
                                checked={businessDaysOnly}
                                onChange={(e) => setBusinessDaysOnly(e.target.checked)}
                            >
                                Kun virkedager
                            </Switch>

                            <Button
                                onClick={fetchData}
                                disabled={!selectedWebsite || loading}
                                loading={loading}
                                className="w-full"
                            >
                                Vis retensjon
                            </Button>
                        </div>
                    </div>
                </div>

                <div className="md:col-span-2 min-h-[600px] bg-white p-6 rounded-lg shadow-sm border border-gray-200">
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
                        <Tabs value={activeTab} onChange={setActiveTab}>
                            <Tabs.List>
                                <Tabs.Tab value="chart" label="Linjediagram" />
                                <Tabs.Tab value="table" label="Tabell" />
                            </Tabs.List>

                            <Tabs.Panel value="chart" className="pt-4">
                                <div style={{ width: '100%', height: '500px' }}>
                                    {chartData && (
                                        <LineChart
                                            data={chartData.data}
                                            legendsOverflowText={'Overflow Items'}
                                            yAxisTickFormat={(d: any) => `${d}% `}
                                            height={500}
                                            width={800}
                                        />
                                    )}
                                </div>
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
                                    <div className="flex gap-2 p-3 bg-gray-50 border-t">
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
                            </Tabs.Panel>
                        </Tabs>
                    )}

                    {!loading && !error && retentionData.length === 0 && hasAttemptedFetch && (
                        <div className="text-center p-8 text-gray-500 bg-gray-50 rounded-lg border border-gray-200 mt-4">
                            Ingen data funnet for valgt periode.
                        </div>
                    )}
                </div>

                {/* Cross-navigation */}
                <div className="mt-8 pt-6 border-t border-gray-200">
                    <BodyShort className="text-gray-600 mb-3">Andre graftyper:</BodyShort>
                    <div className="flex gap-3">
                        <Button
                            as="a"
                            href="/brukerreiser"
                            variant="secondary"
                            size="small"
                        >
                            Brukerreiser
                        </Button>
                        <Button
                            as="a"
                            href="/trakt"
                            variant="secondary"
                            size="small"
                        >
                            Traktanalyse
                        </Button>
                        <Button
                            as="a"
                            href="/grafbygger"
                            variant="secondary"
                            size="small"
                        >
                            Grafbygger
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Retention;

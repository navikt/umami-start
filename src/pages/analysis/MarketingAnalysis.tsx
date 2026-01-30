import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button, Alert, Loader, Tabs, TextField, Select, Table, Heading, Pagination, VStack } from '@navikt/ds-react';
import { Download, Share2, Check } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import ChartLayout from '../../components/analysis/ChartLayout';
import WebsitePicker from '../../components/analysis/WebsitePicker';
import PeriodPicker from '../../components/analysis/PeriodPicker';
import { normalizeUrlToPath } from '../../lib/utils';
import { Website } from '../../types/chart';

const MarketingAnalysis = () => {
    const [selectedWebsite, setSelectedWebsite] = useState<Website | null>(null);
    const [searchParams] = useSearchParams();

    // Initialize state from URL params
    const [urlPath, setUrlPath] = useState<string>(() => searchParams.get('urlPath') || '');
    const [period, setPeriod] = useState<string>(() => searchParams.get('period') || 'current_month');

    // Support custom dates from URL
    const fromDateFromUrl = searchParams.get("from");
    const toDateFromUrl = searchParams.get("to");
    const initialCustomStartDate = fromDateFromUrl ? parseISO(fromDateFromUrl) : undefined;
    const initialCustomEndDate = toDateFromUrl ? parseISO(toDateFromUrl) : undefined;

    const [customStartDate, setCustomStartDate] = useState<Date | undefined>(initialCustomStartDate);
    const [customEndDate, setCustomEndDate] = useState<Date | undefined>(initialCustomEndDate);



    // Tab states
    const [activeTab, setActiveTab] = useState<string>('source');

    // View options
    const [metricType, setMetricType] = useState<string>(() => searchParams.get('metricType') || 'visitors'); // 'visitors', 'pageviews'
    const [submittedMetricType, setSubmittedMetricType] = useState<string>('visitors'); // Track what was actually submitted

    // Data states
    const [marketingData, setMarketingData] = useState<any>({});
    const [queryStats, setQueryStats] = useState<any>(null);

    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [hasAttemptedFetch, setHasAttemptedFetch] = useState<boolean>(false);
    const [copySuccess, setCopySuccess] = useState<boolean>(false);

    // Auto-submit when URL parameters are present (for shared links)
    useEffect(() => {
        const hasConfigParams = searchParams.has('period') || searchParams.has('metricType') || searchParams.has('urlPath');
        if (selectedWebsite && hasConfigParams && !hasAttemptedFetch) {
            fetchData();
        }
    }, [selectedWebsite]);

    const fetchData = async () => {
        if (!selectedWebsite) return;

        setLoading(true);
        setError(null);
        setMarketingData({});
        setHasAttemptedFetch(true);
        setSubmittedMetricType(metricType);

        // Calculate date range based on period
        const now = new Date();
        let startDate: Date;
        let endDate: Date;

        if (period === 'current_month') {
            startDate = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));
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
            const normalizedPath = urlPath !== '/' && urlPath.endsWith('/') ? urlPath.slice(0, -1) : urlPath;

            const url = `/api/bigquery/websites/${selectedWebsite.id}/marketing-stats?startAt=${startDate.getTime()}&endAt=${endDate.getTime()}&limit=100${normalizedPath ? `&urlPath=${encodeURIComponent(normalizedPath)}` : ''}&metricType=${metricType}`;

            const response = await fetch(url);
            if (!response.ok) throw new Error('Kunne ikke hente markedsdata');
            const result = await response.json();
            console.log('[MarketingAnalysis] Received data:', result);

            if (result.data) {
                setMarketingData(result.data);
            }
            if (result.queryStats) {
                setQueryStats(result.queryStats);
            }

            // Update URL with configuration for sharing
            // Update URL with configuration for sharing
            const newParams = new URLSearchParams(window.location.search);
            newParams.set('period', period);
            newParams.set('metricType', metricType);
            if (urlPath) {
                newParams.set('urlPath', urlPath);
            } else {
                newParams.delete('urlPath');
            }

            if (period === 'custom' && customStartDate && customEndDate) {
                newParams.set('from', format(customStartDate, 'yyyy-MM-dd'));
                newParams.set('to', format(customEndDate, 'yyyy-MM-dd'));
            } else {
                newParams.delete('from');
                newParams.delete('to');
            }

            // Update URL without navigation
            window.history.replaceState({}, '', `${window.location.pathname}?${newParams.toString()}`);

        } catch (err: any) {
            console.error('Error fetching marketing data:', err);
            setError(err.message || 'Det oppstod en feil ved henting av data.');
        } finally {
            setLoading(false);
        }
    };

    const copyShareLink = async () => {
        try {
            await navigator.clipboard.writeText(window.location.href);
            setCopySuccess(true);
            setTimeout(() => setCopySuccess(false), 2000);
        } catch (err) {
            console.error('Failed to copy link:', err);
        }
    };



    const AnalysisTable = ({ title, data, metricLabel, queryStats }: { title: string, data: any[], metricLabel: string, queryStats: any }) => {
        const [search, setSearch] = useState('');
        const [page, setPage] = useState(1);
        const rowsPerPage = 20;

        const filteredData = data.filter(row =>
            row.name.toLowerCase().includes(search.toLowerCase())
        );

        // Reset to page 1 when search changes
        useEffect(() => {
            setPage(1);
        }, [search]);

        const paginatedData = filteredData.slice((page - 1) * rowsPerPage, page * rowsPerPage);
        const totalPages = Math.ceil(filteredData.length / rowsPerPage);

        const downloadCSV = () => {
            if (!data.length) return;

            const headers = ['Navn', metricLabel];
            const csvRows = [
                headers.join(','),
                ...data.map((item: any) => {
                    return [
                        `"${item.name}"`,
                        item.count
                    ].join(',');
                })
            ];

            const csvContent = csvRows.join('\n');
            const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', `marketing_${title.toLowerCase().replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        };

        return (
            <VStack gap="space-4">
                <div className="flex justify-between items-end">
                    <Heading level="3" size="small">{title}</Heading>
                    <div className="w-64">
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
                    <Table size="small">
                        <Table.Header>
                            <Table.Row>
                                <Table.HeaderCell>Navn</Table.HeaderCell>
                                <Table.HeaderCell align="right">{metricLabel}</Table.HeaderCell>
                            </Table.Row>
                        </Table.Header>
                        <Table.Body>
                            {paginatedData.map((row: any, i: number) => (
                                <Table.Row key={i}>
                                    <Table.DataCell className="truncate max-w-md" title={row.name}>{row.name}</Table.DataCell>
                                    <Table.DataCell align="right">{row.count.toLocaleString('nb-NO')}</Table.DataCell>
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
                                disabled={data.length === 0}
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
            title="Markedsanalyse"
            description="Analyser trafikk basert på UTM-parametere og referanser."
            currentPage="markedsanalyse"
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
                            label="URL-sti"
                            placeholder="URL-sti (valgfritt)"
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

                    <div className="w-full sm:w-auto min-w-[150px]">
                        <Select
                            label="Visning"
                            size="small"
                            value={metricType}
                            onChange={(e) => setMetricType(e.target.value)}
                        >
                            <option value="visitors">Besøkende</option>
                            <option value="pageviews">Sidevisninger</option>
                        </Select>
                    </div>

                    <div className="w-full sm:w-auto self-end pb-[2px]">
                        <Button
                            onClick={fetchData}
                            disabled={!selectedWebsite || loading}
                            loading={loading}
                            size="small"
                        >
                            Vis analyse
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
                    <Loader size="xlarge" title="Henter data..." />
                </div>
            )}

            {!loading && hasAttemptedFetch && !error && (
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
                            <Tabs.Tab value="source" label="Kilde" />
                            <Tabs.Tab value="medium" label="Medium" />
                            <Tabs.Tab value="campaign" label="Kampanje" />
                            <Tabs.Tab value="content" label="Innhold" />
                            <Tabs.Tab value="term" label="Nøkkelord" />
                            <Tabs.Tab value="query" label="Parametere" />
                            <Tabs.Tab value="referrer" label="Henvisningsdomene" />
                        </Tabs.List>

                        <Tabs.Panel value="source" className="pt-4">
                            <AnalysisTable
                                title="Kilde"
                                data={marketingData['source'] || []}
                                metricLabel={submittedMetricType === 'pageviews' ? 'Sidevisninger' : 'Besøkende'}
                                queryStats={queryStats}
                            />
                        </Tabs.Panel>
                        <Tabs.Panel value="medium" className="pt-4">
                            <AnalysisTable
                                title="Medium"
                                data={marketingData['medium'] || []}
                                metricLabel={submittedMetricType === 'pageviews' ? 'Sidevisninger' : 'Besøkende'}
                                queryStats={queryStats}
                            />
                        </Tabs.Panel>
                        <Tabs.Panel value="campaign" className="pt-4">
                            <AnalysisTable
                                title="Kampanje"
                                data={marketingData['campaign'] || []}
                                metricLabel={submittedMetricType === 'pageviews' ? 'Sidevisninger' : 'Besøkende'}
                                queryStats={queryStats}
                            />
                        </Tabs.Panel>
                        <Tabs.Panel value="content" className="pt-4">
                            <AnalysisTable
                                title="Innhold"
                                data={marketingData['content'] || []}
                                metricLabel={submittedMetricType === 'pageviews' ? 'Sidevisninger' : 'Besøkende'}
                                queryStats={queryStats}
                            />
                        </Tabs.Panel>
                        <Tabs.Panel value="term" className="pt-4">
                            <AnalysisTable
                                title="Nøkkelord"
                                data={marketingData['term'] || []}
                                metricLabel={submittedMetricType === 'pageviews' ? 'Sidevisninger' : 'Besøkende'}
                                queryStats={queryStats}
                            />
                        </Tabs.Panel>
                        <Tabs.Panel value="referrer" className="pt-4">
                            <AnalysisTable
                                title="Henvisningsdomene"
                                data={marketingData['referrer'] || []}
                                metricLabel={submittedMetricType === 'pageviews' ? 'Sidevisninger' : 'Besøkende'}
                                queryStats={queryStats}
                            />
                        </Tabs.Panel>
                        <Tabs.Panel value="query" className="pt-4">
                            <AnalysisTable
                                title="URL Parametere"
                                data={marketingData['query'] || []}
                                metricLabel={submittedMetricType === 'pageviews' ? 'Sidevisninger' : 'Besøkende'}
                                queryStats={queryStats}
                            />
                        </Tabs.Panel>
                    </Tabs>
                </>
            )}

        </ChartLayout>
    );
};

export default MarketingAnalysis;

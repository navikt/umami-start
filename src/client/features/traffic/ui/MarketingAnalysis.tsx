import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button, Alert, Loader, Tabs, Select, Table, Heading, Pagination, VStack, HelpText, TextField } from '@navikt/ds-react';
import { Download, Share2, Check } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import ChartLayout from '../../analysis/ui/ChartLayout.tsx';
import WebsitePicker from '../../analysis/ui/WebsitePicker.tsx';
import PeriodPicker from '../../analysis/ui/PeriodPicker.tsx';
import UrlPathFilter from '../../analysis/ui/UrlPathFilter.tsx';
import CookieMixNotice from '../../analysis/ui/CookieMixNotice.tsx';
import { normalizeUrlToPath, getDateRangeFromPeriod, getStoredPeriod, savePeriodPreference, getStoredMetricType, saveMetricTypePreference, getCookieCountByParams, getCookieBadge, getVisitorLabelWithBadge } from '../../../shared/lib/utils.ts';
import type { Website } from '../../../shared/types/chart.ts';
import { useMarketingSupport, useCookieSupport, useCookieStartDate } from '../../../shared/hooks/useSiteimproveSupport.ts';

// Helper function for metric labels
const getMetricLabel = (type: string): string => {
    switch (type) {
        case 'pageviews': return 'Sidevisninger';
        case 'proportion': return 'Andel';
        case 'visits': return 'Økter';
        default: return 'Besøkende';
    }
};

const MarketingAnalysis = () => {
    const [selectedWebsite, setSelectedWebsite] = useState<Website | null>(null);
    const [searchParams] = useSearchParams();

    // Initialize state from URL params - support multiple paths
    const pathsFromUrl = searchParams.getAll('urlPath');
    const initialPaths = pathsFromUrl.length > 0 ? pathsFromUrl.map(p => normalizeUrlToPath(p)).filter(Boolean) : [];
    const [urlPaths, setUrlPaths] = useState<string[]>(initialPaths);
    const [pathOperator, setPathOperator] = useState<string>(() => searchParams.get('pathOperator') || 'equals');
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
    const usesCookies = useCookieSupport(selectedWebsite?.domain);
    const cookieStartDate = useCookieStartDate(selectedWebsite?.domain);

    const hasMarketing = useMarketingSupport(selectedWebsite?.domain, selectedWebsite?.name);

    const currentDateRange = useMemo(() => getDateRangeFromPeriod(period, customStartDate, customEndDate), [period, customStartDate, customEndDate]);
    const cookieBadge = useMemo(() => {
        if (!currentDateRange) return '';
        return getCookieBadge(
            usesCookies,
            cookieStartDate,
            currentDateRange.startDate,
            currentDateRange.endDate
        );
    }, [usesCookies, cookieStartDate, currentDateRange]);
    const isPreCookieRange = useMemo(() => {
        if (!currentDateRange || !cookieStartDate) return false;
        return currentDateRange.endDate.getTime() < cookieStartDate.getTime();
    }, [currentDateRange, cookieStartDate]);



    // Tab states
    const [activeTab, setActiveTab] = useState<string>('referrer');

    // View options
    const [metricType, setMetricTypeState] = useState<string>(() => getStoredMetricType(searchParams.get('metricType')));
    const [submittedMetricType, setSubmittedMetricType] = useState<string>(() => getStoredMetricType(searchParams.get('metricType'))); // Track what was actually submitted

    // Wrap setMetricType to also save to localStorage
    const setMetricType = (newMetricType: string) => {
        setMetricTypeState(newMetricType);
        saveMetricTypePreference(newMetricType);
    };

    // Data states
    type MarketingRow = {
        name: string;
        count: number;
    };

    type MarketingData = Record<string, MarketingRow[]>;

    type QueryStats = {
        totalBytesProcessedGB?: number;
        estimatedCostUSD?: number;
    };

    const [marketingData, setMarketingData] = useState<MarketingData>({});
    const [queryStats, setQueryStats] = useState<QueryStats | null>(null);

    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [hasAttemptedFetch, setHasAttemptedFetch] = useState<boolean>(false);
    const [copySuccess, setCopySuccess] = useState<boolean>(false);
    const [lastAppliedFilterKey, setLastAppliedFilterKey] = useState<string | null>(null);

    const buildFilterKey = useCallback(() =>
        JSON.stringify({
            websiteId: selectedWebsite?.id ?? null,
            urlPaths,
            pathOperator,
            period,
            customStartDate: customStartDate?.toISOString() ?? null,
            customEndDate: customEndDate?.toISOString() ?? null,
            metricType,
        }), [selectedWebsite?.id, urlPaths, pathOperator, period, customStartDate, customEndDate, metricType]);
    const hasUnappliedFilterChanges = buildFilterKey() !== lastAppliedFilterKey;

    const fetchData = useCallback(async () => {
        if (!selectedWebsite) return;
        const appliedFilterKey = buildFilterKey();

        setLoading(true);
        setError(null);
        setMarketingData({});
        setHasAttemptedFetch(true);
        setSubmittedMetricType(metricType);

        // Calculate date range based on period using centralized utility
        const dateRange = getDateRangeFromPeriod(period, customStartDate, customEndDate);
        if (!dateRange) {
            setError('Vennligst velg en gyldig periode.');
            setLoading(false);
            return;
        }
        const { startDate, endDate } = dateRange;
        const { countBy, countBySwitchAt } = getCookieCountByParams(usesCookies, cookieStartDate, startDate, endDate);
        const countByParams = countBy ? `&countBy=${countBy}` : '';
        const countBySwitchAtParam = countBySwitchAt ? `&countBySwitchAt=${countBySwitchAt}` : '';

        try {
            const urlPath = urlPaths.length > 0 ? urlPaths[0] : '';
            const normalizedPath = urlPath !== '/' && urlPath.endsWith('/') ? urlPath.slice(0, -1) : urlPath;

            const url = `/api/bigquery/websites/${selectedWebsite.id}/marketing-stats?startAt=${startDate.getTime()}&endAt=${endDate.getTime()}&limit=100${normalizedPath ? `&urlPath=${encodeURIComponent(normalizedPath)}` : ''}&pathOperator=${pathOperator}&metricType=${metricType}${countByParams}${countBySwitchAtParam}`;

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
            const newParams = new URLSearchParams(window.location.search);
            newParams.set('period', period);
            newParams.set('metricType', metricType);
            // Handle multiple paths in URL
            newParams.delete('urlPath');
            if (urlPaths.length > 0) {
                urlPaths.forEach(p => newParams.append('urlPath', p));
                newParams.set('pathOperator', pathOperator);
            } else {
                newParams.delete('pathOperator');
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
            setLastAppliedFilterKey(appliedFilterKey);

        } catch (err) {
            console.error('Error fetching marketing data:', err);
            const message = err instanceof Error ? err.message : 'Det oppstod en feil ved henting av data.';
            setError(message);
        } finally {
            setLoading(false);
        }
    }, [selectedWebsite, buildFilterKey, metricType, period, customStartDate, customEndDate, urlPaths, pathOperator, usesCookies, cookieStartDate]);

    // Auto-submit when website is selected (from localStorage, URL, or Home page picker)
    useEffect(() => {
        if (selectedWebsite && !hasAttemptedFetch) {
            fetchData();
        }
    }, [selectedWebsite, hasAttemptedFetch, fetchData]);

    const copyShareLink = async () => {
        try {
            await navigator.clipboard.writeText(window.location.href);
            setCopySuccess(true);
            setTimeout(() => setCopySuccess(false), 2000);
        } catch (err) {
            console.error('Failed to copy link:', err);
        }
    };



    const AnalysisTable = ({ title, data, metricLabel, queryStats, selectedWebsite, metricType }: { title: string, data: MarketingRow[], metricLabel: string, queryStats: QueryStats | null, selectedWebsite: Website | null, metricType: string }) => {
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

        // Format value based on metric type
        const formatValue = (count: number) => {
            if (metricType === 'proportion') {
                return `${count.toFixed(1)}%`;
            }
            return count.toLocaleString('nb-NO');
        };

        const downloadCSV = () => {
            if (!data.length) return;

            const headers = ['Navn', metricLabel];
            const csvRows = [
                headers.join(','),
                ...data.map((item) => {
                    return [
                        `"${item.name}"`,
                        metricType === 'proportion' ? `${item.count.toFixed(1)}%` : item.count
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

        const renderName = (name: string) => {
            if (name === '(none)') {
                return (
                    <div className="flex items-center gap-2 max-w-full">
                        <span className="truncate">Direkte / Ingen</span>
                        <HelpText title="Hva betyr dette?" strategy="fixed">
                            Besøk hvor det ikke er registrert noen henvisningskilde. Dette er ofte brukere som skriver inn nettadressen direkte, bruker bokmerker, eller kommer fra apper (som e-post eller Teams) som ikke sender data om hvor trafikken kommer fra.
                        </HelpText>
                    </div>
                );
            }

            if (name === '(exit)') {
                return (
                    <div className="flex items-center gap-2 max-w-full">
                        <span className="truncate">Utganger (Exit)</span>
                        <HelpText title="Hva betyr dette?" strategy="fixed">
                            Dette viser vanligvis til økter som ble avsluttet uten ny sidevisning, eller data som mangler kildeinformasjon ved utgang.
                        </HelpText>
                    </div>
                );
            }

            if (name === '(not set)') { // Adding common GA term just in case
                return "Ikke satt (not set)";
            }

            if (selectedWebsite && name === selectedWebsite.domain) {
                return (
                    <div className="flex items-center gap-2 max-w-full">
                        <span className="truncate">Interntrafikk ({name})</span>
                        <HelpText title="Hva betyr dette?" strategy="fixed">
                            Trafikk som ser ut til å komme fra samme domene. Dette skjer ofte ved omdirigeringer, eller hvis sporingskoden mistet sesjonsdata mellom to sidevisninger.
                        </HelpText>
                    </div>
                );
            }

            return <div className="truncate">{name}</div>;
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
                            {paginatedData.map((row, i) => (
                                <Table.Row key={i}>
                                    <Table.DataCell className="max-w-md" title={row.name}>
                                        {renderName(row.name)}
                                    </Table.DataCell>
                                    <Table.DataCell align="right">{formatValue(row.count)}</Table.DataCell>
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



    if (selectedWebsite && !hasMarketing) {
        return (
            <ChartLayout
                title="Kampanjer"
                description="Se trafikk fra kampanjer og lenker med sporing (UTM)."
                currentPage="markedsanalyse"
                websiteDomain={selectedWebsite?.domain}
                websiteName={selectedWebsite?.name}
                sidebarContent={
                    <WebsitePicker
                        selectedWebsite={selectedWebsite}
                        onWebsiteChange={setSelectedWebsite}
                    />
                }
            >
                <Alert variant="warning">
                    Markedsanalyse er ikke aktivert for dette nettstedet. Kontakt Team ResearchOps for å aktivere det.
                </Alert>
            </ChartLayout>
        );
    }

    return (
        <ChartLayout
            title="Kampanjer"
            description="Se trafikk fra kampanjer og lenker med sporing (UTM)."
            currentPage="markedsanalyse"
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
                        className="w-full sm:w-[350px]"
                    />

                    <PeriodPicker
                        period={period}
                        onPeriodChange={setPeriod}
                        startDate={customStartDate}
                        onStartDateChange={setCustomStartDate}
                        endDate={customEndDate}
                        onEndDateChange={setCustomEndDate}
                    />

                    <div className="w-full sm:w-auto min-w-[200px]">
                        <Select
                            label="Visning"
                            size="small"
                            value={metricType}
                            key={`metric-${metricType}-${cookieBadge || 'nocookie'}`}
                            onChange={(e) => setMetricType(e.target.value)}
                        >
                            <option value="visitors">{currentDateRange
                                ? getVisitorLabelWithBadge()
                                : 'Unike besøkende'}</option>
                            <option value="visits">Økter / besøk</option>
                            <option value="pageviews">Sidevisninger</option>
                            <option value="proportion">Andel (av besøkende)</option>
                        </Select>
                    </div>

                    <div className="w-full sm:w-auto self-end pb-[2px]">
                        <Button
                            onClick={fetchData}
                            disabled={!selectedWebsite || loading || !hasUnappliedFilterChanges}
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

            {(cookieBadge === 'mix' || isPreCookieRange) && (
                <CookieMixNotice
                    websiteName={selectedWebsite?.name}
                    cookieStartDate={cookieStartDate}
                    variant={isPreCookieRange ? 'pre' : 'mix'}
                />
            )}

            {loading && (
                <div className="flex justify-center items-center h-full">
                    <Loader size="xlarge" title="Henter data..." />
                </div>
            )}

            {!loading && hasAttemptedFetch && !error && (
                <>
                    <Tabs value={activeTab} onChange={setActiveTab}>
                        <Tabs.List>
                            <Tabs.Tab value="referrer" label="Henvisningsdomene" />
                            <Tabs.Tab value="source" label="Kilde" />
                            <Tabs.Tab value="medium" label="Medium" />
                            <Tabs.Tab value="campaign" label="Kampanje" />
                            <Tabs.Tab value="content" label="Innhold" />
                            <Tabs.Tab value="term" label="Nøkkelord" />
                            <Tabs.Tab value="query" label="Parametere" />
                        </Tabs.List>

                        <Tabs.Panel value="source" className="pt-4">
                            <AnalysisTable
                                title="Kilde"
                                data={marketingData['source'] || []}
                                metricLabel={getMetricLabel(submittedMetricType)}
                                metricType={submittedMetricType}
                                queryStats={queryStats}
                                selectedWebsite={selectedWebsite}
                            />
                        </Tabs.Panel>
                        <Tabs.Panel value="medium" className="pt-4">
                            <AnalysisTable
                                title="Medium"
                                data={marketingData['medium'] || []}
                                metricLabel={getMetricLabel(submittedMetricType)}
                                metricType={submittedMetricType}
                                queryStats={queryStats}
                                selectedWebsite={selectedWebsite}
                            />
                        </Tabs.Panel>
                        <Tabs.Panel value="campaign" className="pt-4">
                            <AnalysisTable
                                title="Kampanje"
                                data={marketingData['campaign'] || []}
                                metricLabel={getMetricLabel(submittedMetricType)}
                                metricType={submittedMetricType}
                                queryStats={queryStats}
                                selectedWebsite={selectedWebsite}
                            />
                        </Tabs.Panel>
                        <Tabs.Panel value="content" className="pt-4">
                            <AnalysisTable
                                title="Innhold"
                                data={marketingData['content'] || []}
                                metricLabel={getMetricLabel(submittedMetricType)}
                                metricType={submittedMetricType}
                                queryStats={queryStats}
                                selectedWebsite={selectedWebsite}
                            />
                        </Tabs.Panel>
                        <Tabs.Panel value="term" className="pt-4">
                            <AnalysisTable
                                title="Nøkkelord"
                                data={marketingData['term'] || []}
                                metricLabel={getMetricLabel(submittedMetricType)}
                                metricType={submittedMetricType}
                                queryStats={queryStats}
                                selectedWebsite={selectedWebsite}
                            />
                        </Tabs.Panel>
                        <Tabs.Panel value="referrer" className="pt-4">
                            <AnalysisTable
                                title="Henvisningsdomene"
                                data={marketingData['referrer'] || []}
                                metricLabel={getMetricLabel(submittedMetricType)}
                                metricType={submittedMetricType}
                                queryStats={queryStats}
                                selectedWebsite={selectedWebsite}
                            />
                        </Tabs.Panel>
                        <Tabs.Panel value="query" className="pt-4">
                            <AnalysisTable
                                title="URL Parametere"
                                data={marketingData['query'] || []}
                                metricLabel={getMetricLabel(submittedMetricType)}
                                metricType={submittedMetricType}
                                queryStats={queryStats}
                                selectedWebsite={selectedWebsite}
                            />
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

        </ChartLayout>
    );
};

export default MarketingAnalysis;

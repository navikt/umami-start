import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button, Alert, Loader, Tabs } from '@navikt/ds-react';
import { Share2, Check } from 'lucide-react';
import { parseISO } from 'date-fns';
import ChartLayout from '../../components/analysis/ChartLayout';
import WebsitePicker from '../../components/analysis/WebsitePicker';
import PeriodPicker from '../../components/analysis/PeriodPicker';
import UrlPathFilter from '../../components/analysis/UrlPathFilter';
import ResultsPanel from '../../components/chartbuilder/results/ResultsPanel';
import { Website } from '../../types/chart';
import { normalizeUrlToPath } from '../../lib/utils';


const UserComposition = () => {
    const [selectedWebsite, setSelectedWebsite] = useState<Website | null>(null);
    const [searchParams] = useSearchParams();

    // Initialize state from URL params - support multiple paths
    const pathsFromUrl = searchParams.getAll('urlPath');
    const legacyPath = searchParams.get('pagePath');
    const initialPaths = pathsFromUrl.length > 0 
        ? pathsFromUrl.map(p => normalizeUrlToPath(p)).filter(Boolean) 
        : (legacyPath ? [normalizeUrlToPath(legacyPath)].filter(Boolean) : []);
    const [urlPaths, setUrlPaths] = useState<string[]>(initialPaths);
    const [pathOperator, setPathOperator] = useState<string>('equals');
    const [period, setPeriod] = useState<string>(() => searchParams.get('period') || 'current_month');

    // Support custom dates from URL
    const fromDateFromUrl = searchParams.get("from");
    const toDateFromUrl = searchParams.get("to");
    const initialCustomStartDate = fromDateFromUrl ? parseISO(fromDateFromUrl) : undefined;
    const initialCustomEndDate = toDateFromUrl ? parseISO(toDateFromUrl) : undefined;

    const [customStartDate, setCustomStartDate] = useState<Date | undefined>(initialCustomStartDate);
    const [customEndDate, setCustomEndDate] = useState<Date | undefined>(initialCustomEndDate);
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [activeCategory, setActiveCategory] = useState<string>('browser');
    const [queryStats, setQueryStats] = useState<any>(null);
    const [copySuccess, setCopySuccess] = useState<boolean>(false);
    const [hasAutoSubmitted, setHasAutoSubmitted] = useState<boolean>(false);

    // Auto-submit when URL parameters are present (for shared links)
    useEffect(() => {
        // Only auto-submit if there are config params beyond just websiteId
        const hasConfigParams = searchParams.has('period') || searchParams.has('urlPath') || searchParams.has('pagePath');
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
            startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            endDate = new Date(now.getFullYear(), now.getMonth(), 0);
        }

        try {
            const response = await fetch('/api/bigquery/composition', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    websiteId: selectedWebsite.id,
                    startDate: startDate.toISOString(),
                    endDate: endDate.toISOString(),
                    urlPath: urlPaths.length > 0 ? urlPaths[0] : undefined
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
                // If current tab is 'custom' but no custom data exists, switch to 'browser'
                if (activeCategory === 'custom' && !result.data.some((item: any) => item.category === 'custom')) {
                    setActiveCategory('browser');
                }
                setQueryStats(result.queryStats);

                // Update URL with configuration for sharing
                const newParams = new URLSearchParams(window.location.search);
                newParams.set('period', period);
                if (urlPaths.length > 0) {
                    newParams.set('urlPath', urlPaths[0]);
                    newParams.delete('pagePath');
                } else {
                    newParams.delete('urlPath');
                    newParams.delete('pagePath');
                }

                // Update URL without navigation
                window.history.replaceState({}, '', `${window.location.pathname}?${newParams.toString()}`);
            }
        } catch (err) {
            console.error('Error fetching composition data:', err);
            setError('Det oppstod en feil ved henting av data.');
        } finally {
            setLoading(false);
        }
    };

    // Helper to transform data for ResultsDisplay based on active category
    const getCategoryData = () => {
        if (!data) return null;

        // Filter data by the active category
        // The backend should return rows with 'category', 'value', 'count'
        const categoryData = data.filter((row: any) => row.category === activeCategory);

        // Calculate total for percentage
        const total = categoryData.reduce((sum: number, row: any) => sum + row.count, 0);

        // Transform to what ResultsDisplay expects (array of objects)
        // We want to show the value (e.g., "Chrome"), the count, and the percentage
        return {
            data: categoryData.map((row: any) => {
                const percentage = total > 0 ? ((row.count / total) * 100).toFixed(1) : '0.0';
                return {
                    [activeCategory]: row.value,
                    'Antall': row.count,
                    'Andel': `${percentage}%`
                };
            })
        };
    };

    const prepareBarChartData = () => {
        const currentData = getCategoryData();
        if (!currentData || !currentData.data) return null;

        return {
            data: currentData.data.map((row: any) => ({
                x: row[activeCategory],
                y: row['Antall']
            })),
            barWidth: 20,
            yAxisTickCount: 5
        };
    };

    const preparePieChartData = () => {
        const currentData = getCategoryData();
        if (!currentData || !currentData.data) return null;

        const total = currentData.data.reduce((sum: number, row: any) => sum + row['Antall'], 0);

        return {
            data: currentData.data.map((row: any) => ({
                x: row[activeCategory],
                y: row['Antall']
            })),
            total
        };
    };

    // We don't really use line chart for this aggregation, but ResultsDisplay requires the prop
    const prepareLineChartData = () => null;

    return (
        <ChartLayout
            title="Brukerdetaljer"
            description="Se informasjon om besøkende."
            currentPage="brukersammensetning"
            sidebarContent={
                <WebsitePicker
                    selectedWebsite={selectedWebsite}
                    onWebsiteChange={setSelectedWebsite}
                    variant="minimal"
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
                        label="URL-sti (valgfritt)"
                        showOperator={false}
                        placeholder="Skriv og trykk enter"
                    />

                    <PeriodPicker
                        period={period}
                        onPeriodChange={setPeriod}
                        startDate={customStartDate}
                        onStartDateChange={setCustomStartDate}
                        endDate={customEndDate}
                        onEndDateChange={setCustomEndDate}
                    />

                    <div className="flex items-end pb-[2px] mt-8 sm:mt-0">
                        <Button
                            onClick={fetchData}
                            disabled={!selectedWebsite || loading}
                            loading={loading}
                            size="small"
                        >
                            Vis brukerdetaljer
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

            {!loading && data && (
                <>
                    <Tabs value={activeCategory} onChange={setActiveCategory}>
                        <Tabs.List>
                            <Tabs.Tab value="browser" label="Nettleser" />
                            <Tabs.Tab value="os" label="Operativsystem" />
                            <Tabs.Tab value="device" label="Enhet" />
                            <Tabs.Tab value="screen" label="Skjerm" />
                            <Tabs.Tab value="language" label="Språk" />
                            <Tabs.Tab value="country" label="Land" />
                            {data?.data?.some((item: any) => item.category === 'custom') && (
                                <Tabs.Tab value="custom" label="Egendefinert" />
                            )}
                        </Tabs.List>

                        <div className="mt-6">
                            <ResultsPanel
                                result={getCategoryData()}
                                loading={false}
                                error={null}
                                queryStats={queryStats}
                                lastAction="run"
                                showLoadingMessage={false}
                                executeQuery={() => { }}
                                handleRetry={() => { }}
                                prepareLineChartData={prepareLineChartData}
                                prepareBarChartData={prepareBarChartData}
                                preparePieChartData={preparePieChartData}
                                hideHeading={true}
                                hiddenTabs={['linechart', 'areachart']}
                            />
                        </div>
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

export default UserComposition;

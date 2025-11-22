import { useState } from 'react';
import { Heading, TextField, Button, Alert, Loader, BodyShort, Radio, RadioGroup, Tabs } from '@navikt/ds-react';
import WebsitePicker from '../components/WebsitePicker';
import AnalyticsNavigation from '../components/AnalyticsNavigation';
import ResultsDisplay from '../components/chartbuilder/ResultsDisplay';
import { Website } from '../types/chart';

const UserComposition = () => {
    const [selectedWebsite, setSelectedWebsite] = useState<Website | null>(null);
    const [pagePath, setPagePath] = useState<string>('');
    const [period, setPeriod] = useState<string>('current_month');
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [activeCategory, setActiveCategory] = useState<string>('browser');
    const [queryStats, setQueryStats] = useState<any>(null);

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
                    urlPath: pagePath.trim() || undefined
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
        <div className="py-8 max-w-[1600px] mx-auto">
            <div className="mb-8">
                <Heading level="1" size="xlarge" className="mb-2">
                    Brukersammensetning
                </Heading>
                <BodyShort className="text-gray-600">
                    Se informasjon om besøkende.
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
                                label="Sidesti (valgfritt)"
                                description="F.eks. /arbeid/soke-jobb"
                                value={pagePath}
                                onChange={(e) => setPagePath(e.target.value)}
                            />

                            <Button
                                onClick={fetchData}
                                disabled={!selectedWebsite || loading}
                                loading={loading}
                                className="w-full"
                            >
                                Hent data
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
                                    <ResultsDisplay
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
                        </>
                    )}

                    {!loading && !error && !data && (
                        <div className="text-center p-8 text-gray-500 bg-gray-50 rounded-lg border border-gray-200 mt-4">
                            Velg nettside og klikk "Hent data" for å se brukersammensetning.
                        </div>
                    )}
                </div>

                <AnalyticsNavigation currentPage="brukersammensetning" />
            </div>
        </div>
    );
};

export default UserComposition;

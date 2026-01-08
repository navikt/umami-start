import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { TextField, Button, Alert, Loader, Select, Tabs, Radio, RadioGroup, Heading, InfoCard } from '@navikt/ds-react';
import { SankeyChart, IChartProps, ResponsiveContainer } from '@fluentui/react-charting';
import { Download, Minimize2, Share2, Check } from 'lucide-react';
import { utils as XLSXUtils, write as XLSXWrite } from 'xlsx';
import ChartLayout from '../components/ChartLayout';
import WebsitePicker from '../components/WebsitePicker';
import PeriodPicker from '../components/PeriodPicker';
import UmamiJourneyView from '../components/UmamiJourneyView';
import { Website } from '../types/chart';
import { normalizeUrlToPath } from '../lib/utils';


const UserJourney = () => {
    const [selectedWebsite, setSelectedWebsite] = useState<Website | null>(null);
    const [searchParams] = useSearchParams();

    // Initialize state from URL params
    const [startUrl, setStartUrl] = useState<string>(() => searchParams.get('startUrl') || '');
    const [period, setPeriod] = useState<string>(() => searchParams.get('period') || 'current_month');
    const [customStartDate, setCustomStartDate] = useState<Date | undefined>(undefined);
    const [customEndDate, setCustomEndDate] = useState<Date | undefined>(undefined);
    const [steps, setSteps] = useState<number>(() => {
        const stepsParam = searchParams.get('steps');
        return stepsParam ? parseInt(stepsParam) : 5;
    });
    const [limit, setLimit] = useState<number>(() => {
        const limitParam = searchParams.get('limit');
        return limitParam ? parseInt(limitParam) : 15;
    });
    const [limitInput, setLimitInput] = useState<string>(() => {
        const limitParam = searchParams.get('limit');
        return limitParam || '15';
    });
    const [data, setData] = useState<IChartProps | null>(null);
    const [rawData, setRawData] = useState<{ nodes: any[], links: any[] } | null>(null);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<string>('steps');
    const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
    const [journeyDirection, setJourneyDirection] = useState<string>(() => searchParams.get('direction') || 'forward');
    const [queryStats, setQueryStats] = useState<any>(null);
    const [copySuccess, setCopySuccess] = useState<boolean>(false);
    const [hasAutoSubmitted, setHasAutoSubmitted] = useState<boolean>(false);
    const [reverseVisualOrder, setReverseVisualOrder] = useState<boolean>(false); // Default off


    // Auto-submit when URL parameters are present (for shared links)
    useEffect(() => {
        // Only auto-submit if there are config params beyond just websiteId
        const hasConfigParams = searchParams.has('period') || searchParams.has('startUrl') || searchParams.has('steps') || searchParams.has('limit') || searchParams.has('direction');
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


    const downloadCSV = () => {
        if (!rawData || !rawData.links || rawData.links.length === 0) return;

        const headers = ['Steg', 'Til side', 'Fra side', 'Antall brukere'];
        const csvRows = [
            headers.join(','),
            ...rawData.links.map((link: any) => {
                const sourceNode = rawData.nodes.find((n: any) => rawData.nodes.indexOf(n) === link.source);
                const targetNode = rawData.nodes.find((n: any) => rawData.nodes.indexOf(n) === link.target);
                const stepMatch = sourceNode?.nodeId?.match(/^(\d+):/);
                let step: number | string = '-';
                if (stepMatch) {
                    const rawStep = parseInt(stepMatch[1]);
                    step = journeyDirection === 'backward' ? rawStep * -1 : rawStep;
                }

                const escapeCSV = (val: any) => {
                    const str = val !== null && val !== undefined ? String(val) : '';
                    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
                        return '"' + str.replace(/"/g, '""') + '"';
                    }
                    return str;
                };

                return [
                    step,
                    escapeCSV(targetNode?.name || '-'),
                    escapeCSV(sourceNode?.name || '-'),
                    link.value
                ].join(',');
            })
        ];

        const csvContent = csvRows.join('\n');
        const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `brukerreiser_${selectedWebsite?.name || 'data'}_${new Date().toISOString().slice(0, 10)}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const downloadExcel = () => {
        if (!rawData || !rawData.links || rawData.links.length === 0) return;

        const worksheetData = [
            ['Steg', 'Til side', 'Fra side', 'Antall brukere'],
            ...rawData.links.map((link: any) => {
                const sourceNode = rawData.nodes.find((n: any) => rawData.nodes.indexOf(n) === link.source);
                const targetNode = rawData.nodes.find((n: any) => rawData.nodes.indexOf(n) === link.target);
                const stepMatch = sourceNode?.nodeId?.match(/^(\d+):/);
                let step: number | string = '-';
                if (stepMatch) {
                    const rawStep = parseInt(stepMatch[1]);
                    step = journeyDirection === 'backward' ? rawStep * -1 : rawStep;
                }

                return [
                    step,
                    targetNode?.name || '-',
                    sourceNode?.name || '-',
                    link.value
                ];
            })
        ];

        const worksheet = XLSXUtils.aoa_to_sheet(worksheetData);
        const workbook = XLSXUtils.book_new();
        XLSXUtils.book_append_sheet(workbook, worksheet, 'Brukerreiser');

        const wbout = XLSXWrite(workbook, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([wbout], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        });

        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `brukerreiser_${selectedWebsite?.name || 'data'}_${new Date().toISOString().slice(0, 10)}.xlsx`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const fetchData = async () => {
        if (!selectedWebsite) return;

        setLoading(true);
        setError(null);
        setData(null);
        setRawData(null);

        // Normalize the URL behind the scenes before sending to API
        const normalizedStartUrl = normalizeUrlToPath(startUrl);

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
            console.log('Fetching journeys for:', { websiteId: selectedWebsite.id, startUrl: normalizedStartUrl, steps, limit });
            const response = await fetch('/api/bigquery/journeys', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    websiteId: selectedWebsite.id,
                    startUrl: normalizedStartUrl,
                    startDate: startDate.toISOString(),
                    endDate: endDate.toISOString(),
                    steps,
                    limit,
                    direction: journeyDirection,
                }),
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch user journeys: ${response.status} ${response.statusText}`);
            }

            const contentType = response.headers.get("content-type");
            if (!contentType || !contentType.includes("application/json")) {
                const text = await response.text();
                console.error("Received non-JSON response:", text.substring(0, 100));
                throw new Error("Server returned non-JSON response. Did you restart the server?");
            }

            const result = await response.json();
            console.log('Journey data received:', result);

            // Log query stats if available
            if (result.queryStats) {
                console.log(`[User Journeys] Query processed ${result.queryStats.totalBytesProcessedGB} GB, estimated cost: $${result.queryStats.estimatedCostUSD}`);
                setQueryStats(result.queryStats);
            }

            if (result.nodes && result.links) {
                setRawData({ nodes: result.nodes, links: result.links });
                setData({
                    chartTitle: "Brukerreiser",
                    SankeyChartData: {
                        nodes: result.nodes,
                        links: result.links,
                    }
                } as unknown as IChartProps);

                // Update current data direction and set default visual order
                setReverseVisualOrder(journeyDirection === 'backward');
            } else {
                setRawData({ nodes: [], links: [] });
                setData({
                    SankeyChartData: { nodes: [], links: [] }
                } as unknown as IChartProps);
            }

            // Update URL with configuration for sharing
            const newParams = new URLSearchParams(window.location.search);
            newParams.set('period', period);
            newParams.set('steps', steps.toString());
            newParams.set('limit', limit.toString());
            newParams.set('direction', journeyDirection);
            if (normalizedStartUrl) {
                newParams.set('startUrl', normalizedStartUrl);
            } else {
                newParams.delete('startUrl');
            }

            // Update URL without navigation
            window.history.replaceState({}, '', `${window.location.pathname}?${newParams.toString()}`);


        } catch (err) {
            console.error(err);
            setError('Kunne ikke laste brukerreiser. Prøv igjen senere.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <ChartLayout
            title="Sideflyt"
            description="Se hvilke veier folk tar på nettsiden."
            currentPage="brukerreiser"
            filters={
                <>
                    <WebsitePicker
                        selectedWebsite={selectedWebsite}
                        onWebsiteChange={setSelectedWebsite}
                        variant="minimal"
                    />

                    <TextField
                        size="small"
                        label="Start URL-sti"
                        description="F.eks. / for forsiden"
                        value={startUrl}
                        onChange={(e) => setStartUrl(e.target.value)}
                        onBlur={(e) => setStartUrl(normalizeUrlToPath(e.target.value))}
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
                        legend="Reiseretning"
                        description="Hvilken vei vil du se?"
                        value={journeyDirection}
                        onChange={(val: string) => {
                            setJourneyDirection(val);
                        }}
                    >
                        <Radio value="forward">Fremover (hva skjer etter)</Radio>
                        <Radio value="backward">Bakover (hvordan kom de hit)</Radio>
                    </RadioGroup>

                    <Select
                        size="small"
                        label="Antall steg"
                        description="Hvor mange steg vil du se?"
                        value={steps}
                        onChange={(e) => setSteps(Number(e.target.value))}
                    >
                        <option value={1}>1 steg</option>
                        <option value={2}>2 steg</option>
                        <option value={3}>3 steg</option>
                        <option value={4}>4 steg</option>
                        <option value={5}>5 steg</option>
                        <option value={6}>6 steg</option>
                        <option value={7}>7 steg</option>
                        <option value={8}>8 steg</option>
                        <option value={9}>9 steg</option>
                        <option value={10}>10 steg</option>
                        <option value={11}>11 steg</option>
                        <option value={12}>12 steg</option>
                        <option value={13}>13 steg</option>
                        <option value={14}>14 steg</option>
                        <option value={15}>15 steg</option>
                    </Select>

                    <TextField
                        size="small"
                        label="Maks antall sider"
                        description="Viser de mest besøkte sidene"
                        type="number"
                        value={limitInput}
                        onChange={(e) => setLimitInput(e.target.value)}
                        onBlur={() => {
                            const val = parseInt(limitInput);
                            if (!isNaN(val) && val > 0) {
                                setLimit(val);
                            } else {
                                setLimitInput(limit.toString());
                            }
                        }}
                    />

                    <Button
                        onClick={fetchData}
                        disabled={!selectedWebsite || loading}
                        loading={loading}
                    >
                        Vis brukerreiser
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
                    <Loader size="xlarge" title="Laster brukerreiser..." />
                </div>
            )}

            {!loading && data && (data as any).SankeyChartData?.nodes?.length > 0 && (
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
                            <Tabs.Tab value="steps" label="Stegvisning" />
                            <Tabs.Tab value="sankey" label="Flytdiagram" />
                            <Tabs.Tab value="table" label="Tabell" />
                        </Tabs.List>

                        <Tabs.Panel value="sankey" className="pt-2">

                            <div className={`${isFullscreen ? 'fixed inset-0 z-50 bg-white p-8 overflow-auto' : ''}`}>
                                {isFullscreen && (
                                    <div className="mb-4 flex justify-end">
                                        <Button
                                            size="small"
                                            variant="tertiary"
                                            onClick={() => setIsFullscreen(false)}
                                            icon={<Minimize2 size={20} />}
                                        >
                                            Lukk fullskjerm
                                        </Button>
                                    </div>
                                )}
                                {/*
                            {!isFullscreen && (
                                <div className="mb-2 flex justify-end">
                                    <Button
                                        size="small"
                                        variant="tertiary"
                                        onClick={() => setIsFullscreen(true)}
                                        icon={<Maximize2 size={20} />}
                                    >
                                        Fullskjerm
                                    </Button>
                                </div>
                            )}
                                 */}

                                <div className="overflow-x-auto w-full">
                                    <div style={{ height: isFullscreen ? 'calc(100vh - 120px)' : '700px', minWidth: `${Math.max(1000, steps * 350)}px` }}>
                                        <ResponsiveContainer>
                                            <SankeyChart data={data} />
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                                {queryStats && (
                                    <div className="text-sm text-gray-600 text-right mt-4">
                                        Data prosessert: {queryStats.totalBytesProcessedGB} GB
                                    </div>
                                )}
                            </div>
                        </Tabs.Panel>

                        <Tabs.Panel value="steps" className="pt-4">
                            <div className={`${isFullscreen ? 'fixed inset-0 z-50 bg-white p-8 overflow-auto' : ''}`}>
                                {!isFullscreen && (
                                    <InfoCard data-color="info" className="mb-6">
                                        <InfoCard.Header>
                                            <InfoCard.Title>Tips</InfoCard.Title>
                                        </InfoCard.Header>
                                        <InfoCard.Content>
                                            Klikk på stegene for å utforske flyt. Legg til steg i en traktanalyse med pluss-ikonet (+).
                                        </InfoCard.Content>
                                    </InfoCard>
                                )}
                                {isFullscreen && (
                                    <div className="mb-4 flex justify-end">
                                        <Button
                                            size="small"
                                            variant="tertiary"
                                            onClick={() => setIsFullscreen(false)}
                                            icon={<Minimize2 size={20} />}
                                        >
                                            Lukk fullskjerm
                                        </Button>
                                    </div>
                                )}
                                {/*
                            {!isFullscreen && (
                                <div className="mb-2 flex justify-end">
                                    <Button
                                        size="small"
                                        variant="tertiary"
                                        onClick={() => setIsFullscreen(true)}
                                        icon={<Maximize2 size={20} />}
                                    >
                                        Fullskjerm
                                    </Button>
                                </div>
                            )}
                            */}

                                <UmamiJourneyView
                                    nodes={rawData?.nodes || []}
                                    links={rawData?.links || []}
                                    isFullscreen={isFullscreen}
                                    reverseVisualOrder={reverseVisualOrder}
                                    journeyDirection={journeyDirection}
                                    websiteId={selectedWebsite?.id}
                                />
                                {queryStats && (
                                    <div className="text-sm text-gray-600 text-right mt-4">
                                        Data prosessert: {queryStats.totalBytesProcessedGB} GB
                                    </div>
                                )}
                            </div>
                        </Tabs.Panel>

                        <Tabs.Panel value="table" className="pt-4">
                            <div className="border rounded-lg overflow-hidden">
                                <div className="overflow-x-auto max-h-[550px] overflow-y-auto">
                                    <table className="min-w-full divide-y divide-gray-200">
                                        <thead className="bg-gray-100 sticky top-0">
                                            <tr>
                                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase">Steg</th>
                                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase">Til side</th>
                                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase">Fra side</th>
                                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase">Antall brukere</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-200">
                                            {rawData && rawData.links.map((link: any, idx: number) => {
                                                const sourceNode = rawData.nodes.find((n: any) => rawData.nodes.indexOf(n) === link.source);
                                                const targetNode = rawData.nodes.find((n: any) => rawData.nodes.indexOf(n) === link.target);

                                                const stepMatch = sourceNode?.nodeId?.match(/^(\d+):/);
                                                let step: number | string = '-';
                                                if (stepMatch) {
                                                    const rawStep = parseInt(stepMatch[1]);
                                                    step = journeyDirection === 'backward' ? rawStep * -1 : rawStep;
                                                }

                                                return (
                                                    <tr key={idx} className="hover:bg-gray-50">
                                                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">{step}</td>
                                                        <td className="px-4 py-2 text-sm text-gray-900">{targetNode?.name || '-'}</td>
                                                        <td className="px-4 py-2 text-sm text-gray-900">{sourceNode?.name || '-'}</td>
                                                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">{link.value.toLocaleString('nb-NO')}</td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                                <div className="px-4 py-2 bg-gray-50 text-sm text-gray-600 border-t flex justify-between items-center">
                                    <span>{rawData && `${rawData.links.length} forbindelser mellom ${rawData.nodes.length} sider`}</span>
                                    {queryStats && (
                                        <span>Data prosessert: {queryStats.totalBytesProcessedGB} GB</span>
                                    )}
                                </div>
                                <div className="flex gap-2 p-3 bg-gray-50 border-b">
                                    <Button
                                        size="small"
                                        variant="secondary"
                                        onClick={downloadCSV}
                                        icon={<Download size={16} />}
                                    >
                                        Last ned CSV
                                    </Button>
                                    <Button
                                        size="small"
                                        variant="secondary"
                                        onClick={downloadExcel}
                                        icon={<Download size={16} />}
                                    >
                                        Last ned Excel
                                    </Button>
                                </div>
                            </div>
                        </Tabs.Panel>
                    </Tabs>
                </>
            )}

            {!loading && data && (data as any).SankeyChartData?.nodes?.length === 0 && (
                <div className="flex justify-center items-center h-full text-gray-500">
                    Ingen data funnet for valgt periode og start-URL.
                </div>
            )}
        </ChartLayout>
    );
};

export default UserJourney;

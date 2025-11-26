import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Heading, TextField, Button, Alert, Loader, Tabs, Switch, Radio, RadioGroup } from '@navikt/ds-react';
import { Plus, Trash2, Download, Share2, Check } from 'lucide-react';
import ChartLayout from '../components/ChartLayout';
import WebsitePicker from '../components/WebsitePicker';
import FunnelChart from '../components/FunnelChart';
import HorizontalFunnelChart from '../components/HorizontalFunnelChart';
import FunnelStats from '../components/FunnelStats';
import { Website } from '../types/chart';


const Funnel = () => {
    const [selectedWebsite, setSelectedWebsite] = useState<Website | null>(null);
    const [searchParams] = useSearchParams();

    // Initialize state from URL params
    const [urls, setUrls] = useState<string[]>(() => {
        const steps = searchParams.getAll('step');
        return steps.length >= 2 ? steps : ['', ''];
    });

    const [period, setPeriod] = useState<string>(() => searchParams.get('period') || 'current_month');

    const [onlyDirectEntry, setOnlyDirectEntry] = useState<boolean>(() => {
        const param = searchParams.get('strict');
        return param === null ? true : param === 'true';
    });

    const [funnelData, setFunnelData] = useState<any[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<string>('vertical');
    const [hasAttemptedFetch, setHasAttemptedFetch] = useState<boolean>(false);

    // Timing data state
    const [timingData, setTimingData] = useState<any[]>([]);
    const [timingLoading, setTimingLoading] = useState<boolean>(false);
    const [timingError, setTimingError] = useState<string | null>(null);
    const [showTiming, setShowTiming] = useState<boolean>(false);
    const [timingQueryStats, setTimingQueryStats] = useState<any>(null);
    const [funnelQueryStats, setFunnelQueryStats] = useState<any>(null);
    const [copySuccess, setCopySuccess] = useState<boolean>(false);

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
        if (!funnelData || funnelData.length === 0) return;

        const headers = ['Steg', 'URL', 'Antall', 'Gikk videre (%)', 'Falt fra (%)'];
        const csvRows = [
            headers.join(','),
            ...funnelData.map((item, index) => {
                const prevItem = index > 0 ? funnelData[index - 1] : null;
                const percentageOfPrev = prevItem && prevItem.count > 0 ? Math.round((item.count / prevItem.count) * 100) : 100;
                const dropoffPercentage = prevItem ? 100 - percentageOfPrev : 0;

                const escapeCSV = (val: any) => {
                    const str = val !== null && val !== undefined ? String(val) : '';
                    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
                        return '"' + str.replace(/"/g, '""') + '"';
                    }
                    return str;
                };

                return [
                    item.step + 1,
                    escapeCSV(item.url),
                    item.count,
                    index > 0 ? percentageOfPrev : '-',
                    index > 0 ? dropoffPercentage : '-'
                ].join(',');
            })
        ];

        const csvContent = csvRows.join('\n');
        const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `traktanalyse_${selectedWebsite?.name || 'data'}_${new Date().toISOString().slice(0, 10)}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const addStep = () => {
        setUrls([...urls, '']);
    };

    const removeStep = (index: number) => {
        if (urls.length <= 2) return; // Keep at least 2 steps
        const newUrls = urls.filter((_, i) => i !== index);
        setUrls(newUrls);
    };

    const updateUrl = (index: number, value: string) => {
        const newUrls = [...urls];
        newUrls[index] = value;
        setUrls(newUrls);
    };

    const normalizeUrlToPath = (input: string): string => {
        if (!input.trim()) return '/';
        let trimmed = input.trim();
        try {
            if (trimmed.includes('://')) {
                const url = new URL(trimmed);
                return url.pathname;
            }
            if (trimmed.startsWith('/') && trimmed.includes('.')) {
                const withoutLeadingSlash = trimmed.substring(1);
                if (withoutLeadingSlash.includes('/') && !withoutLeadingSlash.startsWith('/')) {
                    trimmed = withoutLeadingSlash;
                }
            }
            if (!trimmed.startsWith('/') && trimmed.includes('.') && trimmed.includes('/')) {
                const url = new URL('https://' + trimmed);
                return url.pathname;
            }
        } catch (e) {
            // Ignore
        }
        return trimmed;
    };

    const fetchData = async () => {
        if (!selectedWebsite) return;

        setHasAttemptedFetch(true);

        // Validate URLs
        const normalizedUrls = urls.map(normalizeUrlToPath).filter(u => u.trim() !== '');
        if (normalizedUrls.length < 2) {
            setError('Du må legge inn minst to gyldige steg.');
            return;
        }

        setLoading(true);
        setError(null);
        setFunnelData([]);

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
            const response = await fetch('/api/bigquery/funnel', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    websiteId: selectedWebsite.id,
                    urls: normalizedUrls,
                    startDate: startDate.toISOString(),
                    endDate: endDate.toISOString(),
                    onlyDirectEntry
                }),
            });

            if (!response.ok) {
                throw new Error('Kunne ikke hente traktdata');
            }

            const data = await response.json();

            if (data.error) {
                setError(data.error);
                setFunnelData([]);

            } else {
                setFunnelData(data.data);
                if (data.queryStats) {
                    setFunnelQueryStats(data.queryStats);
                }

                // Update URL with funnel configuration for sharing
                const newParams = new URLSearchParams(searchParams);
                newParams.set('period', period);
                newParams.set('strict', String(onlyDirectEntry));

                // Add steps
                newParams.delete('step');
                normalizedUrls.forEach(url => {
                    newParams.append('step', url);
                });

                // Update URL without navigation
                window.history.replaceState({}, '', `${window.location.pathname}?${newParams.toString()}`);
            }
        } catch (err) {
            console.error('Error fetching funnel data:', err);
            setError('Det oppstod en feil ved henting av data.');
            setFunnelData([]);

        } finally {
            setLoading(false);
        }
    };

    const fetchTimingData = async () => {
        if (!selectedWebsite || funnelData.length === 0) return;

        setTimingLoading(true);
        setTimingError(null);

        // Calculate date range based on period (same as main funnel query)
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

        const normalizedUrls = urls.map(normalizeUrlToPath).filter(u => u.trim() !== '');

        try {
            const response = await fetch('/api/bigquery/funnel-timing', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    websiteId: selectedWebsite.id,
                    urls: normalizedUrls,
                    startDate: startDate.toISOString(),
                    endDate: endDate.toISOString(),
                    onlyDirectEntry
                }),
            });

            if (!response.ok) {
                throw new Error('Kunne ikke hente tidsdata');
            }

            const data = await response.json();

            if (data.error) {
                setTimingError(data.error);
                setTimingData([]);
                setTimingQueryStats(null);
            } else {
                setTimingData(data.data);
                setTimingQueryStats(data.queryStats);
                setShowTiming(true);
            }
        } catch (err) {
            console.error('Error fetching timing data:', err);
            setTimingError('Det oppstod en feil ved henting av tidsdata.');
            setTimingData([]);
        } finally {
            setTimingLoading(false);
        }
    };

    const formatDuration = (seconds: number | null): string => {
        if (seconds === null || isNaN(seconds)) return '-';

        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;

        if (hours > 0) {
            return `${hours}t ${minutes}m ${secs}s`;
        } else if (minutes > 0) {
            return `${minutes}m ${secs}s`;
        } else {
            return `${secs}s`;
        }
    };

    return (
        <ChartLayout
            title="Traktanalyse"
            description="Se hvor folk faller fra i en prosess."
            currentPage="trakt"
            filters={
                <>
                    <WebsitePicker
                        selectedWebsite={selectedWebsite}
                        onWebsiteChange={setSelectedWebsite}
                        variant="minimal"
                    />

                    <RadioGroup
                        legend="Periode"
                        value={period}
                        onChange={(val: string) => setPeriod(val)}
                    >
                        <Radio value="current_month">Denne måneden</Radio>
                        <Radio value="last_month">Forrige måned</Radio>
                    </RadioGroup>

                    <div className="pt-2 space-y-3">
                        <Heading level="3" size="xsmall">Legg til URL-stier for hvert steg</Heading>
                        {urls.map((url, index) => (
                            <div key={index} className="flex items-end gap-2">
                                <TextField
                                    label={`Steg ${index + 1}`}
                                    value={url}
                                    onChange={(e) => updateUrl(index, e.target.value)}
                                    onBlur={(e) => updateUrl(index, normalizeUrlToPath(e.target.value))}
                                    className="flex-grow"
                                />
                                {urls.length > 2 && (
                                    <Button
                                        variant="tertiary"
                                        icon={<Trash2 size={20} />}
                                        onClick={() => removeStep(index)}
                                        aria-label="Fjern steg"
                                    />
                                )}
                            </div>
                        ))}
                        <Button
                            variant="secondary"
                            size="small"
                            icon={<Plus size={20} />}
                            onClick={addStep}
                            className="w-full"
                        >
                            Legg til steg
                        </Button>
                    </div>

                    <div className="pb-1 flex items-center gap-4 px-1">
                        <Switch
                            checked={onlyDirectEntry}
                            onChange={(e) => setOnlyDirectEntry(e.target.checked)}
                            description="Flyt direkte fra steg til steg"
                        >
                            Streng rekkefølge
                        </Switch>
                    </div>

                    <Button
                        onClick={fetchData}
                        disabled={!selectedWebsite || loading}
                        loading={loading}
                        className="w-full"
                    >
                        Lag trakt
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
                    <Loader size="xlarge" title="Beregner trakt..." />
                </div>
            )}

            {!loading && funnelData.length > 0 && (
                <>
                    <FunnelStats data={funnelData} />
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
                            <Tabs.Tab value="vertical" label="Vertikal trakt" />
                            <Tabs.Tab value="horizontal" label="Horisontal trakt" />
                            <Tabs.Tab value="table" label="Tabell" />
                        </Tabs.List>

                        <Tabs.Panel value="vertical" className="pt-4">
                            <FunnelChart data={funnelData} loading={loading} />
                            {funnelQueryStats && (
                                <div className="text-sm text-gray-600 text-right mt-4">
                                    Data prosessert: {funnelQueryStats.totalBytesProcessedGB} GB
                                </div>
                            )}
                        </Tabs.Panel>

                        <Tabs.Panel value="horizontal" className="pt-4">
                            <HorizontalFunnelChart data={funnelData} loading={loading} />
                            {funnelQueryStats && (
                                <div className="text-sm text-gray-600 text-right mt-4">
                                    Data prosessert: {funnelQueryStats.totalBytesProcessedGB} GB
                                </div>
                            )}
                        </Tabs.Panel>

                        <Tabs.Panel value="table" className="pt-4">
                            <div className="border rounded-lg overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="min-w-full divide-y divide-gray-200">
                                        <thead className="bg-gray-100">
                                            <tr>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Steg</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">URL</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Antall</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Gikk videre</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Falt fra</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-200">
                                            {funnelData.map((item, index) => {
                                                const prevItem = index > 0 ? funnelData[index - 1] : null;
                                                const percentageOfPrev = prevItem && prevItem.count > 0 ? Math.round((item.count / prevItem.count) * 100) : 100;
                                                const dropoffCount = prevItem ? prevItem.count - item.count : 0;
                                                const dropoffPercentage = prevItem ? 100 - percentageOfPrev : 0;

                                                return (
                                                    <tr key={index} className="hover:bg-gray-50">
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                                            Steg {item.step + 1}
                                                        </td>
                                                        <td className="px-6 py-4 text-sm text-gray-500 break-all">
                                                            {item.url}
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-bold">
                                                            {item.count.toLocaleString('nb-NO')}
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                            {index > 0 ? (
                                                                <span className="text-green-600 font-medium">{percentageOfPrev}%</span>
                                                            ) : '-'}
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                            {index > 0 && dropoffCount > 0 ? (
                                                                <div className="flex flex-col">
                                                                    <span className="text-red-600 font-medium">-{dropoffCount.toLocaleString('nb-NO')}</span>
                                                                    <span className="text-xs text-red-500">({dropoffPercentage}%)</span>
                                                                </div>
                                                            ) : '-'}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
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
                                    {funnelQueryStats && (
                                        <span className="text-sm text-gray-600">
                                            Data prosessert: {funnelQueryStats.totalBytesProcessedGB} GB
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Timing Data Section */}
                            <div className="mt-6">
                                <Heading level="3" size="small" className="mb-3">
                                    Gjennomsnittlig tid per steg
                                </Heading>

                                {!showTiming && (
                                    <Button
                                        variant="secondary"
                                        onClick={fetchTimingData}
                                        loading={timingLoading}
                                        disabled={timingLoading}
                                    >
                                        Beregn tid per steg
                                    </Button>
                                )}

                                {timingError && (
                                    <Alert variant="error" className="mb-4">
                                        {timingError}
                                    </Alert>
                                )}

                                {showTiming && !timingError && timingData.length > 0 && (
                                    <>
                                        <div className="border rounded-lg overflow-hidden mb-3">
                                            <div className="overflow-x-auto">
                                                <table className="min-w-full divide-y divide-gray-200">
                                                    <thead className="bg-gray-100">
                                                        <tr>
                                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Fra steg</th>
                                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Til steg</th>
                                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Gjennomsnitt</th>
                                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Median</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="bg-white divide-y divide-gray-200">
                                                        {timingData.map((timing, index) => (
                                                            <tr key={index} className="hover:bg-gray-50">
                                                                <td className="px-6 py-4 text-sm text-gray-900">
                                                                    <div className="flex flex-col">
                                                                        <span className="font-medium">Steg {timing.fromStep + 1}</span>
                                                                        <span className="text-xs text-gray-500 break-all">{timing.fromUrl}</span>
                                                                    </div>
                                                                </td>
                                                                <td className="px-6 py-4 text-sm text-gray-900">
                                                                    <div className="flex flex-col">
                                                                        <span className="font-medium">Steg {timing.toStep + 1}</span>
                                                                        <span className="text-xs text-gray-500 break-all">{timing.toUrl}</span>
                                                                    </div>
                                                                </td>
                                                                <td className="px-6 py-4 text-sm font-bold text-blue-600">
                                                                    {formatDuration(timing.avgSeconds)}
                                                                </td>
                                                                <td className="px-6 py-4 text-sm font-bold text-green-600">
                                                                    {formatDuration(timing.medianSeconds)}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                        {timingQueryStats && (
                                            <div className="text-sm text-gray-600 text-right">
                                                Data prosessert: {timingQueryStats.totalBytesProcessedGB} GB
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        </Tabs.Panel>
                    </Tabs>
                </>
            )}

            {!loading && !error && funnelData.length === 0 && hasAttemptedFetch && (
                <div className="text-center p-8 text-gray-500 bg-gray-50 rounded-lg border border-gray-200 mt-4">
                    Ingen data funnet for denne trakten i valgt periode.
                </div>
            )}
        </ChartLayout>
    );
};

export default Funnel;

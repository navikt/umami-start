import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { TextField, Button, Alert, Loader, Tabs, UNSAFE_Combobox } from '@navikt/ds-react';
import { Share2, Check } from 'lucide-react';
import { parseISO } from 'date-fns';
import ChartLayout from '../../components/analysis/ChartLayout';
import WebsitePicker from '../../components/analysis/WebsitePicker';
import PeriodPicker from '../../components/analysis/PeriodPicker';
import { Website } from '../../types/chart';
import { normalizeUrlToPath, getStoredPeriod, savePeriodPreference } from '../../lib/utils';


const EventJourney = () => {
    const [selectedWebsite, setSelectedWebsite] = useState<Website | null>(null);
    const [searchParams] = useSearchParams();

    // Initialize state from URL params - check both urlPath and pagePath for compatibility
    const [urlPath, setUrlPath] = useState<string>(() => searchParams.get('urlPath') || searchParams.get('pagePath') || '');
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

    // Client-side filter state
    const [filterText, setFilterText] = useState<string>('');

    type JourneyStats = {
        total_sessions?: number;
        sessions_with_events?: number;
        sessions_no_events_navigated?: number;
        sessions_no_events_bounced?: number;
        totalBytesProcessedGB?: number;
        estimatedCostUSD?: number;
    };

    const [data, setData] = useState<{ path: string[], count: number }[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [queryStats, setQueryStats] = useState<JourneyStats | null>(null);
    const [copySuccess, setCopySuccess] = useState<boolean>(false);
    const [hasAutoSubmitted, setHasAutoSubmitted] = useState<boolean>(false);
    const [lastAppliedFilterKey, setLastAppliedFilterKey] = useState<string | null>(null);

    const buildFilterKey = useCallback(() =>
        JSON.stringify({
            websiteId: selectedWebsite?.id ?? null,
            urlPath: normalizeUrlToPath(urlPath),
            period,
            customStartDate: customStartDate?.toISOString() ?? null,
            customEndDate: customEndDate?.toISOString() ?? null,
        }), [selectedWebsite?.id, urlPath, period, customStartDate, customEndDate]);
    const hasUnappliedFilterChanges = buildFilterKey() !== lastAppliedFilterKey;

    const [excludedEventTypes, setExcludedEventTypes] = useState<string[]>([]);
    const [activeTab, setActiveTab] = useState<string>('visual');

    const fetchData = useCallback(async () => {
        if (!selectedWebsite) return;

        if (!urlPath) return;
        const appliedFilterKey = buildFilterKey();

        setLoading(true);
        setError(null);
        setData([]);
        setHasAutoSubmitted(true);

        // Calculate date range
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
            const response = await fetch('/api/bigquery/event-journeys', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    websiteId: selectedWebsite.id,
                    urlPath,
                    startDate: startDate.toISOString(),
                    endDate: endDate.toISOString(),
                    minEvents: 1 // Allow paths of length 1
                }),
            });

            if (!response.ok) {
                throw new Error('Failed to fetch event journeys');
            }

            const result = await response.json();
            setData(result.journeys || []);
            setQueryStats(result.journeyStats);

            // Update URL
            const newParams = new URLSearchParams(window.location.search);
            newParams.set('period', period);
            newParams.set('urlPath', urlPath);
            newParams.delete('minEvents');
            window.history.replaceState({}, '', `${window.location.pathname}?${newParams.toString()}`);
            setLastAppliedFilterKey(appliedFilterKey);

        } catch (err) {
            console.error(err);
            setError('Kunne ikke laste hendelsesreiser. Prøv igjen senere.');
        } finally {
            setLoading(false);
        }
    }, [
        selectedWebsite,
        urlPath,
        buildFilterKey,
        period,
        customStartDate,
        customEndDate,
    ]);

    // Auto-submit when URL parameters are present (for shared links)
    useEffect(() => {
        const hasConfigParams = searchParams.has('period') || searchParams.has('urlPath');
        if (selectedWebsite && hasConfigParams && !hasAutoSubmitted && !loading) {
            setHasAutoSubmitted(true);
            fetchData();
        }
    }, [selectedWebsite, searchParams, hasAutoSubmitted, loading, fetchData]);

    const filteredData = (() => {
        const processed = data
            .map(journey => ({
                ...journey,
                path: journey.path
                    .filter(step => {
                        const eventName = step.split(': ')[0];
                        return !excludedEventTypes.includes(eventName);
                    })
                    .map(step => {
                        const parts = step.split(': ');
                        const eventName = parts[0];

                        if (parts.length < 2) return step;

                        const rawDetails = step.substring(eventName.length + 2);
                        const details = rawDetails.split('||');

                        const filteredDetails = details.filter(d => {
                            const splitIndex = d.indexOf(':');
                            if (splitIndex === -1) return true;

                            const key = d.substring(0, splitIndex).trim();
                            return key !== 'scrollPercent';
                        });

                        if (filteredDetails.length === 0) return eventName;

                        return `${eventName}: ${filteredDetails.join('||')}`;
                    })
            }))
            .filter(journey => journey.path.length > 0);

        const aggregatedMap = new Map<string, { path: string[], count: number }>();
        processed.forEach(journey => {
            const pathKey = JSON.stringify(journey.path);
            const existing = aggregatedMap.get(pathKey);
            if (existing) {
                existing.count += journey.count;
            } else {
                aggregatedMap.set(pathKey, { path: journey.path, count: journey.count });
            }
        });

        return Array.from(aggregatedMap.values())
            .filter(journey => {
                if (filterText) {
                    const lowerFilter = filterText.toLowerCase();
                    if (!journey.path.some(step => step.toLowerCase().includes(lowerFilter))) {
                        return false;
                    }
                }
                return true;
            })
            .sort((a, b) => b.count - a.count);
    })();

    const formatNumber = (num: number) => num.toLocaleString('nb-NO');

    const getUniqueEventTypes = (): string[] => {
        const eventTypes = new Set<string>();
        data.forEach(journey => {
            journey.path.forEach(step => {
                const eventName = step.split(': ')[0];
                if (eventName) eventTypes.add(eventName);
            });
        });
        return Array.from(eventTypes).sort();
    };

    const getPercentage = (count: number, total: number) => {
        if (!total) return '0.0%';
        return ((count / total) * 100).toFixed(1) + '%';
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

    return (
        <ChartLayout
            title="Hendelsesforløp"
            description="Se rekkefølgen av hendelser brukere gjør på en spesifikk side."
            currentPage="hendelsesreiser" // Need to update type in AnalyticsNavigation probably
            websiteDomain={selectedWebsite?.domain}
            websiteName={selectedWebsite?.name}
            sidebarContent={
                <WebsitePicker
                    selectedWebsite={selectedWebsite}
                    onWebsiteChange={setSelectedWebsite}
                    variant="minimal"
                />
            }
            filters={
                <>
                    <TextField
                        size="small"
                        label="URL"
                        value={urlPath}
                        onChange={(e) => setUrlPath(e.target.value)}
                        onBlur={(e) => setUrlPath(normalizeUrlToPath(e.target.value))}
                    />

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
                            disabled={!selectedWebsite || loading || !urlPath || !hasUnappliedFilterChanges}
                            loading={loading}
                            size="small"
                        >
                            Vis
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

            {!urlPath && !loading && data.length === 0 && (
                <Alert variant="info" className="mb-4">
                    Skriv inn en URL-sti for å se hendelsesforløp.
                </Alert>
            )}

            {loading && (
                <div className="flex justify-center items-center h-full">
                    <Loader size="xlarge" title="Laster hendelsesreiser..." />
                </div>
            )}

            {!loading && data.length > 0 && (
                <>
                    {/* Stats Summary */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                        {/* Unique Visitors */}
                        <div className="bg-[var(--ax-bg-default)] p-4 rounded-lg border border-[var(--ax-border-neutral-subtle)] shadow-sm">
                            <div className="text-sm text-[var(--ax-text-default)] font-medium mb-1">Unike besøkende</div>
                            <div className="text-2xl font-bold text-[var(--ax-text-default)] mb-1">
                                {formatNumber(queryStats?.total_sessions || 0)}
                            </div>
                            <div className="text-sm text-[var(--ax-text-subtle)] mt-1">Totalt i utvalget</div>
                        </div>

                        {/* Interactive */}
                        <div className="bg-[var(--ax-bg-default)] p-4 rounded-lg border border-[var(--ax-border-neutral-subtle)] shadow-sm">
                            <div className="text-sm text-[var(--ax-text-default)] font-medium mb-1">Utførte handlinger</div>
                            <div className="text-2xl font-bold text-[var(--ax-text-default)] mb-1">
                                {getPercentage(queryStats?.sessions_with_events || 0, queryStats?.total_sessions || 0)}
                            </div>
                            <div className="text-sm text-[var(--ax-text-subtle)] mt-1">
                                {formatNumber(queryStats?.sessions_with_events || 0)} sesjoner
                            </div>
                        </div>

                        {/* Navigated No Events */}
                        <div className="bg-[var(--ax-bg-default)] p-4 rounded-lg border border-[var(--ax-border-neutral-subtle)] shadow-sm">
                            <div className="text-sm text-[var(--ax-text-default)] font-medium mb-1">Navigering uten handling</div>
                            <div className="text-2xl font-bold text-[var(--ax-text-default)] mb-1">
                                {getPercentage(queryStats?.sessions_no_events_navigated || 0, queryStats?.total_sessions || 0)}
                            </div>
                            <div className="text-sm text-[var(--ax-text-subtle)] mt-1">
                                {formatNumber(queryStats?.sessions_no_events_navigated || 0)} sesjoner
                            </div>
                        </div>

                        {/* Bounced */}
                        <div className="bg-[var(--ax-bg-default)] p-4 rounded-lg border border-[var(--ax-border-neutral-subtle] shadow-sm">
                            <div className="text-sm text-[var(--ax-text-default)] font-medium mb-1">Forlot nettstedet</div>
                            <div className="text-2xl font-bold text-[var(--ax-text-default)] mb-1">
                                {getPercentage(queryStats?.sessions_no_events_bounced || 0, queryStats?.total_sessions || 0)}
                            </div>
                            <div className="text-sm text-[var(--ax-text-subtle)] mt-1">
                                {formatNumber(queryStats?.sessions_no_events_bounced || 0)} sesjoner
                            </div>
                        </div>
                    </div>


                    <div className="mb-4">
                        <div className="flex flex-wrap items-end gap-3">
                            {getUniqueEventTypes().length > 0 && (
                                <UNSAFE_Combobox
                                    label="Skjul hendelser"
                                    size="small"
                                    options={getUniqueEventTypes()}
                                    selectedOptions={excludedEventTypes}
                                    isMultiSelect
                                    placeholder="Velg..."
                                    onToggleSelected={(option: string, isSelected: boolean) => {
                                        if (isSelected) {
                                            setExcludedEventTypes([...excludedEventTypes, option]);
                                        } else {
                                            setExcludedEventTypes(excludedEventTypes.filter(e => e !== option));
                                        }
                                    }}
                                    className="w-56"
                                />
                            )}
                            <TextField
                                label="Søk"
                                size="small"
                                value={filterText}
                                onChange={(e) => setFilterText(e.target.value)}
                                className="w-48"
                            />
                            <Button
                                size="small"
                                variant="secondary"
                                icon={copySuccess ? <Check size={16} /> : <Share2 size={16} />}
                                onClick={copyShareLink}
                            >
                                {copySuccess ? 'Kopiert!' : 'Del'}
                            </Button>
                        </div>
                    </div>

                    <Tabs value={activeTab} onChange={setActiveTab}>
                        <Tabs.List>
                            <Tabs.Tab value="visual" label="Hendelsesforløp" />
                            <Tabs.Tab value="table" label="Tabellvisning" />
                        </Tabs.List>

                        <Tabs.Panel value="visual" className="pt-4">
                            <div className="bg-[var(--ax-bg-default)] border rounded-lg p-4">
                                {filteredData.length > 0 ? (
                                    filteredData.map((journey, idx) => (
                                        <div key={idx} className="mb-6 last:mb-0">
                                            <div className="flex items-center text-sm text-gray-500 mb-2">
                                                <span className="font-semibold text-[var(--ax-text-default)] mr-2">{formatNumber(journey.count)} sesjoner</span>
                                                <span>({((journey.count / data.reduce((a, b) => a + b.count, 0)) * 100).toFixed(1)}% av totalt)</span>
                                            </div>
                                            <div className="text-sm text-[var(--ax-text-default)] break-words">
                                                {journey.path.join(' → ')}
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-center text-gray-500 py-8">
                                        Ingen reiser matcher søket ditt.
                                    </div>
                                )}
                            </div>
                        </Tabs.Panel>

                        <Tabs.Panel value="table" className="pt-4">
                            <div className="border rounded-lg overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="min-w-full divide-y divide-[var(--ax-border-neutral-subtle)]">
                                        <thead className="bg-[var(--ax-bg-neutral-soft)]">
                                            <tr>
                                                <th className="px-4 py-2 text-left text-xs font-medium text-[var(--ax-text-default)] uppercase">Antall</th>
                                                <th className="px-4 py-2 text-left text-xs font-medium text-[var(--ax-text-default)] uppercase">Andel</th>
                                                <th className="px-4 py-2 text-left text-xs font-medium text-[var(--ax-text-default)] uppercase">Sti</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-[var(--ax-bg-default)] divide-y divide-[var(--ax-border-neutral-subtle)]">
                                            {filteredData.map((journey, idx) => (
                                                <tr key={idx} className="hover:bg-[var(--ax-bg-neutral-soft)]">
                                                    <td className="px-4 py-2 text-sm text-[var(--ax-text-default)]">{journey.count}</td>
                                                    <td className="px-4 py-2 text-sm text-[var(--ax-text-default)]">{((journey.count / data.reduce((a, b) => a + b.count, 0)) * 100).toFixed(1)}%</td>
                                                    <td className="px-4 py-2 text-sm text-[var(--ax-text-default)] break-words">{journey.path.join(' → ')}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </Tabs.Panel>
                    </Tabs>

                    {queryStats?.totalBytesProcessedGB && (
                        <div className="text-sm text-[var(--ax-text-subtle)] text-right mt-4">
                            Data prosessert: {queryStats.totalBytesProcessedGB} GB
                        </div>
                    )}
                </>
            )}

            {!loading && urlPath && data.length === 0 && !error && (
                <div className="flex justify-center items-center h-full text-gray-500">
                    Ingen egendefinerte hendelser funnet for valgt periode og filter.
                </div>
            )}
        </ChartLayout>
    );
};

export default EventJourney;

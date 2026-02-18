import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { TextField, Button, Alert, Loader, Tabs, UNSAFE_Combobox } from '@navikt/ds-react';
import { Share2, Check, ArrowRight } from 'lucide-react';
import { parseISO } from 'date-fns';
import ChartLayout from '../../components/analysis/ChartLayout';
import WebsitePicker from '../../components/analysis/WebsitePicker';
import PeriodPicker from '../../components/analysis/PeriodPicker';
import type { Website } from '../../types/chart';
import { normalizeUrlToPath, getStoredPeriod, savePeriodPreference } from '../../lib/utils';

type ParsedStepDetail = {
    key: string;
    value: string;
};

type ParsedJourneyStep = {
    eventName: string;
    details: ParsedStepDetail[];
};

type JourneyStats = {
    total_sessions?: number;
    sessions_with_events?: number;
    sessions_no_events_navigated?: number;
    sessions_no_events_bounced?: number;
    totalBytesProcessedGB?: number;
    estimatedCostUSD?: number;
};

type EventJourneyResponse = {
    journeys?: { path: string[]; count: number }[];
    journeyStats?: JourneyStats;
};

const parseJourneyStep = (step: string): ParsedJourneyStep => {
    const separatorIndex = step.indexOf(': ');
    if (separatorIndex === -1) {
        return {
            eventName: step.trim(),
            details: [],
        };
    }

    const eventName = step.slice(0, separatorIndex).trim();
    const rawDetails = step.slice(separatorIndex + 2);
    const details = rawDetails
        .split('||')
        .map((part) => part.trim())
        .filter(Boolean)
        .map((part) => {
            const detailSeparatorIndex = part.indexOf(':');
            if (detailSeparatorIndex === -1) {
                return { key: part, value: '' };
            }

            return {
                key: part.slice(0, detailSeparatorIndex).trim(),
                value: part.slice(detailSeparatorIndex + 1).trim(),
            };
        });

    return { eventName, details };
};

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
    const [expandedDetails, setExpandedDetails] = useState<Record<string, boolean>>({});

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

            const result: EventJourneyResponse = await response.json() as EventJourneyResponse;
            setData(result.journeys || []);
            setQueryStats(result.journeyStats || null);

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
            void fetchData();
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
    const totalJourneySessions = data.reduce((total, journey) => total + journey.count, 0);


    const copyShareLink = async () => {
        try {
            await navigator.clipboard.writeText(window.location.href);
            setCopySuccess(true);
            setTimeout(() => setCopySuccess(false), 2000);
        } catch (err) {
            console.error('Failed to copy link:', err);
        }
    };
    const toggleDetailsExpansion = (stepKey: string) => {
        setExpandedDetails((current) => ({
            ...current,
            [stepKey]: !current[stepKey],
        }));
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
                        <div className="bg-[var(--ax-bg-default)] p-4 rounded-lg border border-[var(--ax-border-neutral-subtle)] shadow-sm">
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
                        </div>
                    </div>

                    <Tabs value={activeTab} onChange={setActiveTab}>
                        <Tabs.List>
                            <Tabs.Tab value="visual" label="Hendelsesforløp" />
                            <Tabs.Tab value="table" label="Tabellvisning" />
                        </Tabs.List>

                        <Tabs.Panel value="visual" className="pt-4">
                            <div className="bg-[var(--ax-bg-default)]">
                                {filteredData.length > 0 ? (
                                    <div className="space-y-4">
                                        {filteredData.map((journey, idx) => (
                                            <div key={idx} className="rounded-xl border border-[var(--ax-border-neutral-subtle)] bg-[var(--ax-bg-default)] p-4">
                                                <div className="flex items-center gap-2 text-sm text-[var(--ax-text-subtle)] mb-3">
                                                    <span className="font-semibold text-[var(--ax-text-default)]">{formatNumber(journey.count)} sesjoner</span>
                                                    <span>({((journey.count / totalJourneySessions) * 100).toFixed(1)}% av totalt)</span>
                                                </div>

                                                <div className="overflow-x-auto pb-1">
                                                    <div className="flex min-w-max items-stretch gap-2">
                                                        {journey.path.map((step, stepIndex) => {
                                                            const parsedStep = parseJourneyStep(step);
                                                            const stepKey = `${idx}-${stepIndex}`;
                                                            const isExpanded = expandedDetails[stepKey] === true;
                                                            const detailsToRender = isExpanded ? parsedStep.details : parsedStep.details.slice(0, 4);
                                                            const hiddenDetailsCount = parsedStep.details.length - detailsToRender.length;

                                                            return (
                                                                <div key={`${step}-${stepIndex}`} className="flex items-center gap-2">
                                                                    <div className="w-[320px] min-h-[120px] rounded-lg border border-[var(--ax-border-neutral-subtle)] bg-[var(--ax-bg-neutral-soft)] p-3">
                                                                        <div className="text-xs font-medium text-[var(--ax-text-subtle)] mb-1">
                                                                            Steg {stepIndex + 1}
                                                                        </div>
                                                                        <div className="text-sm font-semibold text-[var(--ax-text-default)] break-words">
                                                                            {parsedStep.eventName}
                                                                        </div>
                                                                        {detailsToRender.length > 0 && (
                                                                            <div className="mt-2 space-y-1">
                                                                                {detailsToRender.map((detail, detailIndex) => (
                                                                                    <div key={`${detail.key}-${detail.value}-${detailIndex}`} className="text-sm leading-5">
                                                                                        <span className="font-bold text-[var(--ax-text-default)]">{detail.key}:</span>{' '}
                                                                                        <span className="text-[var(--ax-text-default)] break-words">{detail.value}</span>
                                                                                    </div>
                                                                                ))}
                                                                                {parsedStep.details.length > 4 && (
                                                                                    <Button
                                                                                        type="button"
                                                                                        size="xsmall"
                                                                                        variant="secondary"
                                                                                        data-color="neutral" 
                                                                                        onClick={() => toggleDetailsExpansion(stepKey)}
                                                                                        className="mt-1 w-fit"
                                                                                    >
                                                                                        {isExpanded ? 'Vis færre felter' : `Vis alle felter (+${hiddenDetailsCount})`}
                                                                                    </Button>
                                                                                )}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                    {stepIndex < journey.path.length - 1 && (
                                                                        <ArrowRight size={16} className="text-[var(--ax-text-subtle)] flex-shrink-0" />
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
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
                                                    <td className="px-4 py-2 text-sm text-[var(--ax-text-default)]">{((journey.count / totalJourneySessions) * 100).toFixed(1)}%</td>
                                                    <td className="px-4 py-2 text-sm text-[var(--ax-text-default)] break-words">
                                                        {journey.path.map((step) => parseJourneyStep(step).eventName).join(' → ')}
                                                    </td>
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

            {!loading && urlPath && data.length === 0 && !error && (
                <div className="flex justify-center items-center h-full text-gray-500">
                    Ingen egendefinerte hendelser funnet for valgt periode og filter.
                </div>
            )}
        </ChartLayout>
    );
};

export default EventJourney;

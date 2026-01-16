import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { TextField, Button, Alert, Loader, Heading, Table, Modal, Label, Select, UNSAFE_Combobox, Tabs } from '@navikt/ds-react';
import { Share2, Check, Plus, Trash2, ExternalLink } from 'lucide-react';
import ChartLayout from '../components/ChartLayout';
import WebsitePicker from '../components/WebsitePicker';
import PeriodPicker from '../components/PeriodPicker';
import { Website } from '../types/chart';
import { normalizeUrlToPath, isDecoratorEvent } from '../lib/utils';


const EventJourney = () => {
    const [selectedWebsite, setSelectedWebsite] = useState<Website | null>(null);
    const [searchParams] = useSearchParams();

    // Initialize state from URL params - check both urlPath and pagePath for compatibility
    const [urlPath, setUrlPath] = useState<string>(() => searchParams.get('urlPath') || searchParams.get('pagePath') || '');
    const [period, setPeriod] = useState<string>(() => searchParams.get('period') || 'current_month');
    const [customStartDate, setCustomStartDate] = useState<Date | undefined>(undefined);
    const [customEndDate, setCustomEndDate] = useState<Date | undefined>(undefined);

    // Client-side filter state
    const [filterText, setFilterText] = useState<string>('');

    const [data, setData] = useState<{ path: string[], count: number }[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [queryStats, setQueryStats] = useState<any>(null);
    const [dryRunStats, setDryRunStats] = useState<any>(null);
    const [copySuccess, setCopySuccess] = useState<boolean>(false);
    const [hasAutoSubmitted, setHasAutoSubmitted] = useState<boolean>(false);

    // Modal state
    const [selectedStepDetails, setSelectedStepDetails] = useState<{ title: string, details: string[] } | null>(null);
    const [loopVariations, setLoopVariations] = useState<{ title: string; allSteps: string[] } | null>(null);

    // Exclusion filter state
    const [excludedEventTypes, setExcludedEventTypes] = useState<string[]>([]);

    // Funnel building state
    const [funnelSteps, setFunnelSteps] = useState<{ value: string; stepIndex: number; details?: string[] }[]>([]);
    const [activeTab, setActiveTab] = useState<string>('visual');

    const toggleFunnelStep = (e: React.MouseEvent, value: string, stepIndex: number, details: string[]) => {
        e.stopPropagation();
        setFunnelSteps(prev => {
            const exists = prev.some(s => s.value === value && s.stepIndex === stepIndex);
            if (exists) {
                return prev.filter(s => !(s.value === value && s.stepIndex === stepIndex));
            } else {
                return [...prev, { value, stepIndex, details }];
            }
        });
    };

    const navigateToFunnel = () => {
        if (!selectedWebsite) return;

        // Sort by step index
        const sortedSteps = [...funnelSteps].sort((a, b) => a.stepIndex - b.stepIndex);

        const params = new URLSearchParams();
        params.set('websiteId', selectedWebsite.id);
        params.set('period', 'current_month');
        params.set('strict', 'true');

        // Step 1: The current URL path
        params.append('step', urlPath);

        // Subsequent steps: The selected events
        sortedSteps.forEach(s => {
            // scope to current-path since we are in EventJourney context
            let stepStr = `event:${s.value}|current-path`;

            // Add params if any
            if (s.details && s.details.length > 0) {
                s.details.forEach(detail => {
                    const [key, ...values] = detail.split(': ');
                    const value = values.join(': ');

                    // Filter out some keys if needed, or include all relevant ones
                    // Common keys to include: text, url, destinasjon, label
                    const relevantKeys = ['text', 'url', 'destinasjon', 'label', 'tittel', 'lenketekst', 'tekst'];
                    if (relevantKeys.includes(key.toLowerCase()) || key === 'Tekst') {
                        // Encode param in URL
                        stepStr += `|param:${key}=${value}`;
                    }
                });
            }

            params.append('step', stepStr);
        });

        const url = `/trakt?${params.toString()}`;
        window.open(url, '_blank');
    };


    // Auto-submit when URL parameters are present (for shared links)
    useEffect(() => {
        const hasConfigParams = searchParams.has('period') || searchParams.has('urlPath');
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
        setData([]);

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
            setDryRunStats(result.queryStats);

            // Update URL
            const newParams = new URLSearchParams(window.location.search);
            newParams.set('period', period);
            newParams.set('urlPath', urlPath);
            newParams.delete('minEvents');
            window.history.replaceState({}, '', `${window.location.pathname}?${newParams.toString()}`);

        } catch (err) {
            console.error(err);
            setError('Kunne ikke laste hendelsesreiser. Prøv igjen senere.');
        } finally {
            setLoading(false);
        }
    };

    // Filter state
    type FilterType = 'all' | 'hide_decorator' | 'only_decorator' | 'with_content' | 'with_exit';
    const [activeFilter, setActiveFilter] = useState<FilterType>('all');

    // Filter data client-side
    // Filter and aggregate data client-side
    const filteredData = (() => {
        // Step 1: Filter out excluded event types from each journey's path and remove scrollPercent
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

        // Step 2: Re-aggregate journeys with identical paths after filtering
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

        // Step 3: Apply other filters (text search and advanced filters)
        return Array.from(aggregatedMap.values())
            .filter(journey => {
                // First filter by text
                if (filterText) {
                    const lowerFilter = filterText.toLowerCase();
                    if (!journey.path.some(step => step.toLowerCase().includes(lowerFilter))) {
                        return false;
                    }
                }

                // Advanced filter logic
                if (activeFilter !== 'all') {
                    let hasDecoratorStep = false;
                    let hasContentStep = false;
                    let hasExitStep = false;

                    // Single pass to check for all properties
                    for (const step of journey.path) {
                        const parts = step.split(': ');
                        const eventName = parts[0];

                        // Check Decorator
                        if (isDecoratorEvent(eventName)) {
                            hasDecoratorStep = true;
                        }

                        const rawDetails = parts.length > 1 ? step.substring(eventName.length + 2) : '';
                        const details = rawDetails.split('||').filter(Boolean);

                        for (const d of details) {
                            const splitIndex = d.indexOf(':');
                            if (splitIndex === -1) continue;

                            const k = d.substring(0, splitIndex).trim();
                            const v = d.substring(splitIndex + 1).trim();
                            const kLower = k.toLowerCase();

                            // Check Decorator (via category)
                            if (k === 'kategori' && v && isDecoratorEvent(v)) {
                                hasDecoratorStep = true;
                            }

                            // Check Content
                            if (kLower === 'lenkegruppe' && v.toLowerCase() === 'innhold') {
                                hasContentStep = true;
                            }

                            // Check Exit
                            if (kLower === 'destinasjon' && v) {
                                hasExitStep = true;
                            }
                        }
                    }

                    if (activeFilter === 'hide_decorator' && hasDecoratorStep) return false;
                    if (activeFilter === 'only_decorator' && !hasDecoratorStep) return false;
                    if (activeFilter === 'with_content' && !hasContentStep) return false;
                    if (activeFilter === 'with_exit' && !hasExitStep) return false;
                }

                return true;
            })
            .sort((a, b) => b.count - a.count); // Re-sort by count after aggregation
    })();

    const formatNumber = (num: number) => num.toLocaleString('nb-NO');

    // Get unique event types from data for exclusion filter
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

    const getMaxSteps = () => {
        if (!filteredData.length) return 0;
        return Math.max(...filteredData.map(d => d.path.length));
    };

    const showDecoratorFilter = selectedWebsite?.name.toLowerCase().includes('nav.no');

    // Loop detection: finds repeating sequences and groups them
    type GroupedStep =
        | { type: 'single'; step: string; originalIndex: number }
        | { type: 'loop'; pattern: string[]; count: number; startIndex: number; variations?: string[]; hasExit?: boolean; allSteps?: string[]; hasDuplicateInPattern?: boolean }
        | { type: 'duplicate'; steps: string[]; startIndex: number };

    // Extract a grouping key from a step for comparison
    // All properties except destinasjon must match for events to be grouped
    const getStepGroupingKey = (step: string): string => {
        const parts = step.split(': ');
        const eventName = parts[0];
        const rawDetails = parts.length > 1 ? step.substring(eventName.length + 2) : '';
        const details = rawDetails.split('||').filter(Boolean);

        const detailMap: Record<string, string> = {};
        details.forEach(d => {
            const [k, v] = d.split(': ');
            if (k && v) detailMap[k] = v;
        });

        // Include all meaningful properties in the key EXCEPT destinasjon
        // If these differ, events are NOT considered the same action
        const identifier = detailMap['lenketekst'] || detailMap['tekst'] || '';
        const seksjon = detailMap['seksjon'] || '';
        const lenkegruppe = detailMap['lenkegruppe'] || '';
        const innholdstype = detailMap['innholdstype'] || '';
        const malgruppe = detailMap['malgruppe'] || '';

        return `${eventName}::${identifier}::${seksjon}::${lenkegruppe}::${innholdstype}::${malgruppe}`;
    };

    // Extract all details from a step for variation detection
    const getStepDetails = (step: string): Record<string, string> => {
        const parts = step.split(': ');
        const eventName = parts[0];
        const rawDetails = parts.length > 1 ? step.substring(eventName.length + 2) : '';
        const details = rawDetails.split('||').filter(Boolean);

        const detailMap: Record<string, string> = { _eventName: eventName };
        details.forEach(d => {
            const [k, v] = d.split(': ');
            if (k && v) detailMap[k] = v;
        });
        return detailMap;
    };

    // Find if destinasjon varies across a set of steps (only meaningful variation for loops)
    const findVariations = (steps: string[]): { variations: string[]; hasExit: boolean } => {
        if (steps.length < 2) return { variations: [], hasExit: false };

        const allDetails = steps.map(getStepDetails);

        // Only check if destinasjon varies - other properties don't matter for loop detection
        const destinations = new Set(allDetails.map(d => d['destinasjon'] || ''));

        if (destinations.size > 1) {
            return { variations: ['Destinasjon'], hasExit: true };
        }

        return { variations: [], hasExit: false };
    };

    const detectLoops = (path: string[]): GroupedStep[] => {
        const result: GroupedStep[] = [];
        let i = 0;
        let originalIdx = 0;

        while (i < path.length) {
            let bestMatch: { len: number; count: number } | null = null;

            // Try pattern lengths from 1 to 3
            for (let len = 1; len <= 3; len++) {
                if (i + len * 2 > path.length) continue;

                const pattern = path.slice(i, i + len);
                const patternKeys = pattern.map(getStepGroupingKey);
                let count = 1;
                let nextIdx = i + len;

                while (nextIdx + len <= path.length) {
                    const nextChunk = path.slice(nextIdx, nextIdx + len);
                    const nextKeys = nextChunk.map(getStepGroupingKey);
                    const matches = nextKeys.every((key, k) => key === patternKeys[k]);
                    if (matches) {
                        count++;
                        nextIdx += len;
                    } else {
                        break;
                    }
                }

                if (count > 1) {
                    // Prefer longer patterns that cover more ground
                    if (!bestMatch || (len * count > bestMatch.len * bestMatch.count)) {
                        bestMatch = { len, count };
                    }
                }
            }

            if (bestMatch) {
                // Collect all steps in the loop to find variations
                const allStepsInLoop = path.slice(i, i + bestMatch.len * bestMatch.count);
                const { variations, hasExit } = findVariations(allStepsInLoop);

                // Check if pattern contains duplicates (consecutive steps with same tekst but different event names)
                const patternSteps = path.slice(i, i + bestMatch.len);
                const getEventName = (step: string): string => step.split(': ')[0];

                const getSubtitleFromStep = (step: string): string => {
                    const parts = step.split(': ');
                    const eventName = parts[0];
                    const rawDetails = parts.length > 1 ? step.substring(eventName.length + 2) : '';
                    const details = rawDetails.split('||').filter(Boolean);

                    const map: Record<string, string> = {};
                    for (const d of details) {
                        const [k, v] = d.split(': ');
                        if (k && v) map[k] = v;
                    }

                    if (map['destinasjon']) return map['destinasjon'];
                    if (map['lenketekst']) return map['lenketekst'];
                    if (map['tekst']) return map['tekst'];
                    if (map['Tekst']) return map['Tekst'];
                    if (map['tittel']) return map['tittel'];
                    if (map['label']) return map['label'];
                    if (map['url']) return map['url'];
                    return '';
                };

                // Helper to check if event names indicate opposing actions (open/close)
                const isOpposingAction = (name1: string, name2: string): boolean => {
                    const n1 = name1.toLowerCase();
                    const n2 = name2.toLowerCase();
                    const openTerms = ['åpne', 'open', 'expand', 'show', 'vis'];
                    const closeTerms = ['lukke', 'close', 'collapse', 'hide', 'skjul'];

                    const isOpen = (n: string) => openTerms.some(t => n.includes(t));
                    const isClose = (n: string) => closeTerms.some(t => n.includes(t));

                    return (isOpen(n1) && isClose(n2)) || (isClose(n1) && isOpen(n2));
                };

                let hasDuplicateInPattern = false;
                for (let p = 0; p < patternSteps.length - 1; p++) {
                    const currSub = getSubtitleFromStep(patternSteps[p]);
                    const nextSub = getSubtitleFromStep(patternSteps[p + 1]);
                    const currEvent = getEventName(patternSteps[p]);
                    const nextEvent = getEventName(patternSteps[p + 1]);

                    if (currSub && currSub === nextSub && currEvent !== nextEvent && !isOpposingAction(currEvent, nextEvent)) {
                        hasDuplicateInPattern = true;
                        break;
                    }
                }

                result.push({
                    type: 'loop',
                    pattern: patternSteps,
                    count: bestMatch.count,
                    startIndex: originalIdx,
                    variations,
                    hasExit,
                    allSteps: allStepsInLoop,
                    hasDuplicateInPattern
                });
                i += bestMatch.len * bestMatch.count;
                originalIdx += bestMatch.len * bestMatch.count;
            } else {
                // Check for potential duplicate (same tekst, different event name as next step)
                const getEventName = (step: string): string => step.split(': ')[0];

                // Look ahead to collect consecutive duplicates
                const getSubtitleFromStep = (step: string): string => {
                    const parts = step.split(': ');
                    const eventName = parts[0];
                    const rawDetails = parts.length > 1 ? step.substring(eventName.length + 2) : '';
                    const details = rawDetails.split('||').filter(Boolean);

                    const map: Record<string, string> = {};
                    for (const d of details) {
                        const [k, v] = d.split(': ');
                        if (k && v) map[k] = v;
                    }

                    if (map['destinasjon']) return map['destinasjon'];
                    if (map['lenketekst']) return map['lenketekst'];
                    if (map['tekst']) return map['tekst'];
                    if (map['Tekst']) return map['Tekst'];
                    if (map['tittel']) return map['tittel'];
                    if (map['label']) return map['label'];
                    if (map['url']) return map['url'];
                    return '';
                };

                const currentEventName = getEventName(path[i]);

                // Helper to check if event names indicate opposing actions (open/close)
                const isOpposingAction = (name1: string, name2: string): boolean => {
                    const n1 = name1.toLowerCase();
                    const n2 = name2.toLowerCase();
                    const openTerms = ['åpne', 'open', 'expand', 'show', 'vis'];
                    const closeTerms = ['lukke', 'close', 'collapse', 'hide', 'skjul'];

                    const isOpen = (n: string) => openTerms.some(t => n.includes(t));
                    const isClose = (n: string) => closeTerms.some(t => n.includes(t));

                    return (isOpen(n1) && isClose(n2)) || (isClose(n1) && isOpen(n2));
                };

                const currentSub = getSubtitleFromStep(path[i]);

                if (currentSub && i + 1 < path.length) {
                    const nextSub = getSubtitleFromStep(path[i + 1]);
                    const nextEventName = getEventName(path[i + 1]);

                    if (currentSub === nextSub && currentEventName !== nextEventName && !isOpposingAction(currentEventName, nextEventName)) {
                        // Found a duplicate pair - collect all consecutive duplicates with same subtitle
                        const duplicateSteps: string[] = [path[i]];
                        let j = i + 1;
                        while (j < path.length) {
                            const jSub = getSubtitleFromStep(path[j]);
                            const jEventName = getEventName(path[j]);

                            // Continue if same subtitle and different event name from previous
                            if (jSub === currentSub && jEventName !== getEventName(path[j - 1]) && !isOpposingAction(getEventName(path[j - 1]), jEventName)) {
                                duplicateSteps.push(path[j]);
                                j++;
                            } else {
                                break;
                            }
                        }

                        if (duplicateSteps.length >= 2) {
                            result.push({
                                type: 'duplicate',
                                steps: duplicateSteps,
                                startIndex: originalIdx
                            });
                            i += duplicateSteps.length;
                            originalIdx += duplicateSteps.length;
                            continue;
                        }
                    }
                }

                result.push({ type: 'single', step: path[i], originalIndex: originalIdx });
                i++;
                originalIdx++;
            }
        }

        return result;
    };

    return (
        <ChartLayout
            title="Hendelsesflyt"
            description="Se rekkefølgen av hendelser brukere gjør på en spesifikk side."
            currentPage="hendelsesreiser" // Need to update type in AnalyticsNavigation probably
            filters={
                <>
                    <WebsitePicker
                        selectedWebsite={selectedWebsite}
                        onWebsiteChange={setSelectedWebsite}
                        variant="minimal"
                    />

                    <TextField
                        size="small"
                        label="URL-sti"
                        description="Hvilken side vil du analysere?"
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

                    <Button
                        onClick={fetchData}
                        disabled={!selectedWebsite || loading || !urlPath}
                        loading={loading}
                    >
                        Vis reiser
                    </Button>
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
                    Skriv inn en URL-sti for å analysere hendelsesflyt på en spesifikk side.
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
                        <div className="bg-white border text-center rounded-lg p-6 flex flex-col h-full shadow-sm">
                            <div className="h-12 flex items-center justify-center mb-2">
                                <Label size="small" className="text-gray-600">Unike besøkende</Label>
                            </div>
                            <div className="flex-1 flex flex-col justify-center">
                                <div className="text-xl lg:text-2xl font-bold mb-1">{formatNumber(queryStats?.total_sessions || 0)}</div>
                                <div className="text-sm font-medium invisible">placeholder</div>
                            </div>
                        </div>

                        {/* Interactive */}
                        <div className="bg-blue-50 border border-blue-100 text-center rounded-lg p-6 flex flex-col h-full shadow-sm">
                            <div className="h-12 flex items-center justify-center mb-2">
                                <Label size="small" className="text-blue-900">Utførte handlinger</Label>
                            </div>
                            <div className="flex-1 flex flex-col justify-center">
                                <div className="text-xl lg:text-2xl font-bold text-blue-900 mb-1">
                                    {getPercentage(queryStats?.sessions_with_events || 0, queryStats?.total_sessions || 0)}
                                </div>
                                <div className="text-sm font-medium text-blue-800">
                                    {formatNumber(queryStats?.sessions_with_events || 0)} sesjoner
                                </div>
                            </div>
                        </div>

                        {/* Navigated No Events */}
                        <div className="bg-green-50 border border-green-100 text-center rounded-lg p-6 flex flex-col h-full shadow-sm">
                            <div className="h-12 flex items-center justify-center mb-2">
                                <Label size="small" className="text-green-900">Navigering uten handling</Label>
                            </div>
                            <div className="flex-1 flex flex-col justify-center">
                                <div className="text-xl lg:text-2xl font-bold text-green-900 mb-1">
                                    {getPercentage(queryStats?.sessions_no_events_navigated || 0, queryStats?.total_sessions || 0)}
                                </div>
                                <div className="text-sm font-medium text-green-800">
                                    {formatNumber(queryStats?.sessions_no_events_navigated || 0)} sesjoner
                                </div>
                            </div>
                        </div>

                        {/* Bounced */}
                        <div className="bg-red-50 border border-red-100 text-center rounded-lg p-6 flex flex-col h-full shadow-sm">
                            <div className="h-12 flex items-center justify-center mb-2">
                                <Label size="small" className="text-red-900">Forlot nettstedet</Label>
                            </div>
                            <div className="flex-1 flex flex-col justify-center">
                                <div className="text-xl lg:text-2xl font-bold text-red-900 mb-1">
                                    {getPercentage(queryStats?.sessions_no_events_bounced || 0, queryStats?.total_sessions || 0)}
                                </div>
                                <div className="text-sm font-medium text-red-800">
                                    {formatNumber(queryStats?.sessions_no_events_bounced || 0)} sesjoner
                                </div>
                            </div>
                        </div>
                    </div>


                    <div className="mb-4">
                        <Heading level="2" size="medium" className="mb-3">Hendelsesflyt</Heading>
                        <div className="flex flex-wrap items-end gap-3">
                            {showDecoratorFilter && (
                                <Select
                                    label="Visning"
                                    size="small"
                                    value={activeFilter}
                                    onChange={(e) => setActiveFilter(e.target.value as FilterType)}
                                    className="w-48"
                                >
                                    <option value="all">Alle reiser</option>
                                    <option value="hide_decorator">Utenfor dekoratøren</option>
                                    <option value="only_decorator">Innenfor dekoratøren</option>
                                    <option value="with_content">Med innholdsmeny</option>
                                    <option value="with_exit">Med utgang</option>
                                </Select>
                            )}
                            {getUniqueEventTypes().length > 0 && (
                                <UNSAFE_Combobox
                                    label="Skjul hendelser"
                                    size="small"
                                    options={getUniqueEventTypes()}
                                    selectedOptions={excludedEventTypes}
                                    isMultiSelect
                                    placeholder="Velg..."
                                    onToggleSelected={(option, isSelected) => {
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
                            <Tabs.Tab value="visual" label="Flyt" />
                            <Tabs.Tab value="table" label="Tabell" />
                        </Tabs.List>

                        <Tabs.Panel value="visual" className="pt-4">

                            <div className="bg-white border rounded-lg p-4 mb-4 overflow-x-auto">
                                <div className="min-w-max">
                                    {filteredData.length > 0 ? (
                                        filteredData.map((journey, idx) => (
                                            <div key={idx} className="mb-8 last:mb-0">
                                                <div className="flex items-center text-sm text-gray-500 mb-2">
                                                    <span className="font-semibold text-gray-900 mr-2">{formatNumber(journey.count)} sesjoner</span>
                                                    <span>({((journey.count / data.reduce((a, b) => a + b.count, 0)) * 100).toFixed(1)}% av totalt)</span>
                                                </div>
                                                <div className="flex items-start overflow-x-auto pb-6 pt-6 pl-4 pr-1">
                                                    {detectLoops(journey.path).map((group, groupIdx, groups) => {
                                                        // Helper to render a single step card
                                                        const renderStepCard = (step: string, stepNumber: number, isCompact: boolean = false) => {
                                                            const parts = step.split(': ');
                                                            const eventName = parts[0];
                                                            const rawDetails = parts.length > 1 ? step.substring(eventName.length + 2) : '';
                                                            const details = rawDetails.split('||').filter(Boolean);

                                                            let cardTitle = eventName;
                                                            let cardSubtitle = '';
                                                            let cardLabel = '';

                                                            const detailMap: Record<string, string> = {};
                                                            details.forEach(d => {
                                                                const [k, v] = d.split(': ');
                                                                if (k && v) detailMap[k] = v;
                                                            });

                                                            const labelCandidate = detailMap['lenketekst'] || detailMap['tekst'] || detailMap['Tekst'] || detailMap['tittel'] || detailMap['label'];

                                                            if (detailMap['destinasjon']) {
                                                                cardSubtitle = detailMap['destinasjon'];
                                                                // If we have both a destination and a label, use label as primary info
                                                                if (labelCandidate && labelCandidate !== cardSubtitle) {
                                                                    cardLabel = labelCandidate;
                                                                }
                                                            } else {
                                                                cardSubtitle = labelCandidate || detailMap['url'] || '';
                                                            }

                                                            const category = detailMap['kategori'];
                                                            const isDecorator = isDecoratorEvent(eventName) || (category && isDecoratorEvent(category));
                                                            const lenkegruppe = detailMap['lenkegruppe'];
                                                            const isContent = lenkegruppe && lenkegruppe.toLowerCase() === 'innhold';

                                                            // Nuanced navigation type detection
                                                            const destinasjon = detailMap['destinasjon'];
                                                            let navType: 'none' | 'internal' | 'external' = 'none';
                                                            if (destinasjon) {
                                                                // Check if it's an external URL (starts with http and not nav.no domain)
                                                                if (destinasjon.startsWith('http://') || destinasjon.startsWith('https://')) {
                                                                    // External if not nav.no
                                                                    const isNavDomain = destinasjon.includes('nav.no');
                                                                    navType = isNavDomain ? 'internal' : 'external';
                                                                } else if (destinasjon.startsWith('/')) {
                                                                    // Relative path = internal navigation
                                                                    navType = 'internal';
                                                                } else if (destinasjon.startsWith('#')) {
                                                                    // Anchor = internal (already covered by isContent usually)
                                                                    navType = 'none'; // Let isContent handle it
                                                                } else {
                                                                    // Other patterns - treat as internal
                                                                    navType = 'internal';
                                                                }
                                                            }

                                                            const isInternalNav = navType === 'internal';
                                                            const isExternalExit = navType === 'external';

                                                            if (isCompact) {
                                                                // Compact version for inside loops
                                                                const isFunnelStep = funnelSteps.some(s => s.value === eventName && s.stepIndex === stepNumber - 1);

                                                                return (
                                                                    <div
                                                                        className={`border rounded shadow-sm p-2 min-w-[120px] max-w-[150px] bg-white text-left text-xs cursor-pointer hover:shadow-md transition-shadow relative group ${isFunnelStep ? 'ring-2 ring-green-500 border-green-500' : ''} ${isDecorator ? 'border-purple-300 border-l-4 border-l-purple-400' :
                                                                            isContent ? 'border-green-300 border-l-4 border-l-green-400' :
                                                                                isExternalExit ? 'border-amber-400 border-l-4 border-l-amber-500' :
                                                                                    isInternalNav ? 'border-amber-400 border-l-4 border-l-amber-500' :
                                                                                        'border-gray-200'
                                                                            }`}
                                                                        onClick={() => setSelectedStepDetails({ title: eventName, details })}
                                                                    >
                                                                        <div className="flex justify-between items-start">
                                                                            <div className="font-semibold truncate text-gray-900 pr-4">{cardTitle}</div>
                                                                            <button
                                                                                onClick={(e) => toggleFunnelStep(e, eventName, stepNumber - 1, details)}
                                                                                className={`
                                                                            absolute top-1 right-1 w-4 h-4 rounded-full flex items-center justify-center transition-all
                                                                            ${isFunnelStep
                                                                                        ? 'bg-green-500 text-white'
                                                                                        : 'bg-gray-100 text-gray-400 hover:bg-blue-100 hover:text-blue-600 opacity-0 group-hover:opacity-100'
                                                                                    }
                                                                        `}
                                                                                title={isFunnelStep ? "Fjern fra trakt" : "Legg til i trakt"}
                                                                            >
                                                                                {isFunnelStep ? <Check size={10} strokeWidth={3} /> : <Plus size={10} strokeWidth={3} />}
                                                                            </button>
                                                                        </div>
                                                                        {(cardLabel || cardSubtitle) && (
                                                                            <div className="mt-1 flex flex-col min-w-0">
                                                                                {cardLabel && <div className="text-[10px] font-bold text-gray-800 truncate leading-tight">{cardLabel}</div>}
                                                                                {cardSubtitle && <div className="text-gray-500 truncate text-[9px] italic leading-tight">{cardSubtitle}</div>}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                );
                                                            }

                                                            // Full version
                                                            const isFunnelStep = funnelSteps.some(s => {
                                                                if (s.value !== eventName || s.stepIndex !== stepNumber - 1) return false;

                                                                // If selected step has details, we must match them
                                                                if (s.details && s.details.length > 0) {
                                                                    const parseDetails = (dArr: string[]) => {
                                                                        const map: Record<string, string> = {};
                                                                        dArr.forEach(d => {
                                                                            // Handle both ": " and ":" separator for robustness
                                                                            const parts = d.split(':');
                                                                            if (parts.length >= 2) {
                                                                                const k = parts[0].trim();
                                                                                const v = parts.slice(1).join(':').trim();
                                                                                if (k && v) map[k] = v;
                                                                            }
                                                                        });
                                                                        return map;
                                                                    };

                                                                    const selectedParams = parseDetails(s.details);
                                                                    const currentParams = parseDetails(details);

                                                                    const relevantKeys = [
                                                                        'text', 'url', 'destinasjon', 'label', 'tittel', 'lenketekst', 'tekst', 'Tekst',
                                                                        'referrer', 'kilde', 'source', 'medium', 'campaign', 'content'
                                                                    ];

                                                                    // Find keys in the SELECTED step that are "relevant" (visible/important)
                                                                    let usefulKeys = Object.keys(selectedParams).filter(k => relevantKeys.includes(k) || relevantKeys.includes(k.toLowerCase()));

                                                                    // If we found NO relevant keys, but we DO have details, likely we should match strictly on specific common keys or just ALL keys 
                                                                    // to avoid "wildcard" matching a specific event against everything else.
                                                                    // However, matching ALL keys might be too strict if there are IDs etc.
                                                                    // For now, if no generic relevant keys are found, effectively treat it as a "generic" match (return true) UNLESS 
                                                                    // we want to enforce stricter matching. Given the user's complaint, we should trigger on *any* key diff if we can't identify the important one.

                                                                    if (usefulKeys.length === 0 && Object.keys(selectedParams).length > 0) {
                                                                        // Fallback: match on ALL keys available in the selected param to be safe
                                                                        usefulKeys = Object.keys(selectedParams);
                                                                    }

                                                                    if (usefulKeys.length === 0) return true; // Truly no params

                                                                    return usefulKeys.every(k => selectedParams[k] === currentParams[k]);
                                                                }

                                                                return true;
                                                            });

                                                            return (
                                                                <div className="flex flex-col items-center group relative">
                                                                    <div
                                                                        role="button"
                                                                        tabIndex={0}
                                                                        className={`border rounded-lg shadow-sm p-3 min-w-[160px] max-w-[220px] hover:shadow-md transition-all text-left focus:outline-none focus:ring-2 focus:ring-blue-500 relative cursor-pointer ${isFunnelStep ? 'ring-2 ring-green-500 border-green-500' : ''} ${isDecorator
                                                                            ? 'bg-white border-purple-300 hover:border-purple-400 border-l-4 border-l-purple-400'
                                                                            : isContent
                                                                                ? 'bg-white border-green-300 hover:border-green-400 border-l-4 border-l-green-400'
                                                                                : isExternalExit
                                                                                    ? 'bg-white border-amber-400 hover:border-amber-500 border-l-4 border-l-amber-500'
                                                                                    : isInternalNav
                                                                                        ? 'bg-white border-amber-400 hover:border-amber-500 border-l-4 border-l-amber-500'
                                                                                        : 'bg-white hover:border-blue-300'
                                                                            }`}
                                                                        onClick={() => setSelectedStepDetails({ title: eventName, details })}
                                                                        onKeyDown={(e) => {
                                                                            if (e.key === 'Enter' || e.key === ' ') {
                                                                                setSelectedStepDetails({ title: eventName, details });
                                                                            }
                                                                        }}
                                                                    >
                                                                        <div className="flex justify-between items-start mb-2">
                                                                            <div className="flex-1 min-w-0 pr-6">
                                                                                {isDecorator && (
                                                                                    <div className="inline-block px-1.5 py-0.5 rounded-sm bg-purple-50 border border-purple-100 text-[10px] uppercase tracking-wider font-bold text-purple-700 mb-1 truncate max-w-full" title={category || 'Dekoratør'}>
                                                                                        {category && isDecoratorEvent(category) ? category : 'Dekoratør'}
                                                                                    </div>
                                                                                )}
                                                                                {isContent && (
                                                                                    <div className="inline-block px-1.5 py-0.5 rounded-sm bg-green-50 border border-green-100 text-[10px] uppercase tracking-wider font-bold text-green-700 mb-1 truncate max-w-full" title="Innholdsmeny">
                                                                                        Innholdsmeny
                                                                                    </div>
                                                                                )}
                                                                                {isInternalNav && !isContent && !isDecorator && (
                                                                                    <div className="inline-block px-1.5 py-0.5 rounded-sm bg-amber-100 border border-amber-300 text-[10px] uppercase tracking-wider font-bold text-amber-800 mb-1 truncate max-w-full" title="Utgang til annen side på nav.no">
                                                                                        Utgang intern
                                                                                    </div>
                                                                                )}
                                                                                {isExternalExit && !isContent && !isDecorator && (
                                                                                    <div className="inline-block px-1.5 py-0.5 rounded-sm bg-amber-100 border border-amber-300 text-[10px] uppercase tracking-wider font-bold text-amber-800 mb-1 truncate max-w-full" title="Utgang til ekstern nettside">
                                                                                        Utgang ekstern
                                                                                    </div>
                                                                                )}
                                                                            </div>

                                                                            <div className="absolute top-2 right-2">
                                                                                <button
                                                                                    onClick={(e) => toggleFunnelStep(e, eventName, stepNumber - 1, details)}
                                                                                    className={`
                                                                                w-6 h-6 rounded-full flex items-center justify-center transition-all z-20
                                                                                ${isFunnelStep
                                                                                            ? 'bg-green-500 text-white shadow-sm'
                                                                                            : 'bg-gray-100 text-gray-400 hover:bg-blue-100 hover:text-blue-600'
                                                                                        }
                                                                            `}
                                                                                    title={isFunnelStep ? "Fjern fra trakt" : "Legg til i trakt"}
                                                                                >
                                                                                    {isFunnelStep ? <Check size={14} strokeWidth={3} /> : <Plus size={14} strokeWidth={3} />}
                                                                                </button>
                                                                            </div>
                                                                        </div>

                                                                        <div className="font-semibold text-gray-900 text-sm mb-1 truncate pr-2" title={cardTitle}>
                                                                            {cardTitle}
                                                                        </div>
                                                                        {(cardLabel || cardSubtitle) && (
                                                                            <div className={`text-xs rounded px-2 py-1.5 break-words line-clamp-3 mb-1 ${isDecorator ? 'text-purple-900 bg-purple-50 border border-purple-100' :
                                                                                isContent ? 'text-green-900 bg-green-50 border border-green-100' :
                                                                                    isExternalExit ? 'text-amber-900 bg-amber-100 border border-amber-200' :
                                                                                        isInternalNav ? 'text-amber-900 bg-amber-100 border border-amber-200' :
                                                                                            'text-blue-800 bg-blue-50 border border-blue-100'
                                                                                }`}>
                                                                                {cardLabel && <div className="font-bold mb-0.5">{cardLabel}</div>}
                                                                                {cardSubtitle && <div className={cardLabel ? "opacity-90 italic text-[11px] leading-tight" : ""}>{cardSubtitle}</div>}
                                                                            </div>
                                                                        )}
                                                                        <div className="text-[11px] text-blue-600 font-medium mt-1 hover:underline cursor-pointer">
                                                                            Vis {details.length} detaljer
                                                                        </div>
                                                                    </div>
                                                                    <div className="absolute -top-2 -left-2 bg-gray-100 text-gray-600 text-[10px] font-bold px-1.5 py-0.5 rounded-full border shadow-sm z-10">
                                                                        {stepNumber}
                                                                    </div>
                                                                </div>
                                                            );
                                                        };

                                                        if (group.type === 'single') {
                                                            return (
                                                                <div key={groupIdx} className="flex items-center flex-shrink-0">
                                                                    {renderStepCard(group.step, group.originalIndex + 1)}
                                                                    {groupIdx < groups.length - 1 && (
                                                                        <div className="w-8 h-px bg-gray-300 mx-2"></div>
                                                                    )}
                                                                </div>
                                                            );
                                                        } else if (group.type === 'loop') {
                                                            // Loop group
                                                            const borderColor = group.hasExit ? 'border-amber-400' : 'border-blue-300';
                                                            const bgColor = group.hasExit ? 'bg-amber-50/30' : 'bg-blue-50/30';
                                                            const badgeBg = group.hasExit ? 'bg-amber-100 border-amber-300 text-amber-800' : 'bg-white border-blue-200 text-blue-700';
                                                            return (
                                                                <div key={groupIdx} className="flex items-center flex-shrink-0">
                                                                    <div className={`relative border-2 border-dashed ${borderColor} rounded-xl pt-7 pb-4 px-4 ${bgColor} min-w-[200px]`}>
                                                                        <div className={`absolute -top-3 left-3 px-2.5 py-1 text-sm font-bold ${badgeBg} border rounded-full shadow-sm flex items-center gap-1 z-20 whitespace-nowrap`}>
                                                                            <span className="text-lg leading-none">↻</span> Gjentatt {group.count}×
                                                                            {group.variations && group.variations.length > 0 && (
                                                                                <button
                                                                                    onClick={() => setLoopVariations({
                                                                                        title: group.pattern[0]?.split(': ')[0] || 'Loop',
                                                                                        allSteps: group.allSteps || []
                                                                                    })}
                                                                                    className="ml-1 pl-1.5 border-l border-current opacity-80 hover:opacity-100 transition-opacity whitespace-nowrap"
                                                                                >
                                                                                    · Vis varianter
                                                                                </button>
                                                                            )}
                                                                        </div>
                                                                        {/* Duplicate indicator for loops containing duplicates */}
                                                                        {group.hasDuplicateInPattern && (
                                                                            <div className="absolute -top-3 right-3 px-2 py-1 text-xs font-bold bg-orange-100 border border-orange-300 text-orange-800 rounded-full shadow-sm z-20" title="Inneholder mulige duplikate hendelser">
                                                                                Duplikat?
                                                                            </div>
                                                                        )}
                                                                        <div className="flex items-center gap-3 mt-2">
                                                                            {group.pattern.map((step: string, pIdx: number) => (
                                                                                <div key={pIdx} className="flex items-center">
                                                                                    {pIdx > 0 && <div className={`w-6 h-px ${group.hasExit ? 'bg-amber-300' : 'bg-blue-300'} mx-1`}></div>}
                                                                                    {renderStepCard(step, group.startIndex + pIdx + 1)}
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                    {groupIdx < groups.length - 1 && (
                                                                        <div className="w-8 h-px bg-gray-300 mx-2"></div>
                                                                    )}
                                                                </div>
                                                            );
                                                        } else {
                                                            // Duplicate group
                                                            return (
                                                                <div key={groupIdx} className="flex items-center flex-shrink-0">
                                                                    <div className="relative border-2 border-dashed border-orange-400 rounded-xl pt-7 pb-4 px-4 bg-orange-50/30 min-w-[150px]">
                                                                        <div className="absolute -top-3 left-3 px-2.5 py-1 text-sm font-bold bg-orange-100 border border-orange-300 text-orange-800 rounded-full shadow-sm flex items-center gap-1 z-20">
                                                                            Duplikat?
                                                                        </div>
                                                                        <div className="flex items-center gap-3 mt-2">
                                                                            {group.steps.map((step: string, pIdx: number) => (
                                                                                <div key={pIdx} className="flex items-center">
                                                                                    {pIdx > 0 && <div className="w-6 h-px bg-orange-300 mx-1"></div>}
                                                                                    {renderStepCard(step, group.startIndex + pIdx + 1, false)}
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                    {groupIdx < groups.length - 1 && (
                                                                        <div className="w-8 h-px bg-gray-300 mx-2"></div>
                                                                    )}
                                                                </div>
                                                            );
                                                        }
                                                    })}
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="text-center text-gray-500 py-8">
                                            Ingen reiser matcher søket ditt.
                                        </div>
                                    )}
                                </div>
                            </div>

                            <Modal
                                open={!!selectedStepDetails}
                                onClose={() => setSelectedStepDetails(null)}
                                header={{ heading: selectedStepDetails?.title || 'Detaljer' }}
                            >
                                <Modal.Body>
                                    <Table>
                                        <Table.Header>
                                            <Table.Row>
                                                <Table.HeaderCell>Egenskap</Table.HeaderCell>
                                                <Table.HeaderCell>Verdi</Table.HeaderCell>
                                            </Table.Row>
                                        </Table.Header>
                                        <Table.Body>
                                            {selectedStepDetails?.details && selectedStepDetails.details.length > 0 ? (
                                                selectedStepDetails.details.map((detail, i) => {
                                                    const [key, ...values] = detail.split(': ');
                                                    const value = values.join(': ');
                                                    return (
                                                        <Table.Row key={i}>
                                                            <Table.DataCell className="font-semibold capitalize text-gray-700 w-1/3">
                                                                {key}
                                                            </Table.DataCell>
                                                            <Table.DataCell className="break-all">
                                                                {value}
                                                            </Table.DataCell>
                                                        </Table.Row>
                                                    );
                                                })
                                            ) : (
                                                <Table.Row>
                                                    <Table.DataCell colSpan={2}>Ingen ytterligere detaljer tilgjengelig.</Table.DataCell>
                                                </Table.Row>
                                            )}
                                        </Table.Body>
                                    </Table>
                                </Modal.Body>
                                <Modal.Footer>
                                    <Button type="button" variant="primary" onClick={() => setSelectedStepDetails(null)}>
                                        Lukk
                                    </Button>
                                </Modal.Footer>
                            </Modal>

                            {/* Loop Variations Modal */}
                            <Modal
                                open={!!loopVariations}
                                onClose={() => setLoopVariations(null)}
                                header={{ heading: `Destinasjoner i ${loopVariations?.title || 'loop'}` }}
                            >
                                <Modal.Body>
                                    <Table>
                                        <Table.Header>
                                            <Table.Row>
                                                <Table.HeaderCell>#</Table.HeaderCell>
                                                <Table.HeaderCell>Destinasjon</Table.HeaderCell>
                                            </Table.Row>
                                        </Table.Header>
                                        <Table.Body>
                                            {loopVariations?.allSteps.map((step, idx) => {
                                                const parts = step.split(': ');
                                                const eventName = parts[0];
                                                const rawDetails = parts.length > 1 ? step.substring(eventName.length + 2) : '';
                                                const details = rawDetails.split('||').filter(Boolean);

                                                const detailMap: Record<string, string> = {};
                                                details.forEach(d => {
                                                    const [k, ...vals] = d.split(': ');
                                                    if (k) detailMap[k] = vals.join(': ');
                                                });

                                                const destinasjon = detailMap['destinasjon'] || '(ingen)';

                                                return (
                                                    <Table.Row key={idx}>
                                                        <Table.DataCell className="font-semibold w-12">{idx + 1}</Table.DataCell>
                                                        <Table.DataCell className="break-all">{destinasjon}</Table.DataCell>
                                                    </Table.Row>
                                                );
                                            })}
                                        </Table.Body>
                                    </Table>
                                </Modal.Body>
                                <Modal.Footer>
                                    <Button type="button" variant="primary" onClick={() => setLoopVariations(null)}>
                                        Lukk
                                    </Button>
                                </Modal.Footer>
                            </Modal>

                        </Tabs.Panel>

                        <Tabs.Panel value="table" className="pt-4">

                            <div className="border rounded-lg overflow-hidden mt-8">
                                <Heading level="3" size="small" className="p-4 bg-gray-50 border-b">Detaljert tabell</Heading>
                                <div className="overflow-x-auto">
                                    <Table>
                                        <Table.Header>
                                            <Table.Row>
                                                <Table.HeaderCell>Antall</Table.HeaderCell>
                                                <Table.HeaderCell>Andel</Table.HeaderCell>
                                                {Array.from({ length: getMaxSteps() }).map((_, i) => (
                                                    <Table.HeaderCell key={i}>Steg {i + 1}</Table.HeaderCell>
                                                ))}
                                            </Table.Row>
                                        </Table.Header>
                                        <Table.Body>
                                            {filteredData.map((journey, idx) => (
                                                <Table.Row key={idx}>
                                                    <Table.DataCell>{journey.count}</Table.DataCell>
                                                    <Table.DataCell>{((journey.count / data.reduce((a, b) => a + b.count, 0)) * 100).toFixed(1)}%</Table.DataCell>
                                                    {Array.from({ length: getMaxSteps() }).map((_, i) => {
                                                        const step = journey.path[i];
                                                        if (!step) return <Table.DataCell key={i}>-</Table.DataCell>;
                                                        const parts = step.split(': ');
                                                        return <Table.DataCell key={i}>{parts[0]}</Table.DataCell>;
                                                    })}
                                                </Table.Row>
                                            ))}
                                        </Table.Body>
                                    </Table>
                                </div>
                            </div>
                        </Tabs.Panel>
                    </Tabs>

                    {
                        dryRunStats && dryRunStats.totalBytesProcessedGB && (
                            <div className="text-sm text-gray-600 text-right mt-4">
                                Data prosessert: {Math.round(parseFloat(dryRunStats.totalBytesProcessedGB))} GB
                            </div>
                        )
                    }

                    {/* Floating Funnel Builder Action Bar */}
                    {
                        funnelSteps.length > 0 && (
                            <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 bg-gray-900 border border-gray-700 text-white px-8 py-5 rounded-full shadow-2xl z-50 flex items-center gap-8 animate-in fade-in slide-in-from-bottom-4">
                                <div className="flex flex-col">
                                    <span className="font-bold text-xl">{funnelSteps.length} hendelser valgt</span>
                                    <span className="text-sm text-gray-300">
                                        Startpunkt settes automatisk til {urlPath}
                                    </span>
                                </div>

                                <div className="flex items-center gap-4">
                                    <Button
                                        variant="tertiary"
                                        size="medium"
                                        onClick={() => setFunnelSteps([])}
                                        className="text-white hover:bg-white/10 hover:text-white"
                                        icon={<Trash2 size={16} />}
                                    >
                                        Tøm
                                    </Button>
                                    <Button
                                        variant="primary"
                                        size="medium"
                                        onClick={navigateToFunnel}
                                        icon={<ExternalLink size={20} />}
                                    >
                                        Opprett traktanalyse
                                    </Button>
                                </div>
                            </div>
                        )
                    }
                </>
            )}
        </ChartLayout >
    );
};

export default EventJourney;

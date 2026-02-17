import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Heading, TextField, Button, Alert, Loader, Tabs, Radio, RadioGroup, Select, UNSAFE_Combobox as Combobox, Modal } from '@navikt/ds-react';
import { Plus, Trash2, Download, Share2, Check, Code2, ExternalLink, ChevronLeft, ChevronRight } from 'lucide-react';
import { parseISO } from 'date-fns';
import ChartLayout from '../../components/analysis/ChartLayout';
import WebsitePicker from '../../components/analysis/WebsitePicker';
import PeriodPicker from '../../components/analysis/PeriodPicker';
import FunnelChart from '../../components/analysis/funnel/FunnelChart';
import HorizontalFunnelChart from '../../components/analysis/funnel/HorizontalFunnelChart';
import FunnelStats from '../../components/analysis/funnel/FunnelStats';
import SqlViewer from '../../components/chartbuilder/results/SqlViewer';
import AnalysisActionModal from '../../components/analysis/AnalysisActionModal';
import { normalizeUrlToPath, getDateRangeFromPeriod, getStoredPeriod, savePeriodPreference } from '../../lib/utils';
import { getGcpProjectId } from '../../lib/runtimeConfig';
import { Website } from '../../types/chart';

// Runtime config is resolved by getGcpProjectId.

type StepParam = { key: string; value: string; operator: 'equals' | 'contains' };
type FunnelStep = {
    type: 'url' | 'event';
    value: string;
    eventScope?: 'current-path' | 'anywhere';
    params?: StepParam[];
};

type QueryStats = {
    totalBytesProcessedGB?: string;
    totalBytesProcessed?: number;
};

type FunnelResultRow = {
    step: number;
    url: string;
    count: number;
    params?: StepParam[];
};

type TimingResultRow = {
    fromStep: number; // -1 for total row
    toStep: number;
    fromUrl?: string;
    toUrl?: string;
    avgSeconds: number | null;
    medianSeconds: number | null;
};

type FunnelApiResponse =
    | { error: string }
    | { data: Omit<FunnelResultRow, 'params'>[]; sql?: string; queryStats?: QueryStats };

type TimingApiResponse =
    | { error: string }
    | { data: TimingResultRow[]; sql?: string; queryStats?: QueryStats };

type EventsApiResponse = { events?: { name: string }[] };

const Funnel = () => {
    const [selectedWebsite, setSelectedWebsite] = useState<Website | null>(null);
    const [searchParams] = useSearchParams();
    const [isStepsOpen, setIsStepsOpen] = useState(true);

    // Initialize state from URL params
    const [steps, setSteps] = useState<FunnelStep[]>(() => {
        const stepParams = searchParams.getAll('step');
        if (stepParams.length === 0) return [{ type: 'url', value: '' }, { type: 'url', value: '' }];

        return stepParams.map(param => {
            if (param.startsWith('event:')) {
                // Format: event:name|scope|param:key=value|...
                const parts = param.split('|');
                const eventName = parts[0].substring(6);

                // Find scope (usually distinct values)
                let scope: 'current-path' | 'anywhere' = 'current-path';
                const params: StepParam[] = [];

                for (let i = 1; i < parts.length; i++) {
                    const part = parts[i];
                    if (part === 'current-path' || part === 'anywhere') {
                        scope = part;
                    } else if (part.startsWith('param:')) {
                        const [key, ...valParts] = part.substring(6).split('=');
                        const val = valParts.join('=');
                        if (key && val) {
                            // Default to equals, could infer contains if val has %
                            params.push({ key, value: val, operator: 'equals' });
                        }
                    }
                }

                return {
                    type: 'event',
                    value: eventName,
                    eventScope: scope,
                    params
                };
            }
            return { type: 'url', value: param };
        });
    });

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

    const [onlyDirectEntry, setOnlyDirectEntry] = useState<boolean>(() => {
        const param = searchParams.get('strict');
        return param === null ? true : param === 'true';
    });

    const [funnelData, setFunnelData] = useState<FunnelResultRow[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<string>('vertical');
    const [hasAttemptedFetch, setHasAttemptedFetch] = useState<boolean>(false);

    // Timing data state
    const [timingData, setTimingData] = useState<TimingResultRow[]>([]);
    const [timingLoading, setTimingLoading] = useState<boolean>(false);
    const [timingError, setTimingError] = useState<string | null>(null);
    const [showTiming, setShowTiming] = useState<boolean>(false);
    const [timingQueryStats, setTimingQueryStats] = useState<QueryStats | null>(null);
    const [timingSql, setTimingSql] = useState<string | null>(null);
    const [funnelSql, setFunnelSql] = useState<string | null>(null);
    const [funnelQueryStats, setFunnelQueryStats] = useState<QueryStats | null>(null);
    const [copySuccess, setCopySuccess] = useState<boolean>(false);
    const [metabaseCopySuccess, setMetabaseCopySuccess] = useState<boolean>(false);
    const [timingMetabaseCopySuccess, setTimingMetabaseCopySuccess] = useState<boolean>(false);
    const [hasAutoSubmitted, setHasAutoSubmitted] = useState<boolean>(false);
    const [modalSql, setModalSql] = useState<string | null>(null);
    const [selectedTableUrl, setSelectedTableUrl] = useState<string | null>(null);
    const [selectedTimingUrl, setSelectedTimingUrl] = useState<string | null>(null);

    // Custom events state
    const [availableEvents, setAvailableEvents] = useState<string[]>([]);
    const [loadingEvents, setLoadingEvents] = useState<boolean>(false);

    // Fetch available events when website changes
    useEffect(() => {
        const fetchEvents = async () => {
            if (!selectedWebsite) return;
            setLoadingEvents(true);
            try {
                const response = await fetch(
                    `/api/bigquery/websites/${selectedWebsite.id}/events?startAt=${Date.now() - 30 * 24 * 60 * 60 * 1000}`
                );
                if (response.ok) {
                    const data: EventsApiResponse = await response.json();
                    if (data.events) {
                        const eventNames = data.events
                            .map((e) => e.name)
                            .sort((a, b) => a.localeCompare(b));
                        setAvailableEvents(eventNames);
                    }
                }
            } finally {
                setLoadingEvents(false);
            }
        };

        fetchEvents();
    }, [selectedWebsite]);

    const fetchData = useCallback(async () => {
        if (!selectedWebsite) return;

        setHasAttemptedFetch(true);

        const normalizedSteps = steps
            .map(s => (s.type === 'url' ? { ...s, value: normalizeUrlToPath(s.value) } : s))
            .filter(s => s.value.trim() !== '');

        if (normalizedSteps.length < 2) {
            setError('Du må legge inn minst to gyldige steg.');
            return;
        }

        setLoading(true);
        setError(null);
        setFunnelData([]);
        setFunnelSql(null);

        const dateRange = getDateRangeFromPeriod(period, customStartDate, customEndDate);
        if (!dateRange) {
            setError('Vennligst velg en gyldig periode.');
            setLoading(false);
            return;
        }
        const { startDate, endDate } = dateRange;

        try {
            const response = await fetch('/api/bigquery/funnel', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    websiteId: selectedWebsite.id,
                    steps: normalizedSteps,
                    startDate: startDate.toISOString(),
                    endDate: endDate.toISOString(),
                    onlyDirectEntry
                }),
            });

            if (!response.ok) throw new Error('Kunne ikke hente traktdata');

            const data: FunnelApiResponse = await response.json();

            if ('error' in data) {
                setError(data.error);
                setFunnelData([]);
            } else {
                const mergedData: FunnelResultRow[] = data.data.map((item) => {
                    const stepConfig = normalizedSteps[item.step];
                    return {
                        ...item,
                        params: stepConfig?.params,
                    };
                });

                setFunnelData(mergedData);
                setFunnelQueryStats(data.queryStats ?? null);
                setFunnelSql(data.sql ?? null);

                // Update URL with funnel configuration for sharing
                const newParams = new URLSearchParams(window.location.search);
                newParams.set('period', period);
                newParams.set('strict', String(onlyDirectEntry));

                // Add steps
                newParams.delete('step');
                normalizedSteps.forEach(step => {
                    let paramValue: string;
                    if (step.type === 'event') {
                        paramValue = `event:${step.value}|${step.eventScope || 'current-path'}`;
                    } else {
                        paramValue = step.value;
                    }
                    newParams.append('step', paramValue);
                });

                // Update URL without navigation
                window.history.replaceState({}, '', `${window.location.pathname}?${newParams.toString()}`);
            }
        } catch {
            setError('Det oppstod en feil ved henting av data.');
            setFunnelData([]);
        } finally {
            setLoading(false);
        }
    }, [customEndDate, customStartDate, onlyDirectEntry, period, selectedWebsite, steps]);

    // Auto-submit when URL parameters are present (for shared links)
    useEffect(() => {
        // and at least 2 steps have meaningful values (not empty)
        const hasConfigParams = searchParams.has('period') || searchParams.has('strict') || searchParams.has('step');
        const stepsWithValues = steps.filter(s => s.value.trim() !== '').length;
        if (selectedWebsite && hasConfigParams && stepsWithValues >= 2 && !hasAutoSubmitted && !loading) {
            setHasAutoSubmitted(true);
            fetchData();
        }
    }, [fetchData, hasAutoSubmitted, loading, searchParams, selectedWebsite, steps]);

    // Reset timing data when configuration changes
    useEffect(() => {
        if (timingData.length > 0) {
            setTimingData([]);
            setShowTiming(false);
            setTimingQueryStats(null);
            setTimingError(null);
            setTimingSql(null);
        }
    }, [customEndDate, customStartDate, onlyDirectEntry, period, selectedWebsite, steps, timingData.length]);

    const copyShareLink = async () => {
        try {
            await navigator.clipboard.writeText(window.location.href);
            setCopySuccess(true);
            setTimeout(() => setCopySuccess(false), 2000);
        } catch (err) {
            console.error('Failed to copy link:', err);
        }
    };

    // Generate Metabase-compatible SQL for funnel visualization
    // Uses Metabase field filters for dynamic date selection
    const generateMetabaseFunnelSql = (): string => {
        if (!funnelData || funnelData.length === 0 || !selectedWebsite) return '';

        // Get the normalized steps from the current configuration
        const normalizedSteps = steps.map(s => {
            if (s.type === 'url') {
                return { ...s, value: normalizeUrlToPath(s.value) };
            }
            return s;
        }).filter(s => s.value.trim() !== '');

        if (normalizedSteps.length < 2) return '';

        // Determine which event types we need
        const neededEventTypes = new Set<number>();
        normalizedSteps.forEach(step => {
            if (step.type === 'url') neededEventTypes.add(1);
            if (step.type === 'event') neededEventTypes.add(2);
        });
        const eventTypesList = Array.from(neededEventTypes).join(', ');

        const projectId = getGcpProjectId();

        let sql = `-- Traktanalyse for Metabase
-- Bruk denne SQL-en i Metabase for å lage en traktgraf
-- Velg "Funnel" som visualiseringstype etter at du har kjørt spørringen
--
-- OPPSETT I METABASE:
-- 1. Klikk på "created_at" variabelen i høyre panel
-- 2. Sett variabeltype til "Field Filter"
-- 3. Koble til: umami_views.event → created_at
-- 4. Velg ønsket periode og kjør spørringen

WITH events_raw AS (
    SELECT
        session_id,
        event_type,
        CASE
            WHEN event_type = 1 THEN 
                COALESCE(NULLIF(RTRIM(REGEXP_REPLACE(REGEXP_REPLACE(url_path, r'[?#].*', ''), r'//+', '/'), '/'), ''), '/')
            WHEN event_type = 2 THEN event_name
            ELSE NULL
        END as step_value,
        event_id,
        created_at
    FROM \`${projectId}.umami_views.event\`
    WHERE website_id = '${selectedWebsite.id}'
      AND event_type IN (${eventTypesList})
      [[AND {{created_at}}]]
),
events AS (
    SELECT
        *,
        LAG(step_value) OVER (PARTITION BY session_id ORDER BY created_at) as prev_step_value
    FROM events_raw
),
`;

        // Generate CTEs for each step (simplified - no url_path tracking needed)
        const stepCtes = normalizedSteps.map((step, index) => {
            const stepName = `step${index + 1}`;
            const prevStepName = `step${index}`;

            let operator = '=';
            let value = step.value;
            if (value.includes('*')) {
                operator = 'LIKE';
                value = value.replace(/\*/g, '%');
            }
            const stepValue = value.replace(/'/g, "''");

            // Handle filters
            let paramFilters = '';
            if (step.type === 'event' && step.params && step.params.length > 0) {
                const conditions = step.params.map((p, pIdx) => {
                    const operator = p.operator === 'contains' ? 'LIKE' : '=';
                    const val = p.operator === 'contains' ? `%${p.value}%` : p.value;
                    const cleanVal = val.replace(/'/g, "''");

                    return `EXISTS (
        SELECT 1
        FROM \`${projectId}.umami_views.event_data\` d_${index}_${pIdx}
        CROSS JOIN UNNEST(d_${index}_${pIdx}.event_parameters) p_${index}_${pIdx}
        WHERE d_${index}_${pIdx}.website_event_id = e.event_id
          AND d_${index}_${pIdx}.website_id = '${selectedWebsite.id}'
          AND d_${index}_${pIdx}.created_at = e.created_at
          AND p_${index}_${pIdx}.data_key = '${p.key}'
          AND p_${index}_${pIdx}.string_value ${operator} '${cleanVal}'
    )`;
                });

                if (conditions.length > 0) {
                    paramFilters = '\n      AND ' + conditions.join('\n      AND ');
                }
            }

            if (index === 0) {
                return `${stepName} AS (
    SELECT session_id, MIN(created_at) as time${index + 1}
    FROM events e
    WHERE step_value ${operator} '${stepValue}'${paramFilters}
    GROUP BY session_id
)`;
            } else {
                let prevOperator = '=';
                let prevValue = normalizedSteps[index - 1].value;
                if (prevValue.includes('*')) {
                    prevOperator = 'LIKE';
                    prevValue = prevValue.replace(/\*/g, '%');
                }
                const prevStepValue = prevValue.replace(/'/g, "''");

                if (onlyDirectEntry) {
                    return `${stepName} AS (
    SELECT e.session_id, MIN(e.created_at) as time${index + 1}
    FROM events e
    JOIN ${prevStepName} prev ON e.session_id = prev.session_id
    WHERE e.step_value ${operator} '${stepValue}'
      AND e.created_at > prev.time${index}
      AND e.prev_step_value ${prevOperator} '${prevStepValue}'${paramFilters}
    GROUP BY e.session_id
)`;
                } else {
                    return `${stepName} AS (
    SELECT e.session_id, MIN(e.created_at) as time${index + 1}
    FROM events e
    JOIN ${prevStepName} prev ON e.session_id = prev.session_id
    WHERE e.step_value ${operator} '${stepValue}'
      AND e.created_at > prev.time${index}${paramFilters}
    GROUP BY e.session_id
)`;
                }
            }
        });

        sql += stepCtes.join(',\n');

        // Generate the final SELECT with step_number for ordering
        // Step labels similar to user's working example
        const unionSelects = normalizedSteps.map((step, i) => {
            const stepLabel = `${i + 1}: ${step.value}`.replace(/'/g, "''");
            return `SELECT ${i + 1} as step_number, '${stepLabel}' as step, (SELECT COUNT(*) FROM step${i + 1}) as count`;
        });

        sql += `\n${unionSelects.join('\nUNION ALL\n')}`;
        sql += `\nORDER BY step_number ASC`;

        return sql;
    };

    // Generate Metabase-compatible SQL for timing funnel
    const generateMetabaseTimingSql = (): string => {
        if (!timingData || timingData.length === 0 || !selectedWebsite) return '';

        // Get the normalized steps from the current configuration  
        const normalizedSteps = steps.map(s => {
            if (s.type === 'url') {
                return { ...s, value: normalizeUrlToPath(s.value) };
            }
            return s;
        }).filter(s => s.value.trim() !== '');

        // Only URL-based funnels support timing (no events)
        const urlSteps = normalizedSteps.filter(s => s.type === 'url');
        if (urlSteps.length < 2) return '';

        const projectId = getGcpProjectId();

        let sql = `-- Tidsbruk-analyse for Metabase
-- Viser median tid (i sekunder) mellom hvert steg i trakten
--
-- OPPSETT I METABASE:
-- 1. Klikk på "created_at" variabelen i høyre panel
-- 2. Sett variabeltype til "Field Filter"
-- 3. Koble til: umami_views.event → created_at
-- 4. Velg ønsket periode og kjør spørringen

WITH events_raw AS (
    SELECT 
        session_id,
        COALESCE(NULLIF(RTRIM(REGEXP_REPLACE(REGEXP_REPLACE(url_path, r'[?#].*', ''), r'//+', '/'), '/'), ''), '/') as url_path,
        created_at
    FROM \`${projectId}.umami_views.event\`
    WHERE website_id = '${selectedWebsite.id}'
      AND event_type = 1
      [[AND {{created_at}}]]
),
events AS (
    SELECT 
        *,
        LAG(url_path) OVER (PARTITION BY session_id ORDER BY created_at) as prev_url_path
    FROM events_raw
),
`;

        // Generate step CTEs
        const stepCtes = urlSteps.map((step, index) => {
            const stepName = `step${index + 1}`;
            const prevStepName = `step${index}`;

            let operator = '=';
            let value = step.value;
            if (value.includes('*')) {
                operator = 'LIKE';
                value = value.replace(/\*/g, '%');
            }
            const urlValue = value.replace(/'/g, "''");

            if (index === 0) {
                return `${stepName} AS (
    SELECT session_id, MIN(created_at) as time${index + 1}
    FROM events
    WHERE url_path ${operator} '${urlValue}'
    GROUP BY session_id
)`;
            } else {
                let prevOperator = '=';
                let prevValue = urlSteps[index - 1].value;
                if (prevValue.includes('*')) {
                    prevOperator = 'LIKE';
                    prevValue = prevValue.replace(/\*/g, '%');
                }
                const prevUrlValue = prevValue.replace(/'/g, "''");

                if (onlyDirectEntry) {
                    return `${stepName} AS (
    SELECT e.session_id, MIN(e.created_at) as time${index + 1}
    FROM events e
    JOIN ${prevStepName} prev ON e.session_id = prev.session_id
    WHERE e.url_path ${operator} '${urlValue}' 
      AND e.created_at > prev.time${index}
      AND e.prev_url_path ${prevOperator} '${prevUrlValue}'
    GROUP BY e.session_id
)`;
                } else {
                    return `${stepName} AS (
    SELECT e.session_id, MIN(e.created_at) as time${index + 1}
    FROM events e
    JOIN ${prevStepName} prev ON e.session_id = prev.session_id
    WHERE e.url_path ${operator} '${urlValue}' 
      AND e.created_at > prev.time${index}
    GROUP BY e.session_id
)`;
                }
            }
        });

        sql += stepCtes.join(',\n');

        // Join all steps and calculate timing
        const joinClauses = urlSteps.map((_, i) => {
            if (i === 0) return 'step1';
            return `LEFT JOIN step${i + 1} ON step1.session_id = step${i + 1}.session_id`;
        }).join('\n    ');

        const timeColumns = urlSteps.map((_, i) => `step${i + 1}.time${i + 1}`).join(', ');

        sql += `,
timing_data AS (
    SELECT 
        ${timeColumns}
    FROM ${joinClauses}
    WHERE step${urlSteps.length}.time${urlSteps.length} IS NOT NULL
)
`;

        // Generate timing results with UNION ALL - include step_number for proper ordering
        const timingSelects = urlSteps.slice(0, -1).map((_step, i) => {
            const fromStep = i + 1;
            const toStep = i + 2;
            const stepLabel = `Steg ${fromStep} → ${toStep}`;
            return `SELECT ${fromStep} as step_number, '${stepLabel}' as step, 
       APPROX_QUANTILES(TIMESTAMP_DIFF(time${toStep}, time${fromStep}, SECOND), 100)[OFFSET(50)] as sekunder
FROM timing_data`;
        });

        sql += timingSelects.join('\nUNION ALL\n');
        sql += '\nORDER BY step_number ASC';

        return sql;
    };

    const copyMetabaseSql = async () => {
        const sql = generateMetabaseFunnelSql();
        if (!sql) return;
        try {
            await navigator.clipboard.writeText(sql);
            setMetabaseCopySuccess(true);
            setTimeout(() => setMetabaseCopySuccess(false), 2000);
        } catch (err) {
            console.error('Failed to copy Metabase SQL:', err);
        }
    };

    const copyTimingMetabaseSql = async () => {
        const sql = generateMetabaseTimingSql();
        if (!sql) return;
        try {
            await navigator.clipboard.writeText(sql);
            setTimingMetabaseCopySuccess(true);
            setTimeout(() => setTimingMetabaseCopySuccess(false), 2000);
        } catch (err) {
            console.error('Failed to copy Metabase timing SQL:', err);
        }
    };

    const downloadCSV = () => {
        if (!funnelData || funnelData.length === 0) return;

        const headers = ['Steg', 'URL', 'Antall', 'Gikk videre (%)', 'Falt fra (%)'];
        const csvRows = [
            headers.join(','),
            ...funnelData.map((item, index) => {
                const nextItem = funnelData[index + 1];
                const percentageOfNext = nextItem && item.count > 0 ? Math.round((nextItem.count / item.count) * 100) : null;
                const dropoffPercentage = percentageOfNext !== null ? 100 - percentageOfNext : null;
                const escapeCSV = (val: unknown) => {
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
                    percentageOfNext !== null ? percentageOfNext : '-',
                    dropoffPercentage !== null ? dropoffPercentage : '-'
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
        setSteps([...steps, { type: 'url', value: '', eventScope: 'current-path' }]);
    };

    const removeStep = (index: number) => {
        if (steps.length <= 2) return; // Keep at least 2 steps
        const newSteps = steps.filter((_, i) => i !== index);
        setSteps(newSteps);
    };

    const updateStepValue = (index: number, value: string) => {
        const newSteps = [...steps];
        newSteps[index].value = value;
        setSteps(newSteps);
    };

    const updateStepType = (index: number, type: 'url' | 'event') => {
        const newSteps = [...steps];
        newSteps[index].type = type;
        // Clear value when switching types to avoid confusion
        newSteps[index].value = '';
        // Set default eventScope when switching to event type
        if (type === 'event') {
            newSteps[index].eventScope = index === 0 ? 'anywhere' : 'current-path';
        }
        setSteps(newSteps);
    };

    const updateStepEventScope = (index: number, scope: 'current-path' | 'anywhere') => {
        const newSteps = [...steps];
        newSteps[index].eventScope = scope;
        setSteps(newSteps);
    };

    const addStepParam = (index: number) => {
        const newSteps = [...steps];
        if (!newSteps[index].params) newSteps[index].params = [];
        newSteps[index].params?.push({ key: '', operator: 'equals', value: '' });
        setSteps(newSteps);
    };

    const removeStepParam = (index: number, pIndex: number) => {
        const newSteps = [...steps];
        if (newSteps[index].params) {
            newSteps[index].params = newSteps[index].params!.filter((_, i) => i !== pIndex);
        }
        setSteps(newSteps);
    };

    const updateStepParam = (index: number, pIndex: number, field: 'key' | 'value' | 'operator', val: string) => {
        const newSteps = [...steps];
        if (newSteps[index].params && newSteps[index].params![pIndex]) {
            if (field === 'operator') {
                // @ts-expect-error val is a string at runtime; constrain to allowed operators
                newSteps[index].params![pIndex][field] = val;
            } else {
                newSteps[index].params![pIndex][field] = val;
            }
        }
        setSteps(newSteps);
    };

    // Fetch data function removed as it is now defined earlier

    const fetchTimingData = async () => {
        if (!selectedWebsite || funnelData.length === 0) return;

        setTimingLoading(true);
        setTimingError(null);
        setTimingSql(null);

        // Calculate date range based on period using centralized utility
        const dateRange = getDateRangeFromPeriod(period, customStartDate, customEndDate);
        if (!dateRange) {
            setTimingError('Vennligst velg en gyldig periode.');
            setTimingLoading(false);
            return;
        }
        const { startDate, endDate } = dateRange;

        const normalizedSteps = steps.map(s => {
            if (s.type === 'url') {
                return { ...s, value: normalizeUrlToPath(s.value) };
            }
            return s;
        }).filter(s => s.value.trim() !== '');

        try {
            const response = await fetch('/api/bigquery/funnel-timing', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    websiteId: selectedWebsite.id,
                    steps: normalizedSteps,
                    startDate: startDate.toISOString(),
                    endDate: endDate.toISOString(),
                    onlyDirectEntry
                }),
            });

            if (!response.ok) throw new Error('Kunne ikke hente tidsdata');

            const data: TimingApiResponse = await response.json();

            if ('error' in data) {
                setTimingError(data.error);
                setTimingData([]);
                setTimingQueryStats(null);
                setTimingSql(null);
            } else {
                setTimingData(data.data);
                setTimingQueryStats(data.queryStats ?? null);
                setTimingSql(data.sql ?? null);
                setShowTiming(true);
            }
        } catch {
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
            title="Trakt"
            description="Se hvor folk faller fra i en prosess."
            currentPage="trakt"
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
                        legend="Flyt"
                        value={onlyDirectEntry ? 'strict' : 'loose'}
                        onChange={(val: string) => setOnlyDirectEntry(val === 'strict')}
                    >
                        <div className="flex gap-4">
                            <Radio value="strict">Direkte fra steg til steg</Radio>
                            <Radio value="loose">Tillat andre steg imellom</Radio>
                        </div>
                    </RadioGroup>
                </>
            }
        >
            <div className="flex flex-col xl:flex-row gap-8 items-start relative">
                {/* Left Column: Configuration */}
                {!isStepsOpen && (
                    <div className="hidden xl:block absolute left-0 top-0 z-10">
                        <button
                            onClick={() => setIsStepsOpen(true)}
                            className="flex items-center justify-center w-8 h-8 bg-[var(--ax-bg-default)] border border-[var(--ax-border-neutral-strong)] rounded-md shadow-sm hover:bg-[var(--ax-bg-neutral-soft)] transition-colors"
                            title="Vis steg"
                        >
                            <ChevronRight size={16} />
                        </button>
                    </div>
                )}

                {isStepsOpen && (
                    <div className="w-full xl:w-[450px] flex-shrink-0 space-y-6 relative group">
                        {/* Collapse Button */}
                        <button
                            onClick={() => setIsStepsOpen(false)}
                            className="hidden xl:flex absolute top-4 -right-4 translate-x-1/2 z-10 items-center justify-center w-8 h-8 bg-[var(--ax-bg-default)] border border-[var(--ax-border-neutral-strong)] rounded-full shadow-sm hover:bg-[var(--ax-bg-neutral-soft)] transition-colors"
                            title="Skjul steg"
                        >
                            <ChevronLeft size={16} />
                        </button>

                        <div className="bg-[var(--ax-bg-neutral-soft)] p-4 rounded-lg border border-[var(--ax-border-neutral-subtle)]">
                            <Heading level="2" size="small" style={{ marginBottom: '1.5rem' }}>Steg i trakten</Heading>
                            <div className="space-y-3">
                                {steps.map((step, index) => (
                                    <div key={index} className="border border-gray-300 rounded-lg p-3 bg-[var(--ax-bg-default)] relative shadow-sm">
                                        <div className="flex items-start gap-3">
                                            {/* Step number badge */}
                                            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs mt-1">
                                                {index + 1}
                                            </div>

                                            {/* Step content */}
                                            <div className="flex-grow space-y-3">
                                                {/* Type selector with label */}
                                                <Select
                                                    label={`Stegtype`}
                                                    size="small"
                                                    value={step.type}
                                                    onChange={(e) => updateStepType(index, e.target.value as 'url' | 'event')}
                                                >
                                                    <option value="url">URL-sti</option>
                                                    <option value="event">Hendelse</option>
                                                </Select>

                                                {/* Value input */}
                                                {step.type === 'url' ? (
                                                    <TextField
                                                        label={`URL-sti`}
                                                        value={step.value}
                                                        onChange={(e) => updateStepValue(index, e.target.value)}
                                                        onBlur={(e) => e.target.value.trim() && updateStepValue(index, normalizeUrlToPath(e.target.value))}
                                                        size="small"
                                                    />
                                                ) : (
                                                    <Combobox
                                                        label={`Hendelse`}
                                                        size="small"
                                                        options={availableEvents.map(e => ({ label: e, value: e }))}
                                                        selectedOptions={step.value ? [step.value] : []}
                                                        onToggleSelected={(option, isSelected) => {
                                                            if (isSelected) {
                                                                updateStepValue(index, option);
                                                            } else {
                                                                updateStepValue(index, '');
                                                            }
                                                        }}
                                                        isLoading={loadingEvents}
                                                        shouldAutocomplete
                                                        clearButton
                                                    />
                                                )}

                                                {/* Event scope options */}
                                                {step.type === 'event' && (
                                                    <RadioGroup
                                                        legend="Hendelsens plassering"
                                                        size="small"
                                                        value={step.eventScope || 'current-path'}
                                                        onChange={(val: string) => updateStepEventScope(index, val as 'current-path' | 'anywhere')}
                                                    >
                                                        <Radio value="current-path">På nåværende sti</Radio>
                                                        <Radio value="anywhere">Hvor som helst</Radio>
                                                    </RadioGroup>
                                                )}

                                                {/* Event Parameters (WHERE clause) */}
                                                {step.type === 'event' && (
                                                    <div className="mt-1">
                                                        <div className="text-sm font-semibold mb-2">Filtrer på hendelsesdetaljer</div>
                                                        {step.params && step.params.length > 0 && (
                                                            <div className="space-y-3 mb-3">
                                                                {step.params.map((param, pIndex) => (
                                                                    <div key={pIndex} className="bg-[var(--ax-bg-neutral-soft)] rounded-md p-3 relative group border border-[var(--ax-border-neutral-subtle)]">
                                                                        <Button
                                                                            variant="tertiary-neutral"
                                                                            size="small"
                                                                            icon={<Trash2 size={12} />}
                                                                            onClick={() => removeStepParam(index, pIndex)}
                                                                            title="Fjern filter"
                                                                            className="absolute top-2 right-2"
                                                                        />
                                                                        <div className="flex items-end gap-2 pr-8">
                                                                            <div className="flex-1">
                                                                                <TextField
                                                                                    label="Detalj"
                                                                                    size="small"
                                                                                    value={param.key}
                                                                                    onChange={(e) => updateStepParam(index, pIndex, 'key', e.target.value)}
                                                                                />
                                                                            </div>
                                                                            <div className="pb-1">
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => updateStepParam(index, pIndex, 'operator', param.operator === 'equals' ? 'contains' : 'equals')}
                                                                                    className="px-2 py-1.5 text-sm font-mono bg-[var(--ax-bg-default)] border border-gray-300 rounded hover:bg-[var(--ax-bg-neutral-soft)] transition-colors"
                                                                                    title={param.operator === 'equals' ? 'Eksakt match (klikk for inneholder)' : 'Inneholder (klikk for eksakt)'}
                                                                                >
                                                                                    {param.operator === 'equals' ? '=' : '≈'}
                                                                                </button>
                                                                            </div>
                                                                        </div>
                                                                        <div className="mt-2">
                                                                            <TextField
                                                                                label="Verdi"
                                                                                size="small"
                                                                                value={param.value}
                                                                                onChange={(e) => updateStepParam(index, pIndex, 'value', e.target.value)}
                                                                            />
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                        <Button
                                                            size="small"
                                                            variant="tertiary"
                                                            icon={<Plus size={14} />}
                                                            onClick={() => addStepParam(index)}
                                                        >
                                                            Legg til filter
                                                        </Button>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Delete button */}
                                            {steps.length > 2 && (
                                                <Button
                                                    variant="tertiary-neutral"
                                                    size="small"
                                                    icon={<Trash2 size={16} />}
                                                    onClick={() => removeStep(index)}
                                                    aria-label="Fjern steg"
                                                    className="flex-shrink-0 mt-1"
                                                />
                                            )}
                                        </div>

                                        {/* Connector line to next step */}
                                        {
                                            index < steps.length - 1 && (
                                                <div className="absolute left-[23px] top-[40px] w-0.5 h-[calc(100%-10px)] bg-gray-300 -bottom-3 translate-y-full z-0"
                                                    style={{ height: '24px' }} />
                                            )
                                        }
                                    </div>
                                ))}
                                <Button
                                    variant="secondary"
                                    size="small"
                                    icon={<Plus size={20} />}
                                    onClick={addStep}
                                    className="w-full mb-6"
                                >
                                    Legg til steg
                                </Button>
                            </div>

                            <Button
                                onClick={fetchData}
                                disabled={!selectedWebsite || loading || steps.filter(s => s.value.trim() !== '').length < 2}
                                loading={loading}
                                className="w-full"
                                style={{ marginTop: '2rem' }}
                            >
                                Lag trakt
                            </Button>
                        </div>
                    </div>
                )}

                {/* Right Column: Results */}
                <div className={`flex-1 min-w-0 w-full ${!isStepsOpen ? 'xl:pl-12' : ''} transition-all duration-300`}>
                    {error && (
                        <Alert variant="error" className="mb-4">
                            {error}
                        </Alert>
                    )}

                    {
                        loading && (
                            <div className="flex justify-center items-center h-64 border rounded-lg bg-[var(--ax-bg-neutral-soft)] border-dashed border-gray-300">
                                <Loader size="xlarge" title="Beregner trakt..." />
                            </div>
                        )
                    }

                    {
                        !loading && funnelData.length > 0 && (
                            <>
                                <FunnelStats data={funnelData} />
                                <div className="flex justify-between items-center mb-4 mt-8">
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
                                        {!steps.some(s => s.type === 'event') && (
                                            <Tabs.Tab value="timing" label="Tidsbruk" />
                                        )}
                                    </Tabs.List>

                                    <Tabs.Panel value="vertical" className="pt-4">
                                        <FunnelChart
                                            data={funnelData}
                                            loading={loading}
                                            websiteId={selectedWebsite?.id}
                                            period={period}
                                        />
                                        <div className="flex gap-2 justify-between items-center mt-4">
                                            {funnelQueryStats && (
                                                <span className="text-sm text-[var(--ax-text-subtle)] mr-auto">
                                                    Data prosessert: {funnelQueryStats.totalBytesProcessedGB} GB
                                                </span>
                                            )}
                                            <Button
                                                size="small"
                                                variant="tertiary"
                                                onClick={copyMetabaseSql}
                                                icon={metabaseCopySuccess ? <Check size={16} /> : <Code2 size={16} />}
                                            >
                                                {metabaseCopySuccess ? 'Kopiert!' : 'Kopier for Metabase'}
                                            </Button>
                                            {funnelSql && (
                                                <Button
                                                    size="small"
                                                    variant="tertiary"
                                                    onClick={() => setModalSql(funnelSql)}
                                                    icon={<Code2 size={16} />}
                                                >
                                                    Vis SQL
                                                </Button>
                                            )}
                                        </div>
                                    </Tabs.Panel>

                                    <Tabs.Panel value="horizontal" className="pt-4">
                                        <HorizontalFunnelChart
                                            data={funnelData}
                                            loading={loading}
                                            websiteId={selectedWebsite?.id}
                                            period={period}
                                        />
                                        <div className="flex gap-2 justify-between items-center mt-4">
                                            {funnelQueryStats && (
                                                <span className="text-sm text-[var(--ax-text-subtle)] mr-auto">
                                                    Data prosessert: {funnelQueryStats.totalBytesProcessedGB} GB
                                                </span>
                                            )}
                                            <Button
                                                size="small"
                                                variant="tertiary"
                                                onClick={copyMetabaseSql}
                                                icon={metabaseCopySuccess ? <Check size={16} /> : <Code2 size={16} />}
                                            >
                                                {metabaseCopySuccess ? 'Kopiert!' : 'Kopier for Metabase'}
                                            </Button>
                                            {funnelSql && (
                                                <Button
                                                    size="small"
                                                    variant="tertiary"
                                                    onClick={() => setModalSql(funnelSql)}
                                                    icon={<Code2 size={16} />}
                                                >
                                                    Vis SQL
                                                </Button>
                                            )}
                                        </div>
                                    </Tabs.Panel>

                                    <Tabs.Panel value="table" className="pt-4">
                                        <div className="border rounded-lg overflow-hidden">
                                            <div className="overflow-x-auto">
                                                <table className="min-w-full divide-y divide-[var(--ax-border-neutral-subtle)]">
                                                    <thead className="bg-[var(--ax-bg-neutral-soft)]">
                                                        <tr>
                                                            <th className="px-6 py-3 text-left text-xs font-medium text-[var(--ax-text-default)] uppercase tracking-wider">Steg</th>
                                                            <th className="px-6 py-3 text-left text-xs font-medium text-[var(--ax-text-default)] uppercase tracking-wider">URL</th>
                                                            <th className="px-6 py-3 text-left text-xs font-medium text-[var(--ax-text-default)] uppercase tracking-wider">Antall</th>
                                                            <th className="px-6 py-3 text-left text-xs font-medium text-[var(--ax-text-default)] uppercase tracking-wider">Gikk videre</th>
                                                            <th className="px-6 py-3 text-left text-xs font-medium text-[var(--ax-text-default)] uppercase tracking-wider">Falt fra</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="bg-[var(--ax-bg-default)] divide-y divide-[var(--ax-border-neutral-subtle)]">
                                                        {funnelData.map((item, index) => {
                                                            const nextItem = funnelData[index + 1];
                                                            const percentageOfNext = nextItem && item.count > 0 ? Math.round((nextItem.count / item.count) * 100) : null;
                                                            const dropoffCount = nextItem ? item.count - nextItem.count : null;
                                                            const dropoffPercentage = percentageOfNext !== null ? 100 - percentageOfNext : null;

                                                            return (
                                                                <tr key={index} className="hover:bg-[var(--ax-bg-neutral-soft)]">
                                                                    <td className="px-6 py-4 whitespace-nowrap text-base font-medium text-[var(--ax-text-default)]">
                                                                        Steg {item.step + 1}
                                                                    </td>
                                                                    <td className="px-6 py-4 text-base break-all">
                                                                        {(() => {
                                                                            const step = steps[index];
                                                                            if (step?.type === 'event') {
                                                                                const lenketekst = step.params?.find(p => p.key.toLowerCase() === 'lenketekst')?.value;
                                                                                const destinasjon = step.params?.find(p => p.key === 'destinasjon' || p.key === 'url')?.value;
                                                                                const tekst = step.params?.find(p => p.key.toLowerCase() === 'tekst')?.value;

                                                                                return (
                                                                                    <div className="flex flex-col gap-1">
                                                                                        <div className="font-semibold text-[var(--ax-text-default)]">{step.value}</div>
                                                                                        {(lenketekst || tekst) && (
                                                                                            <div className="text-sm font-medium text-[var(--ax-text-default)]">
                                                                                                {lenketekst || tekst}
                                                                                            </div>
                                                                                        )}
                                                                                        {destinasjon && (
                                                                                            <div className="text-xs text-gray-500 break-all bg-[var(--ax-bg-neutral-soft)] px-1 py-0.5 rounded border border-gray-100 italic">
                                                                                                {destinasjon}
                                                                                            </div>
                                                                                        )}
                                                                                    </div>
                                                                                );
                                                                            }

                                                                            if (item.url && selectedWebsite) {
                                                                                return (
                                                                                    <span
                                                                                        className="text-blue-600 hover:underline cursor-pointer flex items-center gap-1"
                                                                                        onClick={() => setSelectedTableUrl(item.url)}
                                                                                    >
                                                                                        {item.url} <ExternalLink className="h-4 w-4" />
                                                                                    </span>
                                                                                );
                                                                            }
                                                                            return <span className="text-gray-500">{item.url}</span>;
                                                                        })()}
                                                                    </td>
                                                                    <td className="px-6 py-4 whitespace-nowrap text-base text-[var(--ax-text-default)] font-bold">
                                                                        {item.count.toLocaleString('nb-NO')}
                                                                    </td>
                                                                    <td className="px-6 py-4 whitespace-nowrap text-base">
                                                                        {percentageOfNext !== null ? (
                                                                            <span className="text-green-700 font-medium">{percentageOfNext}%</span>
                                                                        ) : (
                                                                            <span className="text-[var(--ax-text-subtle)] font-medium">Fullført ✓</span>
                                                                        )}
                                                                    </td>
                                                                    <td className="px-6 py-4 whitespace-nowrap text-base">
                                                                        {dropoffCount !== null && dropoffCount > 0 ? (
                                                                            <span className="text-red-700 font-medium">
                                                                                {dropoffPercentage}% <span className="font-normal">(-{dropoffCount.toLocaleString('nb-NO')})</span>
                                                                            </span>
                                                                        ) : '-'}
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>
                                            </div>
                                            <div className="flex gap-2 p-3 bg-[var(--ax-bg-neutral-soft)] border-t justify-between items-center">
                                                <Button
                                                    size="small"
                                                    variant="secondary"
                                                    onClick={downloadCSV}
                                                    icon={<Download size={16} />}
                                                >
                                                    Last ned CSV
                                                </Button>
                                                {funnelQueryStats && (
                                                    <span className="text-sm text-[var(--ax-text-subtle)] mr-auto">
                                                        Data prosessert: {funnelQueryStats.totalBytesProcessedGB} GB
                                                    </span>
                                                )}
                                                <Button
                                                    size="small"
                                                    variant="tertiary"
                                                    onClick={copyMetabaseSql}
                                                    icon={metabaseCopySuccess ? <Check size={16} /> : <Code2 size={16} />}
                                                >
                                                    {metabaseCopySuccess ? 'Kopiert!' : 'Kopier for Metabase'}
                                                </Button>
                                                {funnelSql && (
                                                    <Button
                                                        size="small"
                                                        variant="tertiary"
                                                        onClick={() => setModalSql(funnelSql)}
                                                        icon={<Code2 size={16} />}
                                                    >
                                                        Vis SQL
                                                    </Button>
                                                )}
                                            </div>
                                        </div>

                                        <AnalysisActionModal
                                            open={!!selectedTableUrl}
                                            onClose={() => setSelectedTableUrl(null)}
                                            urlPath={selectedTableUrl}
                                            websiteId={selectedWebsite?.id}
                                            period={period}
                                        />
                                    </Tabs.Panel>

                                    {/* Timing Data Tab */}
                                    {!steps.some(s => s.type === 'event') && (
                                        <Tabs.Panel value="timing" className="pt-4">
                                            <Heading level="3" size="small" className="mb-3">
                                                Tid per steg og for hele trakten
                                            </Heading>

                                            {!showTiming && (
                                                <div className="space-y-2">
                                                    <Button
                                                        variant="secondary"
                                                        onClick={fetchTimingData}
                                                        loading={timingLoading}
                                                        disabled={timingLoading}
                                                    >
                                                        Beregn tidsbruk
                                                    </Button>
                                                    <p className="text-sm text-gray-500">
                                                        Kan ta opptil 30 sekunder.
                                                    </p>
                                                </div>
                                            )}

                                            {timingError && (
                                                <Alert variant="error" className="mb-4">
                                                    {timingError}
                                                </Alert>
                                            )}

                                            {showTiming && !timingError && timingData.length > 0 && (() => {
                                                const totalTiming = timingData.find(t => t.fromStep === -1);
                                                const stepsTiming = timingData.filter(t => t.fromStep !== -1);

                                                return (
                                                    <>
                                                        {totalTiming && (
                                                            <div className="grid grid-cols-2 gap-4 mb-6">
                                                                <div className="border rounded-lg p-4 bg-blue-50 border-blue-100">
                                                                    <div className="text-sm text-blue-800 font-medium mb-1">Total tid (Gjennomsnitt)</div>
                                                                    <div className="text-2xl font-bold text-blue-900">{formatDuration(totalTiming.avgSeconds)}</div>
                                                                    <div className="text-xs text-blue-600 mt-1">Gjennomsnittlig tid fra første til siste steg.</div>
                                                                </div>
                                                                <div className="border rounded-lg p-4 bg-green-50 border-green-100">
                                                                    <div className="text-sm text-green-800 font-medium mb-1">Total tid (Median)</div>
                                                                    <div className="text-2xl font-bold text-green-900">{formatDuration(totalTiming.medianSeconds)}</div>
                                                                    <div className="text-xs text-green-600 mt-1">Median tid fra første til siste steg.</div>
                                                                </div>
                                                            </div>
                                                        )}

                                                        <div className="border rounded-lg overflow-hidden mb-3">
                                                            <div className="overflow-x-auto">
                                                                <table className="min-w-full divide-y divide-[var(--ax-border-neutral-subtle)]">
                                                                    <thead className="bg-[var(--ax-bg-neutral-soft)]">
                                                                        <tr>
                                                                            <th className="px-6 py-3 text-left text-xs font-medium text-[var(--ax-text-default)] uppercase tracking-wider">Fra steg</th>
                                                                            <th className="px-6 py-3 text-left text-xs font-medium text-[var(--ax-text-default)] uppercase tracking-wider">Til steg</th>
                                                                            <th className="px-6 py-3 text-left text-xs font-medium text-[var(--ax-text-default)] uppercase tracking-wider">Gjennomsnitt</th>
                                                                            <th className="px-6 py-3 text-left text-xs font-medium text-[var(--ax-text-default)] uppercase tracking-wider">Median</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody className="bg-[var(--ax-bg-default)] divide-y divide-[var(--ax-border-neutral-subtle)]">
                                                                        {stepsTiming.map((timing, index) => (
                                                                            <tr key={index} className="hover:bg-[var(--ax-bg-neutral-soft)]">
                                                                                <td className="px-6 py-4 text-base text-[var(--ax-text-default)]">
                                                                                    <div className="flex flex-col gap-0.5">
                                                                                        <span className="font-medium">Steg {timing.fromStep + 1}</span>
                                                                                        {timing.fromUrl && selectedWebsite ? (
                                                                                            <span
                                                                                                className="text-base text-blue-600 hover:underline cursor-pointer break-all flex items-center gap-1"
                                                                                                onClick={() => setSelectedTimingUrl(timing.fromUrl || null)}
                                                                                            >
                                                                                                {timing.fromUrl} <ExternalLink className="h-4 w-4 flex-shrink-0" />
                                                                                            </span>
                                                                                        ) : (
                                                                                            <span className="text-base text-gray-500 break-all">{timing.fromUrl}</span>
                                                                                        )}
                                                                                    </div>
                                                                                </td>
                                                                                <td className="px-6 py-4 text-base text-[var(--ax-text-default)]">
                                                                                    <div className="flex flex-col gap-0.5">
                                                                                        <span className="font-medium">Steg {timing.toStep + 1}</span>
                                                                                        {timing.toUrl && selectedWebsite ? (
                                                                                            <span
                                                                                                className="text-base text-blue-600 hover:underline cursor-pointer break-all flex items-center gap-1"
                                                                                                onClick={() => setSelectedTimingUrl(timing.toUrl || null)}
                                                                                            >
                                                                                                {timing.toUrl} <ExternalLink className="h-4 w-4 flex-shrink-0" />
                                                                                            </span>
                                                                                        ) : (
                                                                                            <span className="text-base text-gray-500 break-all">{timing.toUrl}</span>
                                                                                        )}
                                                                                    </div>
                                                                                </td>
                                                                                <td className="px-6 py-4 text-lg font-bold text-blue-700">
                                                                                    {formatDuration(timing.avgSeconds)}
                                                                                </td>
                                                                                <td className="px-6 py-4 text-lg font-bold text-green-700">
                                                                                    {formatDuration(timing.medianSeconds)}
                                                                                </td>
                                                                            </tr>
                                                                        ))}
                                                                    </tbody>
                                                                </table>
                                                            </div>
                                                            {/* Footer inside the table container to match styling */}
                                                            <div className="p-3 bg-[var(--ax-bg-neutral-soft)] border-t flex justify-between items-center">
                                                                <div>
                                                                    {timingQueryStats && (
                                                                        <span className="text-sm text-[var(--ax-text-subtle]">
                                                                            Data prosessert: {timingQueryStats.totalBytesProcessedGB} GB
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <Button
                                                                    size="small"
                                                                    variant="tertiary"
                                                                    onClick={copyTimingMetabaseSql}
                                                                    icon={timingMetabaseCopySuccess ? <Check size={16} /> : <Code2 size={16} />}
                                                                >
                                                                    {timingMetabaseCopySuccess ? 'Kopiert!' : 'Kopier for Metabase'}
                                                                </Button>
                                                                {timingSql && (
                                                                    <Button
                                                                        size="small"
                                                                        variant="tertiary"
                                                                        onClick={() => setModalSql(timingSql)}
                                                                        icon={<Code2 size={16} />}
                                                                    >
                                                                        Vis SQL
                                                                    </Button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </>
                                                );
                                            })()}

                                            <AnalysisActionModal
                                                open={!!selectedTimingUrl}
                                                onClose={() => setSelectedTimingUrl(null)}
                                                urlPath={selectedTimingUrl}
                                                websiteId={selectedWebsite?.id}
                                                period={period}
                                            />
                                        </Tabs.Panel>
                                    )}
                                </Tabs>
                            </>
                        )
                    }

                    {
                        !loading && !error && funnelData.length === 0 && hasAttemptedFetch && (
                            <div className="text-center p-8 text-gray-500 bg-[var(--ax-bg-neutral-soft)] rounded-lg border border-[var(--ax-border-neutral-subtle)] mt-4">
                                Ingen data funnet for denne trakten i valgt periode.
                            </div>
                        )
                    }

                    <Modal
                        open={!!modalSql}
                        onClose={() => setModalSql(null)}
                        header={{ heading: 'SQL-spørring' }}
                        width={800}
                    >
                        <Modal.Body>
                            {modalSql && <SqlViewer sql={modalSql} withoutReadMore showEditButton />}
                        </Modal.Body>
                    </Modal>
                </div>
            </div>
        </ChartLayout >
    );
};

export default Funnel;

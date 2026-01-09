import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Heading, TextField, Button, Alert, Loader, Tabs, Radio, RadioGroup, Select, UNSAFE_Combobox as Combobox, Modal } from '@navikt/ds-react';
import { Plus, Trash2, Download, Share2, Check, Code2, ExternalLink } from 'lucide-react';
import ChartLayout from '../components/ChartLayout';
import WebsitePicker from '../components/WebsitePicker';
import PeriodPicker from '../components/PeriodPicker';
import FunnelChart from '../components/FunnelChart';
import HorizontalFunnelChart from '../components/HorizontalFunnelChart';
import FunnelStats from '../components/FunnelStats';
import SqlCodeDisplay from '../components/chartbuilder/SqlCodeDisplay';
import AnalysisActionModal from '../components/AnalysisActionModal';
import { Website } from '../types/chart';


const Funnel = () => {
    const [selectedWebsite, setSelectedWebsite] = useState<Website | null>(null);
    const [searchParams] = useSearchParams();

    // Initialize state from URL params
    const [steps, setSteps] = useState<{ type: 'url' | 'event', value: string, eventScope?: 'current-path' | 'anywhere' }[]>(() => {
        const stepParams = searchParams.getAll('step');
        if (stepParams.length === 0) return [{ type: 'url', value: '' }, { type: 'url', value: '' }];

        return stepParams.map(param => {
            if (param.startsWith('event:')) {
                const eventParts = param.substring(6).split('|');
                return {
                    type: 'event',
                    value: eventParts[0],
                    eventScope: (eventParts[1] as 'current-path' | 'anywhere') || 'current-path'
                };
            }
            return { type: 'url', value: param };
        });
    });

    const [period, setPeriod] = useState<string>(() => searchParams.get('period') || 'current_month');
    const [customStartDate, setCustomStartDate] = useState<Date | undefined>(undefined);
    const [customEndDate, setCustomEndDate] = useState<Date | undefined>(undefined);

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
    const [timingSql, setTimingSql] = useState<string | null>(null);
    const [funnelSql, setFunnelSql] = useState<string | null>(null);
    const [funnelQueryStats, setFunnelQueryStats] = useState<any>(null);
    const [copySuccess, setCopySuccess] = useState<boolean>(false);
    const [metabaseCopySuccess, setMetabaseCopySuccess] = useState<boolean>(false);
    const [timingMetabaseCopySuccess, setTimingMetabaseCopySuccess] = useState<boolean>(false);
    const [hasAutoSubmitted, setHasAutoSubmitted] = useState<boolean>(false);
    const [modalSql, setModalSql] = useState<string | null>(null);
    const [selectedTableUrl, setSelectedTableUrl] = useState<string | null>(null);

    // Custom events state
    const [availableEvents, setAvailableEvents] = useState<string[]>([]);
    const [loadingEvents, setLoadingEvents] = useState<boolean>(false);

    // Fetch available events when website changes
    useEffect(() => {
        const fetchEvents = async () => {
            if (!selectedWebsite) return;
            setLoadingEvents(true);
            try {
                // Fetch events from the last 30 days to populate the list
                const response = await fetch(`/api/bigquery/websites/${selectedWebsite.id}/events?startAt=${Date.now() - 30 * 24 * 60 * 60 * 1000}`);
                if (response.ok) {
                    const data = await response.json();
                    if (data.events) {
                        const eventNames = data.events.map((e: any) => e.name).sort((a: string, b: string) => a.localeCompare(b));
                        setAvailableEvents(eventNames);
                    }
                }
            } catch (err) {
                console.error('Failed to fetch events', err);
            } finally {
                setLoadingEvents(false);
            }
        };

        fetchEvents();
    }, [selectedWebsite]);

    // Auto-submit when URL parameters are present (for shared links)
    useEffect(() => {
        // Only auto-submit if there are config params beyond just websiteId
        const hasConfigParams = searchParams.has('period') || searchParams.has('strict') || searchParams.has('step');
        if (selectedWebsite && hasConfigParams && !hasAutoSubmitted && !loading) {
            setHasAutoSubmitted(true);
            fetchData();
        }
    }, [selectedWebsite]);

    // Reset timing data when configuration changes
    useEffect(() => {
        if (timingData.length > 0) {
            setTimingData([]);
            setShowTiming(false);
            setTimingQueryStats(null);
            setTimingError(null);
            setTimingSql(null);
        }
    }, [steps, period, customStartDate, customEndDate, onlyDirectEntry, selectedWebsite]);

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

        // Build the base CTE - using field filter after event_type clause
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
        created_at
    FROM \`team-researchops-prod-01d6.umami_views.event\`
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

            if (index === 0) {
                return `${stepName} AS (
    SELECT session_id, MIN(created_at) as time${index + 1}
    FROM events
    WHERE step_value ${operator} '${stepValue}'
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
      AND e.prev_step_value ${prevOperator} '${prevStepValue}'
    GROUP BY e.session_id
)`;
                } else {
                    return `${stepName} AS (
    SELECT e.session_id, MIN(e.created_at) as time${index + 1}
    FROM events e
    JOIN ${prevStepName} prev ON e.session_id = prev.session_id
    WHERE e.step_value ${operator} '${stepValue}'
      AND e.created_at > prev.time${index}
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
    FROM \`team-researchops-prod-01d6.umami_views.event\`
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
            newSteps[index].eventScope = 'current-path';
        }
        setSteps(newSteps);
    };

    const updateStepEventScope = (index: number, scope: 'current-path' | 'anywhere') => {
        const newSteps = [...steps];
        newSteps[index].eventScope = scope;
        setSteps(newSteps);
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

        // Validate Steps
        // For URLs, normalize them. For Events, keep as is.
        const normalizedSteps = steps.map(s => {
            if (s.type === 'url') {
                return { ...s, value: normalizeUrlToPath(s.value) };
            }
            return s;
        }).filter(s => s.value.trim() !== '');

        if (normalizedSteps.length < 2) {
            setError('Du må legge inn minst to gyldige steg.');
            return;
        }

        setLoading(true);
        setError(null);
        setFunnelData([]);
        setFunnelSql(null);

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
            const response = await fetch('/api/bigquery/funnel', {
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
                setFunnelSql(data.sql);

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
        setTimingSql(null);

        // Calculate date range based on period (same as main funnel query)
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
                setTimingError('Vennligst velg en gyldig periode.');
                setTimingLoading(false);
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

            if (!response.ok) {
                throw new Error('Kunne ikke hente tidsdata');
            }

            const data = await response.json();

            if (data.error) {
                setTimingError(data.error);
                setTimingData([]);
                setTimingQueryStats(null);
                setTimingSql(null);
            } else {
                setTimingData(data.data);
                setTimingQueryStats(data.queryStats);
                setTimingSql(data.sql);
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
                        <Radio value="strict">Direkte fra steg til steg</Radio>
                        <Radio value="loose">Tillat andre steg imellom</Radio>
                    </RadioGroup>

                    <div className="pt-2 space-y-3">
                        <Heading level="3" size="xsmall">Steg i trakten</Heading>
                        {steps.map((step, index) => (
                            <div key={index} className="border border-gray-300 rounded-lg p-3 bg-white relative">
                                <div className="flex items-start gap-3">
                                    {/* Step number badge */}
                                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm">
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
                                            className="max-w-[140px]"
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
                                                onBlur={(e) => updateStepValue(index, normalizeUrlToPath(e.target.value))}
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
                                        {step.type === 'event' && index > 0 && (
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
                                    </div>

                                    {/* Delete button */}
                                    {steps.length > 2 && (
                                        <Button
                                            variant="tertiary-neutral"
                                            size="small"
                                            icon={<Trash2 size={18} />}
                                            onClick={() => removeStep(index)}
                                            aria-label="Fjern steg"
                                            className="flex-shrink-0"
                                        />
                                    )}
                                </div>

                                {/* Connector line to next step */}
                                {index < steps.length - 1 && (
                                    <div className="absolute left-[19px] top-[36px] w-0.5 h-[calc(100%-28px)] bg-gray-300 -bottom-3 translate-y-full"
                                        style={{ height: '12px' }} />
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
                                    <span className="text-sm text-gray-600 mr-auto">
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
                                    <span className="text-sm text-gray-600 mr-auto">
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
                                                const nextItem = funnelData[index + 1];
                                                const percentageOfNext = nextItem && item.count > 0 ? Math.round((nextItem.count / item.count) * 100) : null;
                                                const dropoffCount = nextItem ? item.count - nextItem.count : null;
                                                const dropoffPercentage = percentageOfNext !== null ? 100 - percentageOfNext : null;

                                                return (
                                                    <tr key={index} className="hover:bg-gray-50">
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                                            Steg {item.step + 1}
                                                        </td>
                                                        <td className="px-6 py-4 text-sm break-all">
                                                            {item.url && selectedWebsite ? (
                                                                <span
                                                                    className="text-blue-600 hover:underline cursor-pointer flex items-center gap-1"
                                                                    onClick={() => setSelectedTableUrl(item.url)}
                                                                >
                                                                    {item.url} <ExternalLink className="h-3 w-3" />
                                                                </span>
                                                            ) : (
                                                                <span className="text-gray-500">{item.url}</span>
                                                            )}
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-bold">
                                                            {item.count.toLocaleString('nb-NO')}
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                            {percentageOfNext !== null ? (
                                                                <span className="text-green-600 font-medium">{percentageOfNext}%</span>
                                                            ) : (
                                                                <span className="text-gray-400">Avgjort</span>
                                                            )}
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                            {dropoffCount !== null && dropoffCount > 0 ? (
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
                                        <span className="text-sm text-gray-600 mr-auto">
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
                                                            {stepsTiming.map((timing, index) => (
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
                                                {/* Footer inside the table container to match styling */}
                                                <div className="p-3 bg-gray-50 border-t flex justify-between items-center">
                                                    <div>
                                                        {timingQueryStats && (
                                                            <span className="text-sm text-gray-600">
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
                            </Tabs.Panel>
                        )}
                    </Tabs>
                </>
            )}

            {!loading && !error && funnelData.length === 0 && hasAttemptedFetch && (
                <div className="text-center p-8 text-gray-500 bg-gray-50 rounded-lg border border-gray-200 mt-4">
                    Ingen data funnet for denne trakten i valgt periode.
                </div>
            )}

            <Modal
                open={!!modalSql}
                onClose={() => setModalSql(null)}
                header={{ heading: 'SQL-spørring' }}
                width={800}
            >
                <Modal.Body>
                    {modalSql && <SqlCodeDisplay sql={modalSql} withoutReadMore showEditButton />}
                </Modal.Body>
            </Modal>
        </ChartLayout>
    );
};

export default Funnel;

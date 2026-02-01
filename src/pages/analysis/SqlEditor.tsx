import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { subDays, format } from 'date-fns';
import ResultsPanel from '../../components/chartbuilder/results/ResultsPanel';
import ChartLayout from '../../components/analysis/ChartLayoutOriginal';
import { Button, Alert, Heading, BodyLong, TextField, Link } from '@navikt/ds-react';
import Editor from '@monaco-editor/react';
import * as sqlFormatter from 'sql-formatter';
import { PlayIcon, Copy, X } from 'lucide-react';
import { ReadMore } from '@navikt/ds-react';
import { translateValue } from '../../lib/translations';
import WebsitePicker from '../../components/analysis/WebsitePicker';
import PeriodPicker from '../../components/analysis/PeriodPicker';

type Website = {
    id: string;
    name: string;
    domain: string;
    teamId: string;
    createdAt: string;
};

const defaultQuery = `SELECT 
  website_id,
  name
FROM 
  \`team-researchops-prod-01d6.umami.public_website\`
LIMIT 
  100;`;

// Helper function to truncate JSON to prevent browser crashes
const truncateJSON = (obj: any, maxChars: number = 50000): string => {
    const fullJSON = JSON.stringify(obj, null, 2);

    if (fullJSON.length <= maxChars) {
        return fullJSON;
    }

    // Truncate and add notice
    const truncated = fullJSON.substring(0, maxChars - 500);
    const omittedChars = fullJSON.length - truncated.length;
    const omittedKB = (omittedChars / 1024).toFixed(1);

    return truncated + `\n\n... (${omittedKB} KB omitted - total size: ${(fullJSON.length / 1024).toFixed(1)} KB)\n\nJSON-utdata er begrenset til ${(maxChars / 1000).toFixed(0)}k tegn for å unngå at nettleseren krasjer.\nBruk tabellvisningen for å se alle resultater.`;
};

export default function SqlEditor() {
    const [searchParams] = useSearchParams();

    const urlPathFromUrl = searchParams.get('urlPath');
    const pathOperatorFromUrl = searchParams.get('pathOperator');
    const dateRangeFromUrl = searchParams.get('dateRange');
    const customStartFromUrl = searchParams.get('customStartDate');
    const customEndFromUrl = searchParams.get('customEndDate');

    const [hasMetabaseDateFilter, setHasMetabaseDateFilter] = useState(false);
    const [hasUrlPathFilter, setHasUrlPathFilter] = useState(false);
    const [hasWebsiteIdPlaceholder, setHasWebsiteIdPlaceholder] = useState(false);
    const [hasNettsidePlaceholder, setHasNettsidePlaceholder] = useState(false);
    const [hasHardcodedWebsiteId, setHasHardcodedWebsiteId] = useState(false);
    const [customVariables, setCustomVariables] = useState<string[]>([]);
    const [customVariableValues, setCustomVariableValues] = useState<Record<string, string>>({});
    const [oldTableWarning, setOldTableWarning] = useState<boolean>(false);
    const [showUpgradeSuccess, setShowUpgradeSuccess] = useState<boolean>(false);
    const [hasAttemptedFetch, setHasAttemptedFetch] = useState<boolean>(false);
    const [availableWebsites, setAvailableWebsites] = useState<Website[]>([]);
    const autoSelectedWebsiteIdRef = useRef<string | null>(null);
    const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>(() => {
        const now = new Date();
        return {
            from: new Date(now.getFullYear(), now.getMonth(), 1),
            to: now,
        };
    });
    const [period, setPeriod] = useState<string>('current_month');
    const [urlPath, setUrlPath] = useState('/');
    const [websiteIdState, setWebsiteIdState] = useState<string>('');
    const [selectedWebsite, setSelectedWebsite] = useState<Website | null>(null);

    // Ensure we land at top when navigating in
    useEffect(() => {
        window.scrollTo({ top: 0, behavior: 'auto' });
    }, []);

    const applyUrlFiltersToSql = (sql: string): string => {
        let processedSql = sql;
        let fromSql: string | null = null;
        let toSql: string | null = null;

        // Website ID substitution {{website_id}}
        const hasWebsitePlaceholderInline = /\{\{\s*website_id\s*\}\}/i.test(processedSql);
        if (hasWebsitePlaceholderInline && websiteIdState) {
            const sanitizedWebsiteId = websiteIdState.replace(/'/g, "''");
            // Replace placeholder even if it is wrapped in quotes to avoid double quoting
            processedSql = processedSql.replace(/(['"])?\s*\{\{\s*website_id\s*\}\}\s*\1?/gi, `'${sanitizedWebsiteId}'`);
        }

        // Nettside substitution {{nettside}} -> website domain
        const hasNettsidePlaceholder = /\{\{\s*nettside\s*\}\}/i.test(processedSql);
        if (hasNettsidePlaceholder && selectedWebsite?.domain) {
            const sanitizedDomain = selectedWebsite.domain.replace(/'/g, "''");
            // Replace placeholder even if it is wrapped in quotes to avoid double quoting
            processedSql = processedSql.replace(/(['"])?\s*\{\{\s*nettside\s*\}\}\s*\1?/gi, `'${sanitizedDomain}'`);
        }

        // URL path substitution (Metabase style [[ {{url_sti}} --]] '/' or [[ {{url_path}} --]] '/')
        const pathSource = urlPathFromUrl || urlPath;
        if (pathSource) {
            const paths = pathSource.split(',').filter(Boolean);
            const operator = pathOperatorFromUrl === 'starts-with' ? 'starts-with' : 'equals';

            if (paths.length > 0) {
                if (operator === 'starts-with') {
                    if (paths.length === 1) {
                        // Match both url_sti and url_path
                        const assignmentRegex = /=\s*\[\[\s*\{\{url_(?:sti|path)\}\}\s*--\s*\]\]\s*('[^']*')/gi;
                        processedSql = processedSql.replace(assignmentRegex, `LIKE '${paths[0]}%'`);
                    } else {
                        const multiLikeRegex = /(\S+)\s*=\s*\[\[\s*\{\{url_(?:sti|path)\}\}\s*--\s*\]\]\s*('[^']*')/gi;
                        processedSql = processedSql.replace(multiLikeRegex, (_m, column) => {
                            const likeConditions = paths.map(p => `${column} LIKE '${p}%'`).join(' OR ');
                            return `(${likeConditions})`;
                        });
                    }
                } else {
                    const assignmentRegex = /=\s*\[\[\s*\{\{url_(?:sti|path)\}\}\s*--\s*\]\]\s*('[^']*')/gi;
                    processedSql = paths.length === 1
                        ? processedSql.replace(assignmentRegex, `= '${paths[0]}'`)
                        : processedSql.replace(assignmentRegex, `IN (${paths.map(p => `'${p}'`).join(', ')})`);
                }
            }
        } else {
            // No external path provided; keep default '/' - match both url_sti and url_path
            processedSql = processedSql.replace(/\[\[\s*\{\{url_(?:sti|path)\}\}\s*--\s*\]\]/gi, '');
        }

        // Optional URL path substitution [[AND {{url_sti}} ]] or [[AND {{url_path}} ]]
        const andUrlStiPattern = /\[\[\s*AND\s*\{\{url_(?:sti|path)\}\}\s*\]\]/gi;
        if (andUrlStiPattern.test(processedSql)) {
            if (pathSource) {
                // Only support single path for now in this format, or could expand to IN/OR logic
                const path = pathSource.split(',')[0];
                const operator = pathOperatorFromUrl === 'starts-with' ? 'starts-with' : 'equals';

                if (operator === 'starts-with') {
                    processedSql = processedSql.replace(andUrlStiPattern, `AND url_path LIKE '${path}%'`);
                } else {
                    processedSql = processedSql.replace(andUrlStiPattern, `AND url_path = '${path}'`);
                }
            } else {
                processedSql = processedSql.replace(andUrlStiPattern, '');
            }
        }

        // Date substitution [[AND {{created_at}} ]] -- always replace if marker exists (default last 30 days)
        const datePattern = /\[\[\s*AND\s*\{\{created_at\}\}\s*\]\]/gi;
        if (datePattern.test(processedSql)) {
            const now = new Date();
            const from = dateRange.from || subDays(now, 30);
            const to = dateRange.to || now;
            fromSql = `TIMESTAMP('${format(from, 'yyyy-MM-dd')}')`;
            toSql = `TIMESTAMP('${format(to, 'yyyy-MM-dd')}T23:59:59')`;

            // Detect likely table to apply date filter to
            let tablePrefix = '`team-researchops-prod-01d6.umami_views.event`';
            if (processedSql.includes('umami_views.event')) {
                tablePrefix = '`team-researchops-prod-01d6.umami_views.event`';
            } else if (processedSql.includes('umami_views.session')) {
                tablePrefix = '`team-researchops-prod-01d6.umami_views.session`';
            } else if (processedSql.includes('public_session') && !processedSql.includes('public_website_event')) {
                tablePrefix = '`team-researchops-prod-01d6.umami.public_session`';
            }

            const dateReplacement = `AND ${tablePrefix}.created_at BETWEEN ${fromSql} AND ${toSql}`;
            processedSql = processedSql.replace(datePattern, dateReplacement);
        }

        // If query joins partitioned public_session, mirror the date filter to enable partition pruning
        if (fromSql && toSql && /public_session/gi.test(processedSql) && !/public_session[^\n]*created_at/gi.test(processedSql)) {
            const eventFilter = `\`team-researchops-prod-01d6.umami_views.event\`.created_at BETWEEN ${fromSql} AND ${toSql}`;
            const sessionPredicate = `\`team-researchops-prod-01d6.umami_views.session\`.created_at BETWEEN ${fromSql} AND ${toSql}`;


            if (processedSql.includes(eventFilter)) {
                processedSql = processedSql.replace(eventFilter, `${eventFilter} AND ${sessionPredicate}`);
            } else if (/WHERE/i.test(processedSql)) {
                processedSql = processedSql.replace(/WHERE/i, (match) => `${match} ${sessionPredicate} AND`);
            }
        }

        // Custom variable substitution {{variable_name}}
        for (const varName of customVariables) {
            const value = customVariableValues[varName];
            if (value !== undefined && value !== '') {
                const varRegex = new RegExp(`\\{\\{\\s*${varName}\\s*\\}\\}`, 'gi');
                // If the value looks like a number, don't add quotes
                const isNumeric = /^-?\d+\.?\d*$/.test(value);
                const replacement = isNumeric ? value : `'${value.replace(/'/g, "''")}'`;
                processedSql = processedSql.replace(varRegex, replacement);
            }
        }

        return processedSql;
    };

    // Only substitute website_id placeholder for copy actions (keep other filters untouched)
    const applyWebsiteIdOnly = (sql: string): string => {
        let processedSql = sql;
        const hasWebsitePlaceholderInline = /\{\{\s*website_id\s*\}\}/i.test(processedSql);
        if (hasWebsitePlaceholderInline && websiteIdState) {
            const sanitizedWebsiteId = websiteIdState.replace(/'/g, "''");
            processedSql = processedSql.replace(/(['"])?\s*\{\{\s*website_id\s*\}\}\s*\1?/gi, `'${sanitizedWebsiteId}'`);
        }
        return processedSql;
    };
    // State for editor height (for resizable editor)
    const [editorHeight, setEditorHeight] = useState(400);
    // Initialize state with empty string to avoid showing default until we check URL
    const [query, setQuery] = useState('');
    const [validateError, setValidateError] = useState<string | null>(null);
    const [showValidation, setShowValidation] = useState(false);
    const [result, setResult] = useState<any>(null);
    const [estimate, setEstimate] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [estimating, setEstimating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showEstimate, setShowEstimate] = useState(true);
    const [shareSuccess, setShareSuccess] = useState(false);
    const [formatSuccess, setFormatSuccess] = useState(false);
    const [lastProcessedSql, setLastProcessedSql] = useState<string>('');
    const [copiedMetabase, setCopiedMetabase] = useState(false);

    const ensureWebsitePlaceholder = (currentQuery: string): string => {
        // If any website-related placeholder or filter already exists, leave untouched
        // Check for {{website_id}}, {{nettside}}, website_id =, or website_domain =
        if (
            /\{\{\s*website_id\s*\}\}/i.test(currentQuery) ||
            /\{\{\s*nettside\s*\}\}/i.test(currentQuery) ||
            /website_id\s*=\s*['"]/i.test(currentQuery) ||
            /website_domain\s*=\s*/i.test(currentQuery)
        ) {
            return currentQuery;
        }

        const table = '`team-researchops-prod-01d6.umami_views.event`';

        if (/WHERE/i.test(currentQuery)) {
            return currentQuery.replace(/WHERE/i, (match) => `${match} ${table}.website_id = '{{website_id}}' AND`);
        }

        const trimmed = currentQuery.trimEnd();
        const suffix = trimmed.endsWith(';') ? ';' : '';
        const base = trimmed.replace(/;$/, '');
        return `${base} WHERE ${table}.website_id = '{{website_id}}'${suffix}`;
    };

    // Extract websiteId from SQL query for AnalysisActionModal
    const extractWebsiteId = (sql: string): string | undefined => {
        // Match patterns like: website_id = 'uuid' or website_id='uuid'
        const match = sql.match(/website_id\s*=\s*['"]([0-9a-f-]{36})['"]/i);
        return match?.[1];
    };

    // Replace hardcoded website_id with a new one
    const replaceHardcodedWebsiteId = (sql: string, newWebsiteId: string): string => {
        // Replace all occurrences of website_id = 'old-uuid' with website_id = 'new-uuid'
        return sql.replace(
            /(website_id\s*=\s*)(['"])([0-9a-f-]{36})\2/gi,
            `$1$2${newWebsiteId}$2`
        );
    };

    const websiteId = extractWebsiteId(query);
    // Check for SQL in URL params on mount and init filters
    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const sqlParam = urlParams.get('sql');

        console.log('URL search params:', window.location.search);
        console.log('SQL param:', sqlParam);

        if (sqlParam) {
            try {
                // URL params are already decoded by URLSearchParams
                console.log('Setting query to:', sqlParam);
                setQuery(sqlParam);
            } catch (e) {
                console.error('Failed to set SQL parameter:', e);
                setQuery(defaultQuery);
            }
        } else {
            // No SQL param, use default
            setQuery(defaultQuery);
        }

        // Init urlPath state from URL
        if (urlPathFromUrl) {
            setUrlPath(urlPathFromUrl.split(',')[0]);
        }

        // Init websiteId from URL
        const websiteIdParam = urlParams.get('websiteId');
        if (websiteIdParam) {
            setWebsiteIdState(websiteIdParam);
        }

        // Init date range state from URL
        const now = new Date();
        let from: Date | undefined = subDays(now, 30);
        let to: Date | undefined = now;
        if (dateRangeFromUrl === 'custom' && customStartFromUrl && customEndFromUrl) {
            from = new Date(customStartFromUrl);
            to = new Date(customEndFromUrl);
        } else if (dateRangeFromUrl === 'current_month') {
            from = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));
            to = now;
        } else if (dateRangeFromUrl === 'last_month') {
            from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            to = new Date(now.getFullYear(), now.getMonth(), 0);
        }
        setDateRange({ from, to });

        // Also update period state if present in URL
        if (dateRangeFromUrl) {
            setPeriod(dateRangeFromUrl);
        }
    }, []);

    // Detect metabase placeholders and hardcoded website IDs
    useEffect(() => {
        if (!query) {
            setHasMetabaseDateFilter(false);
            setHasUrlPathFilter(false);
            setHasWebsiteIdPlaceholder(false);
            setHasNettsidePlaceholder(false);
            setHasHardcodedWebsiteId(false);
            return;
        }
        const datePattern = /\[\[\s*AND\s*\{\{created_at\}\}\s*\]\]/i;
        setHasMetabaseDateFilter(datePattern.test(query));

        const urlPathPattern = /\[\[\s*\{\{url_sti\}\}\s*--\s*\]\]\s*'\/'/i;
        const andUrlPathPattern = /\[\[\s*AND\s*\{\{url_sti\}\}\s*\]\]/i;
        // Also detect url_path as a synonym for url_sti
        const urlPathPattern2 = /\[\[\s*\{\{url_path\}\}\s*--\s*\]\]\s*'\/'/i;
        const andUrlPathPattern2 = /\[\[\s*AND\s*\{\{url_path\}\}\s*\]\]/i;
        setHasUrlPathFilter(
            urlPathPattern.test(query) ||
            andUrlPathPattern.test(query) ||
            urlPathPattern2.test(query) ||
            andUrlPathPattern2.test(query)
        );

        const websiteIdPattern = /\{\{\s*website_id\s*\}\}/i;
        setHasWebsiteIdPlaceholder(websiteIdPattern.test(query));

        const nettsidePattern = /\{\{\s*nettside\s*\}\}/i;
        setHasNettsidePlaceholder(nettsidePattern.test(query));

        // Detect hardcoded website_id = 'uuid' pattern
        const hardcodedWebsiteIdPattern = /website_id\s*=\s*['"][0-9a-f-]{36}['"]/i;
        setHasHardcodedWebsiteId(hardcodedWebsiteIdPattern.test(query));

        // Detect custom {{variable}} placeholders (excluding known ones)
        // Only exclude url_sti/url_path if they're used in the special [[...]] patterns
        const urlPathInSpecialPattern =
            urlPathPattern.test(query) ||
            andUrlPathPattern.test(query) ||
            urlPathPattern2.test(query) ||
            andUrlPathPattern2.test(query);

        // Base known variables that should always have special handling
        const alwaysKnownVariables = ['website_id', 'nettside', 'created_at'];
        // Only treat url_sti/url_path as known if they're in special patterns
        const knownVariables = urlPathInSpecialPattern
            ? [...alwaysKnownVariables, 'url_sti', 'url_path']
            : alwaysKnownVariables;

        const allVariablesRegex = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/gi;
        const matches = [...query.matchAll(allVariablesRegex)];
        const detectedVars = matches
            .map(m => m[1])
            .filter(v => !knownVariables.includes(v.toLowerCase()))
            .filter((v, i, arr) => arr.indexOf(v) === i); // unique
        setCustomVariables(detectedVars);
    }, [query]);

    // Detect usage of old tables which cause partition errors and suggest new views
    useEffect(() => {
        const hasOldEventTable = /umami\.public_website_event/.test(query);
        const hasOldSessionTable = /umami\.public_session/.test(query);

        if (hasOldEventTable || hasOldSessionTable) {
            setOldTableWarning(true);
        } else {
            setOldTableWarning(false);
        }
    }, [query]);

    // Fetch available websites for auto-selection
    useEffect(() => {
        if (availableWebsites.length > 0) return;

        fetch('/api/bigquery/websites')
            .then(response => response.json())
            .then((response: { data: Website[] }) => {
                const websitesData = response.data || [];
                setAvailableWebsites(websitesData);
            })
            .catch(error => {
                console.error('Error fetching websites for auto-selection:', error);
            });
    }, [availableWebsites.length]);

    // Auto-select website when a hardcoded website_id is detected in the query
    useEffect(() => {
        if (!hasHardcodedWebsiteId || availableWebsites.length === 0) return;

        const detectedWebsiteId = extractWebsiteId(query);
        if (!detectedWebsiteId) return;

        // Don't auto-select if we've already auto-selected this ID or if user has selected something
        if (autoSelectedWebsiteIdRef.current === detectedWebsiteId) return;
        if (selectedWebsite?.id === detectedWebsiteId) {
            autoSelectedWebsiteIdRef.current = detectedWebsiteId;
            return;
        }

        // Find the website in the available list
        const matchingWebsite = availableWebsites.find(w => w.id === detectedWebsiteId);
        if (matchingWebsite) {
            console.log('Auto-selecting website from SQL:', matchingWebsite.name);
            setSelectedWebsite(matchingWebsite);
            setWebsiteIdState(matchingWebsite.id);
            autoSelectedWebsiteIdRef.current = detectedWebsiteId;
        }
    }, [hasHardcodedWebsiteId, query, availableWebsites, selectedWebsite?.id]);

    // Helper to update URL params without losing others
    const updateUrlParams = (updates: Record<string, string | null>) => {
        const params = new URLSearchParams(window.location.search);
        Object.entries(updates).forEach(([key, value]) => {
            if (value === null) {
                params.delete(key);
            } else {
                params.set(key, value);
            }
        });
        const newUrl = `${window.location.pathname}?${params.toString()}`;
        window.history.replaceState({}, '', newUrl);
    };

    const estimateCost = async () => {
        setEstimating(true);
        setError(null);

        // Update URL with current query
        updateUrlParams({ sql: query });

        const processedSql = applyUrlFiltersToSql(query);
        setLastProcessedSql(processedSql);

        try {
            const response = await fetch('/api/bigquery/estimate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ query: processedSql, analysisType: 'Sqlverktøy' }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Estimation failed');
            }

            setEstimate(data);
        } catch (err: any) {
            setError(err.message || 'An error occurred');
        } finally {
            setEstimating(false);
        }
    };

    const executeQuery = async () => {
        setLoading(true);
        setError(null);
        setResult(null);
        setHasAttemptedFetch(true);

        // Update URL with current query
        updateUrlParams({ sql: query });

        const processedSql = applyUrlFiltersToSql(query);
        setLastProcessedSql(processedSql);



        try {
            const response = await fetch('/api/bigquery', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ query: processedSql, analysisType: 'Sqlverktøy' }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Query failed');
            }

            setResult(data);
        } catch (err: any) {
            setError(err.message || 'An error occurred');
        } finally {
            setLoading(false);
        }
    };

    // Helper to temporarily replace Metabase placeholders with valid SQL for formatting/validation
    const sanitizePlaceholders = (sql: string): { sanitized: string; placeholders: Map<string, string> } => {
        const placeholders = new Map<string, string>();
        let sanitized = sql;
        let counter = 0;

        // Replace [[...]] optional blocks with a unique token
        sanitized = sanitized.replace(/\[\[[^\]]*\]\]/g, (match) => {
            const token = `__METABASE_OPT_${counter++}__`;
            placeholders.set(token, match);
            return `/* ${token} */`;
        });

        // Replace {{...}} variable placeholders with a unique token
        sanitized = sanitized.replace(/\{\{[^}]+\}\}/g, (match) => {
            const token = `__METABASE_VAR_${counter++}__`;
            placeholders.set(token, match);
            return `'${token}'`;
        });

        return { sanitized, placeholders };
    };

    // Helper to restore Metabase placeholders after formatting
    const restorePlaceholders = (sql: string, placeholders: Map<string, string>): string => {
        let restored = sql;
        placeholders.forEach((original, token) => {
            // Handle both comment-wrapped optional blocks and quoted variables
            restored = restored.replace(new RegExp(`/\\*\\s*${token}\\s*\\*/`, 'g'), original);
            restored = restored.replace(new RegExp(`'${token}'`, 'g'), original);
        });
        return restored;
    };

    // Simple SQL validation: check for empty input and basic SELECT/statement
    const validateSQL = () => {
        // Update URL with current query
        updateUrlParams({ sql: query });

        if (!query.trim()) {
            setValidateError('SQL kan ikke være tom.');
            setShowValidation(true);
            return false;
        }
        // Basic check for SQL command
        const valid = /\b(SELECT|INSERT|UPDATE|DELETE|WITH|CREATE|DROP|ALTER|SHOW|DESCRIBE)\b/i.test(query);
        if (!valid) {
            setValidateError('SQL må inneholde en gyldig kommando (f.eks. SELECT, INSERT, ...).');
            setShowValidation(true);
            return false;
        }
        // Try formatting to catch syntax errors (with placeholder sanitization)
        try {
            const { sanitized } = sanitizePlaceholders(query);
            sqlFormatter.format(sanitized);
            setValidateError('SQL er gyldig!');
            setShowValidation(true);
            return true;
        } catch (e: any) {
            setValidateError('Ugyldig SQL: ' + (e.message || 'Syntaksfeil'));
            setShowValidation(true);
            return false;
        }
    };

    const formatSQL = () => {
        // Update URL with current query
        updateUrlParams({ sql: query });

        try {
            const { sanitized, placeholders } = sanitizePlaceholders(query);
            const formatted = sqlFormatter.format(sanitized);
            const restored = restorePlaceholders(formatted, placeholders);
            setQuery(restored);
            setFormatSuccess(true);
            setTimeout(() => setFormatSuccess(false), 2000);
        } catch (e) {
            setValidateError('Kunne ikke formatere SQL. Sjekk om den er gyldig.');
            setShowValidation(true);
        }
    };

    const shareQuery = () => {
        const encodedSql = encodeURIComponent(query);
        const shareUrl = `${window.location.origin}/sql?sql=${encodedSql}`;
        navigator.clipboard.writeText(shareUrl);
        setShareSuccess(true);
        setTimeout(() => setShareSuccess(false), 3000);
    };

    // Clear validation message on edit
    const handleQueryChange = (val: string) => {
        setQuery(val);
        setShowValidation(false);
    };

    // Prepare chart data functions
    const prepareLineChartData = (includeAverage: boolean = false) => {
        if (!result || !result.data || result.data.length === 0) return null;

        const data = result.data;
        const keys = Object.keys(data[0]);

        // Need at least 2 columns (x-axis and y-axis)
        if (keys.length < 2) return null;

        console.log('Preparing LineChart with keys:', keys);
        console.log('Sample row:', data[0]);

        // Check if we have 3 columns - likely x-axis, series grouping, and y-axis
        if (keys.length === 3) {
            const xKey = keys[0];
            const seriesKey = keys[1]; // e.g., 'browser'
            const yKey = keys[2]; // e.g., 'Unike_besokende'

            // Group data by series
            const seriesMap = new Map<string, any[]>();

            data.forEach((row: any, rowIndex: number) => {
                const rawSeriesValue = row[seriesKey];
                const translatedSeriesValue = translateValue(seriesKey, rawSeriesValue);
                const seriesValue = String(translatedSeriesValue || 'Ukjent');
                if (!seriesMap.has(seriesValue)) {
                    seriesMap.set(seriesValue, []);
                }

                const xValue = row[xKey];
                const yValue = typeof row[yKey] === 'number' ? row[yKey] : parseFloat(row[yKey]) || 0;

                let x: number | Date;
                if (typeof xValue === 'string' && xValue.match(/^\d{4}-\d{2}-\d{2}/)) {
                    const parsedDate = new Date(xValue);
                    // Check if the date is valid
                    x = !isNaN(parsedDate.getTime()) ? parsedDate : rowIndex;
                } else if (typeof xValue === 'number') {
                    x = xValue;
                } else {
                    // Try to parse as date, fallback to index if invalid
                    const parsedDate = new Date(xValue);
                    x = !isNaN(parsedDate.getTime()) ? parsedDate : rowIndex;
                }

                seriesMap.get(seriesValue)!.push({
                    x,
                    y: yValue,
                    xAxisCalloutData: String(xValue),
                    yAxisCalloutData: String(yValue),
                });
            });

            // Convert to line chart format with colors
            // Using colorblind-friendly palette with good contrast
            const colors = [
                '#0067C5', // Blue (NAV blue)
                '#FF9100', // Orange
                '#06893A', // Green
                '#C30000', // Red
                '#634689', // Purple
                '#A8874C', // Brown/Gold
                '#005B82', // Teal
                '#E18AAA', // Pink
            ];
            const lineChartData = Array.from(seriesMap.entries()).map(([seriesName, points], index) => ({
                legend: seriesName,
                data: points,
                color: colors[index % colors.length],
                lineOptions: {
                    lineBorderWidth: '2',
                },
            }));

            // Calculate average line across all data points (only if requested)
            if (includeAverage) {
                // Collect all unique x values
                const allXValues = new Set<number>();
                lineChartData.forEach(series => {
                    series.data.forEach((point: any) => {
                        const xVal = point.x instanceof Date ? point.x.getTime() : Number(point.x);
                        allXValues.add(xVal);
                    });
                });

                // For each x value, calculate the average y value across all series
                const averagePoints = Array.from(allXValues).sort((a, b) => a - b).map(xVal => {
                    const yValues: number[] = [];
                    lineChartData.forEach(series => {
                        const point = series.data.find((p: any) => {
                            const pxVal = p.x instanceof Date ? p.x.getTime() : Number(p.x);
                            return pxVal === xVal;
                        });
                        if (point) {
                            yValues.push(point.y);
                        }
                    });

                    const avgY = yValues.length > 0
                        ? yValues.reduce((sum, val) => sum + val, 0) / yValues.length
                        : 0;

                    // Find original xAxisCalloutData from any series
                    const originalPoint = lineChartData[0].data.find((p: any) => {
                        const pxVal = p.x instanceof Date ? p.x.getTime() : Number(p.x);
                        return pxVal === xVal;
                    });

                    return {
                        x: new Date(xVal),
                        y: avgY,
                        xAxisCalloutData: originalPoint?.xAxisCalloutData || String(xVal),
                        yAxisCalloutData: avgY.toFixed(2),
                    };
                });

                // Add average line to the chart
                lineChartData.push({
                    legend: 'Gjennomsnitt',
                    data: averagePoints,
                    color: '#262626', // Dark gray for average line
                    lineOptions: {
                        lineBorderWidth: '2',
                        strokeDasharray: '5 5',
                    } as any,
                });
            }

            console.log('Multi-line chart data:', lineChartData.length, 'series' + (includeAverage ? ' (including average)' : ''));

            return {
                data: {
                    lineChartData,
                },
                enabledLegendsWrapLines: true,
            };
        }

        // Single line: assume first column is x-axis and second is y-axis
        const xKey = keys[0];
        const yKey = keys[1];

        const chartPoints = data.map((row: any, index: number) => {
            const xValue = row[xKey];
            const yValue = typeof row[yKey] === 'number' ? row[yKey] : parseFloat(row[yKey]) || 0;

            let x: number | Date;
            if (typeof xValue === 'string' && xValue.match(/^\d{4}-\d{2}-\d{2}/)) {
                x = new Date(xValue);
            } else if (typeof xValue === 'number') {
                x = xValue;
            } else {
                x = index;
            }

            return {
                x,
                y: yValue,
                xAxisCalloutData: String(xValue),
                yAxisCalloutData: String(yValue),
            };
        });

        console.log('Single-line chart points:', chartPoints.slice(0, 3));

        // Build the line chart data array
        const lineChartData: any[] = [{
            legend: yKey,
            data: chartPoints,
            color: '#0067C5',
            lineOptions: {
                lineBorderWidth: '2',
            },
        }];

        // Add average line (only if requested)
        if (includeAverage) {
            // Calculate average y value for horizontal average line
            const avgY = chartPoints.reduce((sum: number, point: any) => sum + point.y, 0) / chartPoints.length;

            // Create average line points (horizontal line across all x values)
            const averageLinePoints = chartPoints.map((point: any) => ({
                x: point.x,
                y: avgY,
                xAxisCalloutData: point.xAxisCalloutData,
                yAxisCalloutData: avgY.toFixed(2),
            }));

            lineChartData.push({
                legend: 'Gjennomsnitt',
                data: averageLinePoints,
                color: '#262626',
                lineOptions: {
                    lineBorderWidth: '2',
                    strokeDasharray: '5 5',
                } as any,
            });
        }

        return {
            data: {
                lineChartData,
            },
            enabledLegendsWrapLines: true,
        };
    };

    const prepareBarChartData = () => {
        if (!result || !result.data || result.data.length === 0) return null;

        const data = result.data;

        // Only show bar chart if 12 or fewer items
        if (data.length > 12) return null;

        const keys = Object.keys(data[0]);

        // Need at least 2 columns (label and value)
        if (keys.length < 2) return null;

        // Assume first column is label and second is value
        const labelKey = keys[0];
        const valueKey = keys[1];

        console.log('Preparing VerticalBarChart with keys:', { labelKey, valueKey });
        console.log('Sample row:', data[0]);

        // Calculate total for percentages
        const total = data.reduce((sum: number, row: any) => {
            const value = typeof row[valueKey] === 'number' ? row[valueKey] : parseFloat(row[valueKey]) || 0;
            return sum + value;
        }, 0);

        console.log('Total value for bar chart:', total);

        const barChartData = data.map((row: any) => {
            const value = typeof row[valueKey] === 'number' ? row[valueKey] : parseFloat(row[valueKey]) || 0;
            const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : '0';

            // Use label for x-axis, with translation
            const rawLabel = row[labelKey];
            const translatedLabel = translateValue(labelKey, rawLabel);
            const label = String(translatedLabel || 'Ukjent');

            return {
                x: label,
                y: value,
                xAxisCalloutData: label,
                yAxisCalloutData: `${value} (${percentage}%)`,
                color: '#0067C5', // NAV blue color
                legend: label,
            };
        });

        console.log('VerticalBarChart data points:', barChartData.slice(0, 3));

        return {
            data: barChartData,
            barWidth: 'auto' as 'auto',
            yAxisTickCount: 5,
            enableReflow: true,
            legendProps: {
                allowFocusOnLegends: true,
                canSelectMultipleLegends: false,
                styles: {
                    root: {
                        display: 'flex',
                        flexWrap: 'wrap',
                        rowGap: '8px',
                        columnGap: '16px',
                        maxWidth: '100%',
                    },
                    legend: {
                        marginRight: 0,
                    },
                },
            },
        };
    };

    const preparePieChartData = () => {
        if (!result || !result.data || result.data.length === 0) return null;

        const data = result.data;

        // Only show pie chart if 12 or fewer items
        if (data.length > 12) return null;

        const keys = Object.keys(data[0]);

        // Need at least 2 columns (label and value)
        if (keys.length < 2) return null;

        // Assume first column is label and second is value
        const labelKey = keys[0];
        const valueKey = keys[1];

        console.log('Preparing PieChart with keys:', { labelKey, valueKey });
        console.log('Sample row:', data[0]);

        // Calculate total for percentages
        const total = data.reduce((sum: number, row: any) => {
            const value = typeof row[valueKey] === 'number' ? row[valueKey] : parseFloat(row[valueKey]) || 0;
            return sum + value;
        }, 0);

        console.log('Total value for pie chart:', total);

        const pieChartData = data.map((row: any) => {
            const value = typeof row[valueKey] === 'number' ? row[valueKey] : parseFloat(row[valueKey]) || 0;
            const rawLabel = row[labelKey];
            const translatedLabel = translateValue(labelKey, rawLabel);
            const label = String(translatedLabel || 'Ukjent');

            return {
                y: value,
                x: label,
            };
        });

        console.log('PieChart data points:', pieChartData.slice(0, 3));

        return {
            data: pieChartData,
            total,
        };
    };

    return (
        <ChartLayout
            title="Umami SQL-spørringer"
            description="Kjør SQL-spørringer mot Umami datasettet i BigQuery."
            currentPage="sql"
            wideSidebar={true}
            filters={
                <>
                    {/* Metabase-lignende filterkontroller (auto når placeholders finnes) */}
                    {(hasMetabaseDateFilter || hasUrlPathFilter || hasWebsiteIdPlaceholder || hasNettsidePlaceholder || hasHardcodedWebsiteId || customVariables.length > 0) && (
                        <>
                            <Heading size="xsmall" level="3" style={{ paddingBottom: '8px' }}>Filtre</Heading>
                            <div className="flex flex-col gap-4 mb-4 p-3 border border-[var(--ax-border-neutral-subtle)] rounded" style={{ backgroundColor: 'var(--ax-bg-default, #fff)' }}>
                                {(hasWebsiteIdPlaceholder || hasNettsidePlaceholder || hasHardcodedWebsiteId) && (
                                    <div className="flex-1 min-w-[260px]">
                                        <WebsitePicker
                                            selectedWebsite={selectedWebsite}
                                            onWebsiteChange={(website) => {
                                                setSelectedWebsite(website);
                                                setWebsiteIdState(website?.id || '');

                                                // Only modify the query if user is switching to a DIFFERENT website
                                                // Don't modify if it's the same website that's already in the SQL
                                                const currentWebsiteIdInSql = extractWebsiteId(query);
                                                const isNewWebsite = website?.id && website.id !== currentWebsiteIdInSql;

                                                if (hasHardcodedWebsiteId && isNewWebsite) {
                                                    // Replace the hardcoded website_id with the new one
                                                    setQuery(prev => replaceHardcodedWebsiteId(prev, website.id));
                                                } else if (!hasHardcodedWebsiteId && !hasNettsidePlaceholder) {
                                                    setQuery(prev => ensureWebsitePlaceholder(prev));
                                                }
                                            }}
                                            variant="minimal"
                                            disableAutoRestore={hasHardcodedWebsiteId}
                                            customLabel={hasHardcodedWebsiteId ? "Nettside eller app (overskriver SQL-koden)" : "Nettside eller app"}
                                        />
                                    </div>
                                )}

                                {hasMetabaseDateFilter && (
                                    <div className="flex-1 min-w-[260px]">
                                        <PeriodPicker
                                            period={period}
                                            onPeriodChange={(newPeriod) => {
                                                setPeriod(newPeriod);
                                                const now = new Date();
                                                let newFrom: Date | undefined;
                                                let newTo: Date | undefined;

                                                if (newPeriod === 'today') {
                                                    newFrom = now;
                                                    newTo = now;
                                                } else if (newPeriod === 'current_month') {
                                                    newFrom = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));
                                                    newTo = now;
                                                } else if (newPeriod === 'last_month') {
                                                    newFrom = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                                                    newTo = new Date(now.getFullYear(), now.getMonth(), 0);
                                                }

                                                if (newFrom && newTo) {
                                                    setDateRange({ from: newFrom, to: newTo });
                                                }

                                                // Update URL
                                                updateUrlParams({
                                                    dateRange: newPeriod,
                                                    customStartDate: null,
                                                    customEndDate: null
                                                });
                                            }}
                                            startDate={dateRange.from}
                                            onStartDateChange={(date) => {
                                                setDateRange(prev => {
                                                    const newState = { ...prev, from: date };
                                                    setPeriod('custom');
                                                    updateUrlParams({
                                                        dateRange: 'custom',
                                                        customStartDate: date ? date.toISOString() : null,
                                                        customEndDate: newState.to ? newState.to.toISOString() : null
                                                    });
                                                    return newState;
                                                });
                                            }}
                                            endDate={dateRange.to}
                                            onEndDateChange={(date) => {
                                                setDateRange(prev => {
                                                    const newState = { ...prev, to: date };
                                                    setPeriod('custom');
                                                    updateUrlParams({
                                                        dateRange: 'custom',
                                                        customStartDate: newState.from ? newState.from.toISOString() : null,
                                                        customEndDate: date ? date.toISOString() : null
                                                    });
                                                    return newState;
                                                });
                                            }}
                                        />
                                    </div>
                                )}

                                {hasUrlPathFilter && (
                                    <div className="flex-1 min-w-[240px]">
                                        <TextField
                                            label="Side eller URL"
                                            size="small"
                                            description="F.eks. / for forsiden"
                                            value={urlPath}
                                            onChange={(e) => setUrlPath(e.target.value)}
                                        />
                                    </div>
                                )}

                                {/* Custom variable inputs */}
                                {customVariables.map((varName) => (
                                    <div key={varName} className="flex-1 min-w-[200px]">
                                        <TextField
                                            label={varName.replace(/_/g, ' ')}
                                            size="small"
                                            value={customVariableValues[varName] || ''}
                                            onChange={(e) => setCustomVariableValues(prev => ({
                                                ...prev,
                                                [varName]: e.target.value
                                            }))}
                                        />
                                    </div>
                                ))}
                            </div>
                        </>
                    )}

                    <ReadMore header="Tilgjengelige tabeller" size="small" className="mt-4">
                        <ul className="space-y-3">
                            <li className="flex flex-col gap-1">
                                <span className="font-semibold text-sm mt-2">Nettsider/apper</span>
                                <div className="flex items-center gap-2">
                                    <span className="font-mono text-xs bg-[var(--ax-bg-neutral-soft)] px-2 py-1 rounded border border-[var(--ax-border-neutral-subtle)]">team-researchops-prod-01d6.umami.public_website</span>
                                    <Button
                                        size="xsmall"
                                        variant="tertiary"
                                        type="button"
                                        onClick={() => { navigator.clipboard.writeText('team-researchops-prod-01d6.umami.public_website'); }}
                                    >
                                        Kopier
                                    </Button>
                                </div>
                            </li>
                            <li className="flex flex-col gap-1">
                                <span className="font-semibold text-sm mt-2">Personer</span>
                                <div className="flex items-center gap-2">
                                    <span className="font-mono text-xs bg-[var(--ax-bg-neutral-soft)] px-2 py-1 rounded border border-[var(--ax-border-neutral-subtle)]">team-researchops-prod-01d6.umami_views.session</span>
                                    <Button
                                        size="xsmall"
                                        variant="tertiary"
                                        type="button"
                                        onClick={() => { navigator.clipboard.writeText('team-researchops-prod-01d6.umami_views.session'); }}
                                    >
                                        Kopier
                                    </Button>
                                </div>
                            </li>
                            <li className="flex flex-col gap-1">
                                <span className="font-semibold text-sm mt-2">Alle hendelser</span>
                                <div className="flex items-center gap-2">
                                    <span className="font-mono text-xs bg-[var(--ax-bg-neutral-soft)] px-2 py-1 rounded border border-[var(--ax-border-neutral-subtle)]">team-researchops-prod-01d6.umami_views.event</span>
                                    <Button
                                        size="xsmall"
                                        variant="tertiary"
                                        type="button"
                                        onClick={() => { navigator.clipboard.writeText('team-researchops-prod-01d6.umami_views.event'); }}
                                    >
                                        Kopier
                                    </Button>
                                </div>
                            </li>
                            <li className="flex flex-col gap-1">
                                <span className="font-semibold text-sm mt-2">Egenfedinerte hendelser metadata</span>
                                <div className="flex items-center gap-2">
                                    <span className="font-mono text-xs bg-[var(--ax-bg-neutral-soft)] px-2 py-1 rounded border border-[var(--ax-border-neutral-subtle)]">team-researchops-prod-01d6.umami_views.event_data</span>
                                    <Button
                                        size="xsmall"
                                        variant="tertiary"
                                        type="button"
                                        onClick={() => { navigator.clipboard.writeText('team-researchops-prod-01d6.umami_views.event_data'); }}
                                    >
                                        Kopier
                                    </Button>
                                </div>
                            </li>
                        </ul>
                        <ReadMore header="Umami (legacy)" size="small" className="mt-6 mb-6">
                            <ul className="space-y-3">
                                <li className="flex flex-col gap-1">
                                    <span className="font-semibold text-sm mt-2">Nettsider/apper</span>
                                    <div className="flex items-center gap-2">
                                        <span className="font-mono text-xs bg-[var(--ax-bg-neutral-soft)] px-2 py-1 rounded border border-[var(--ax-border-neutral-subtle)]">team-researchops-prod-01d6.umami.public_website</span>
                                        <Button
                                            size="xsmall"
                                            variant="tertiary"
                                            type="button"
                                            onClick={() => { navigator.clipboard.writeText('team-researchops-prod-01d6.umami.public_website'); }}
                                        >
                                            Kopier
                                        </Button>
                                    </div>
                                </li>
                                <li className="flex flex-col gap-1">
                                    <span className="font-semibold text-sm mt-2">Personer</span>
                                    <div className="flex items-center gap-2">
                                        <span className="font-mono text-xs bg-[var(--ax-bg-neutral-soft)] px-2 py-1 rounded border border-[var(--ax-border-neutral-subtle)]">team-researchops-prod-01d6.umami.public_session</span>
                                        <Button
                                            size="xsmall"
                                            variant="tertiary"
                                            type="button"
                                            onClick={() => { navigator.clipboard.writeText('team-researchops-prod-01d6.umami.public_session'); }}
                                        >
                                            Kopier
                                        </Button>
                                    </div>
                                </li>
                                <li className="flex flex-col gap-1">
                                    <span className="font-semibold text-sm mt-2">Alle hendelser</span>
                                    <div className="flex items-center gap-2">
                                        <span className="font-mono text-xs bg-[var(--ax-bg-neutral-soft)] px-2 py-1 rounded border border-[var(--ax-border-neutral-subtle)]">team-researchops-prod-01d6.umami.public_website_event</span>
                                        <Button
                                            size="xsmall"
                                            variant="tertiary"
                                            type="button"
                                            onClick={() => { navigator.clipboard.writeText('team-researchops-prod-01d6.umami.public_website_event'); }}
                                        >
                                            Kopier
                                        </Button>
                                    </div>
                                </li>
                                <li className="flex flex-col gap-1">
                                    <span className="font-semibold text-sm mt-2">Egenfedinerte hendelser metadata</span>
                                    <div className="flex items-center gap-2">
                                        <span className="font-mono text-xs bg-[var(--ax-bg-neutral-soft)] px-2 py-1 rounded border border-[var(--ax-border-neutral-subtle)]">team-researchops-prod-01d6.umami.public_event_data</span>
                                        <Button
                                            size="xsmall"
                                            variant="tertiary"
                                            type="button"
                                            onClick={() => { navigator.clipboard.writeText('team-researchops-prod-01d6.umami.public_event_data'); }}
                                        >
                                            Kopier
                                        </Button>
                                    </div>
                                </li>
                            </ul>
                        </ReadMore>
                    </ReadMore>

                    {/* Query Input */}
                    <div>
                        {/* Old Table Warning & Fix */}
                        {oldTableWarning && (
                            <Alert variant="warning" className="mb-4">
                                <Heading level="3" size="small" spacing>
                                    Utdaterte tabeller oppdaget
                                </Heading>
                                <BodyLong>
                                    Spørringen din bruker gamle tabellnavn. Vi anbefaler å bytte til de nye <code>umami_views</code> tabellene:
                                    <ul className="list-disc list-inside mt-2 text-sm">
                                        <li><code>public_website_event</code> &rarr; <code>umami_views.event</code></li>
                                        <li><code>public_session</code> &rarr; <code>umami_views.session</code></li>
                                    </ul>
                                </BodyLong>
                                <div className="mt-3">
                                    <Button
                                        size="small"
                                        variant="primary"
                                        onClick={() => {
                                            // Replace old tables with new views
                                            let newQuery = query
                                                .replace(/umami\.public_website_event/gi, 'umami_views.event')
                                                .replace(/umami\.public_session/gi, 'umami_views.session');
                                            setQuery(newQuery);
                                            setOldTableWarning(false);
                                            setShowUpgradeSuccess(true);
                                        }}
                                    >
                                        Oppdater SQL-spørringen til nye tabeller
                                    </Button>
                                </div>
                            </Alert>
                        )}

                        {/* Success Message */}
                        {showUpgradeSuccess && (
                            <Alert variant="success" className="mb-4 relative">
                                <Heading level="3" size="small" spacing>
                                    Tabeller oppgradert!
                                </Heading>
                                <BodyLong>
                                    SQL-spørringen er nå oppdatert til å bruke nye tabeller (<code>umami_views</code>).
                                </BodyLong>
                                <button
                                    onClick={() => setShowUpgradeSuccess(false)}
                                    className="absolute right-3 top-3 p-1 hover:bg-[var(--ax-bg-neutral-soft)] rounded text-[var(--ax-text-default)]"
                                    aria-label="Lukk melding"
                                    type="button"
                                >
                                    <X size={20} />
                                </button>
                            </Alert>
                        )}

                        <label className="block font-medium mb-2" htmlFor="sql-editor">SQL-spørring</label>
                        <div
                            className="border rounded resize-y overflow-auto"
                            style={{ position: 'relative', isolation: 'isolate', minHeight: 100, maxHeight: 600, height: editorHeight }}
                            onMouseUp={e => {
                                const target = e.currentTarget as HTMLDivElement;
                                setEditorHeight(target.offsetHeight);
                            }}
                        >
                            <Editor
                                height={editorHeight}
                                defaultLanguage="sql"
                                value={query}
                                onChange={(value) => handleQueryChange(value || '')}
                                theme="vs-dark"
                                options={{
                                    minimap: { enabled: false },
                                    fontSize: 14,
                                    lineNumbers: 'on',
                                    scrollBeyondLastLine: false,
                                    automaticLayout: true,
                                    tabSize: 2,
                                    wordWrap: 'on',
                                    fixedOverflowWidgets: true,
                                    stickyScroll: { enabled: false },
                                    lineNumbersMinChars: 4,
                                    glyphMargin: false,
                                }}
                            />
                        </div>
                        <div className="flex flex-wrap gap-2 mt-2">
                            <Button size="small" variant="secondary" type="button" onClick={formatSQL}>
                                {formatSuccess ? '✓ Formatert' : 'Formater'}
                            </Button>
                            <Button size="small" variant="secondary" type="button" onClick={validateSQL}>Valider</Button>
                            <Button
                                size="small"
                                variant="secondary"
                                type="button"
                                onClick={estimateCost}
                                loading={estimating}
                            >
                                Estimer kostnad
                            </Button>
                            <Button
                                size="small"
                                variant="secondary"
                                type="button"
                                onClick={shareQuery}
                            >
                                {shareSuccess ? '✓ Kopiert' : 'Del'}
                            </Button>
                        </div>
                        {showValidation && validateError && (
                            <div
                                className={`relative rounded px-3 py-2 mt-2 text-sm ${validateError === 'SQL er gyldig!' ? 'bg-[var(--ax-bg-success-soft)] border border-[var(--ax-border-success-subtle)] text-[var(--ax-text-success)]' : 'bg-[var(--ax-bg-danger-soft)] border border-[var(--ax-border-danger-subtle)] text-[var(--ax-text-danger)]'}`}
                            >
                                <span>{validateError}</span>
                                <button
                                    type="button"
                                    aria-label="Lukk"
                                    onClick={() => setShowValidation(false)}
                                    className="absolute right-2 top-2 font-bold cursor-pointer"
                                >
                                    ×
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Cost Estimate Display */}
                    {estimate && showEstimate && (
                        <Alert variant="info" className="relative" size="small" style={{ marginTop: 24 }}>
                            <button
                                type="button"
                                aria-label="Lukk"
                                onClick={() => setShowEstimate(false)}
                                className="absolute right-2 top-2 font-bold cursor-pointer"
                            >
                                ×
                            </button>
                            <div className="space-y-1 text-sm">
                                {(() => {
                                    const gb = parseFloat(estimate.totalBytesProcessedGB);
                                    const cost = parseFloat(estimate.estimatedCostUSD) || (isFinite(gb) ? gb * 0.00625 : 0);
                                    return (
                                        <>
                                            <div>
                                                <strong>Data:</strong>
                                                {isFinite(gb) && gb >= 0.01 ? ` ${gb} GB` : ''}
                                            </div>
                                            {cost > 0 && (
                                                <div>
                                                    <strong>Kostnad:</strong> ${cost.toFixed(2)} USD
                                                </div>
                                            )}
                                        </>
                                    );
                                })()}
                                {estimate.cacheHit && (
                                    <div className="text-[var(--ax-text-success)]">
                                        ✓ Cached (no cost)
                                    </div>
                                )}
                            </div>
                        </Alert>
                    )}

                    {/* Submit Buttons */}
                    <div className="flex flex-wrap gap-2 mt-6">
                        <Button
                            onClick={executeQuery}
                            loading={loading}
                            icon={<PlayIcon size={18} />}
                            variant="primary"
                        >
                            Vis resultater
                        </Button>
                    </div>
                </>
            }
        >


            {/* Error Display */}
            {error && (
                <Alert variant="error" className="mb-4">
                    <Heading level="3" size="small" spacing>
                        Query Error
                    </Heading>
                    <BodyLong>{error}</BodyLong>

                    {/* Helper button for partition error */}
                    {error.includes("partition elimination") && error.includes("created_at") && (
                        <div className="mt-3">
                            <Button
                                size="small"
                                variant="secondary"
                                onClick={() => {
                                    // Add [[AND {{created_at}}]] to the WHERE clause
                                    let newQuery = query;
                                    if (/WHERE/i.test(query) && !/\[\[\s*AND\s*\{\{created_at\}\}\s*\]\]/i.test(query)) {
                                        // Find the last condition in the WHERE clause and add after it
                                        // Look for the end of the WHERE clause (before GROUP BY, ORDER BY, or end of query)
                                        const whereMatch = query.match(/WHERE\s+([\s\S]*?)(?=\s*(GROUP BY|ORDER BY|LIMIT|$|\)[\s\n]*,))/i);
                                        if (whereMatch) {
                                            const whereClause = whereMatch[0];
                                            const newWhereClause = whereClause.trimEnd() + '\n      [[AND {{created_at}}]]';
                                            newQuery = query.replace(whereClause, newWhereClause);
                                        }
                                    }
                                    setQuery(newQuery);
                                    setError(null);
                                }}
                            >
                                Legg til datofilter [[AND {"{{created_at}}"}]]
                            </Button>
                            <p className="text-sm mt-2 text-[var(--ax-text-subtle)]">
                                Tabellen krever et filter på created_at for partisjonering
                            </p>
                        </div>
                    )}

                    {lastProcessedSql && (
                        <ReadMore header="SQL etter filtre" size="small" className="mt-3">
                            <pre className="bg-[var(--ax-bg-neutral-soft)] border border-[var(--ax-border-neutral-subtle)] rounded p-3 text-xs font-mono whitespace-pre-wrap" style={{ margin: 0 }}>
                                {lastProcessedSql}
                            </pre>
                        </ReadMore>
                    )}
                </Alert>
            )}

            {/* Results Display Area */}
            {hasAttemptedFetch && (
                <>
                    <ResultsPanel
                        result={result}
                        loading={loading}
                        error={error}
                        queryStats={result?.queryStats || estimate}
                        lastAction={null}
                        showLoadingMessage={estimating || loading}
                        executeQuery={executeQuery}
                        handleRetry={executeQuery}
                        prepareLineChartData={prepareLineChartData}
                        prepareBarChartData={prepareBarChartData}
                        preparePieChartData={preparePieChartData}
                        sql={lastProcessedSql || query}
                        showSqlCode={true}
                        showEditButton={true}
                        showCost={true}
                        websiteId={websiteId}
                    />

                    {/* JSON Output - below results */}
                    {result && (
                        <ReadMore header="JSON" size="small" className="mt-6">
                            <pre className="bg-[var(--ax-bg-neutral-soft)] border border-gray-300 rounded p-3 text-xs font-mono whitespace-pre-wrap" style={{ margin: 0 }}>{truncateJSON(result)}</pre>
                        </ReadMore>
                    )}

                    {/* Metabase quick actions */}
                    <div className="mt-6 pt-2 space-y-1.5">
                        <Heading level="3" size="xsmall">Legg til i Metabase</Heading>
                        <div className="h-1" aria-hidden="true" />
                        <div className="flex flex-col items-start gap-2">
                            <Button
                                size="small"
                                variant="secondary"
                                type="button"
                                onClick={() => {
                                    const metabaseSql = applyWebsiteIdOnly(query); // only hardcode website_id; keep other placeholders
                                    navigator.clipboard.writeText(metabaseSql);
                                    setCopiedMetabase(true);
                                    setTimeout(() => setCopiedMetabase(false), 2000);
                                }}
                                icon={<Copy size={16} />}
                            >
                                {copiedMetabase ? 'Kopiert!' : 'Kopier spørring'}
                            </Button>
                            <div className="pl-[2px]">
                                <Link
                                    href="https://metabase.ansatt.nav.no/question#eyJkYXRhc2V0X3F1ZXJ5Ijp7ImRhdGFiYXNlIjo3MzEsInR5cGUiOiJuYXRpdmUiLCJuYXRpdmUiOnsicXVlcnkiOiIiLCJ0ZW1wbGF0ZS10YWdzIjp7fX19LCJkaXNwbGF5IjoidGFibGUiLCJ2aXN1YWxpemF0aW9uX3NldHRpbmdzIjp7fSwidHlwZSI6InF1ZXN0aW9uIn0="
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-sm"
                                >
                                    Åpne Metabase
                                </Link>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </ChartLayout>
    );
}

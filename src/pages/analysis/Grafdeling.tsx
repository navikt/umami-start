import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import ResultsPanel from '../../components/chartbuilder/results/ResultsPanel';
import { Alert, BodyLong, Loader, TextField, Button } from '@navikt/ds-react';
import { translateValue } from '../../lib/translations';
import ChartLayout from '../../components/analysis/ChartLayout';
import WebsitePicker from '../../components/analysis/WebsitePicker';
import PeriodPicker from '../../components/analysis/PeriodPicker';
import { subDays, format } from 'date-fns';

type Website = {
    id: string;
    name: string;
    domain: string;
    teamId: string;
    createdAt: string;
};

export default function Grafdeling() {
    const [searchParams] = useSearchParams();
    const [query, setQuery] = useState('');
    const [result, setResult] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [description, setDescription] = useState<string>('');
    const [dashboardTitle, setDashboardTitle] = useState<string>('');
    const [queryStats, setQueryStats] = useState<any>(null);

    // Filter states
    const [availableWebsites, setAvailableWebsites] = useState<Website[]>([]);
    const [selectedWebsite, setSelectedWebsite] = useState<Website | null>(null);
    const [websiteIdState, setWebsiteIdState] = useState<string>('');
    const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>(() => {
        const now = new Date();
        return {
            from: new Date(now.getFullYear(), now.getMonth(), 1),
            to: now,
        };
    });
    const [period, setPeriod] = useState<string>('current_month');
    const [urlPath, setUrlPath] = useState('/');

    // Placeholder detection flags
    const [hasMetabaseDateFilter, setHasMetabaseDateFilter] = useState(false);
    const [hasUrlPathFilter, setHasUrlPathFilter] = useState(false);
    const [hasWebsiteIdPlaceholder, setHasWebsiteIdPlaceholder] = useState(false);
    const [hasNettsidePlaceholder, setHasNettsidePlaceholder] = useState(false);
    const [customVariables, setCustomVariables] = useState<string[]>([]);
    const [customVariableValues, setCustomVariableValues] = useState<Record<string, string>>({});

    const pathOperatorFromUrl = searchParams.get('pathOperator');

    const applyUrlFiltersToSql = (sql: string): string => {
        let processedSql = sql;
        let fromSql: string | null = null;
        let toSql: string | null = null;

        // Website ID substitution {{website_id}}
        const hasWebsitePlaceholderInline = /\{\{\s*website_id\s*\}\}/i.test(processedSql);
        if (hasWebsitePlaceholderInline && websiteIdState) {
            const sanitizedWebsiteId = websiteIdState.replace(/'/g, "''");
            processedSql = processedSql.replace(/(['"])?\s*\{\{\s*website_id\s*\}\}\s*\1?/gi, `'${sanitizedWebsiteId}'`);
        }

        // Nettside substitution {{nettside}} -> website domain
        const hasNettsidePlaceholder = /\{\{\s*nettside\s*\}\}/i.test(processedSql);
        if (hasNettsidePlaceholder && selectedWebsite?.domain) {
            const sanitizedDomain = selectedWebsite.domain.replace(/'/g, "''");
            processedSql = processedSql.replace(/(['"])?\s*\{\{\s*nettside\s*\}\}\s*\1?/gi, `'${sanitizedDomain}'`);
        }

        // URL path substitution: e.g. url_path = [[ {{url_sti}} --]] '/'
        const pathSource = urlPath;
        const replacePattern = /\[\[\s*\{\{url_(?:sti|path)\}\}\s*--\s*\]\]\s*('[^']*')/gi;

        if (pathSource && pathSource !== '/') {
            // If we have a filter value, replace the placeholder AND the default quoted value with the new quoted value.
            // NOTE: The previous regex replaced with "= 'value'", but the SQL likely already has "url_path =".
            // If the SQL is: url_path = [[...]] '/'
            // We should replace "[[...]] '/'" with "'/newpath'".
            // We do NOT include the equals sign in the replacement.
            processedSql = processedSql.replace(replacePattern, `'${pathSource}'`);
        } else {
            // If no filter value (or default '/'), we strip the [[...]] wrapper and keep the default value.
            // The regex captures the quoted string in group 1.
            // So replacement is just "$1".
            processedSql = processedSql.replace(replacePattern, '$1');
        }

        // Optional URL path substitution [[AND {{url_sti}} ]]
        const andUrlStiPattern = /\[\[\s*AND\s*\{\{url_(?:sti|path)\}\}\s*\]\]/gi;
        if (andUrlStiPattern.test(processedSql)) {
            if (pathSource && pathSource !== '/') {
                const operator = pathOperatorFromUrl === 'starts-with' ? 'starts-with' : 'equals';
                if (operator === 'starts-with') {
                    processedSql = processedSql.replace(andUrlStiPattern, `AND url_path LIKE '${pathSource}%'`);
                } else {
                    processedSql = processedSql.replace(andUrlStiPattern, `AND url_path = '${pathSource}'`);
                }
            } else {
                processedSql = processedSql.replace(andUrlStiPattern, '');
            }
        }

        // Date substitution [[AND {{created_at}} ]]
        const datePattern = /\[\[\s*AND\s*\{\{created_at\}\}\s*\]\]/gi;
        if (datePattern.test(processedSql)) {
            const now = new Date();
            const from = dateRange.from || subDays(now, 30);
            const to = dateRange.to || now;
            fromSql = `TIMESTAMP('${format(from, 'yyyy-MM-dd')}')`;
            toSql = `TIMESTAMP('${format(to, 'yyyy-MM-dd')}T23:59:59')`;

            let tablePrefix = '`team-researchops-prod-01d6.umami_views.event`';
            if (processedSql.includes('umami_views.event')) {
                tablePrefix = '`team-researchops-prod-01d6.umami_views.event`';
            } else if (processedSql.includes('umami_views.session')) {
                tablePrefix = '`team-researchops-prod-01d6.umami_views.session`';
            }

            const dateReplacement = `AND ${tablePrefix}.created_at BETWEEN ${fromSql} AND ${toSql}`;
            processedSql = processedSql.replace(datePattern, dateReplacement);
        }

        // Custom variable substitution
        for (const varName of customVariables) {
            const value = customVariableValues[varName];
            if (value !== undefined && value !== '') {
                const varRegex = new RegExp(`\\{\\{\\s*${varName}\\s*\\}\\}`, 'gi');
                const isNumeric = /^-?\d+\.?\d*$/.test(value);
                const replacement = isNumeric ? value : `'${value.replace(/'/g, "''")}'`;
                processedSql = processedSql.replace(varRegex, replacement);
            }
        }

        return processedSql;
    };

    const extractWebsiteId = (sql: string): string | undefined => {
        const match = sql.match(/website_id\s*=\s*['"]([0-9a-f-]{36})['"]/i);
        return match?.[1];
    };

    const websiteId = extractWebsiteId(query);

    // Initial load and parse params
    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        let sqlParam = urlParams.get('sql');
        const descParam = urlParams.get('beskrivelse') || urlParams.get('desc');
        const dashboardParam = urlParams.get('dashboard');

        if (descParam) setDescription(descParam);
        if (dashboardParam) setDashboardTitle(dashboardParam);

        const urlPathFromUrl = urlParams.get('urlPath');
        if (urlPathFromUrl) setUrlPath(urlPathFromUrl.split(',')[0]);

        const websiteIdParam = urlParams.get('websiteId');
        if (websiteIdParam) setWebsiteIdState(websiteIdParam);

        // Date range from URL params
        const dateRangeFromUrl = urlParams.get('dateRange');
        const customStartFromUrl = urlParams.get('customStartDate');
        const customEndFromUrl = urlParams.get('customEndDate');

        let from: Date | undefined;
        let to: Date | undefined;
        const now = new Date();

        if (dateRangeFromUrl === 'custom' && customStartFromUrl && customEndFromUrl) {
            from = new Date(customStartFromUrl);
            to = new Date(customEndFromUrl);
            setPeriod('custom');
            setDateRange({ from, to });
        } else if (dateRangeFromUrl === 'current_month') {
            from = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));
            to = now;
            setPeriod('current_month');
            setDateRange({ from, to });
        } else if (dateRangeFromUrl === 'last_month') {
            from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            to = new Date(now.getFullYear(), now.getMonth(), 0);
            setPeriod('last_month');
            setDateRange({ from, to });
        } else {
            // Default check if we should set default date
            // Only set default if NO hardcoded date found later
        }

        if (sqlParam) {
            if (/%(0A|20|3D|27|2C|28|29)/i.test(sqlParam)) {
                try {
                    sqlParam = decodeURIComponent(sqlParam);
                } catch (e) {
                    console.warn('Failed to decode potentially double-encoded SQL:', e);
                }
            }

            // DETECT AND REPLACE HARDCODED VALUES
            let modifiedSql = sqlParam;

            // 1. Hardcoded Website ID
            // Matches: website_id = '...' 
            const websiteIdMatch = modifiedSql.match(/website_id\s*=\s*['"]([0-9a-f-]{36})['"]/i);
            if (websiteIdMatch) {
                const foundId = websiteIdMatch[1];
                setWebsiteIdState(foundId);
                // Replace with {{website_id}}
                modifiedSql = modifiedSql.replace(/website_id\s*=\s*['"][0-9a-f-]{36}['"]/gi, "website_id = {{website_id}}");
            }

            // 2. Hardcoded Date Range
            // Matches: created_at BETWEEN TIMESTAMP('...') AND TIMESTAMP('...')
            // Note: Updated regex to handle table names with hyphens and backticks: [\w\-`.]*
            const dateMatch = modifiedSql.match(/created_at\s+BETWEEN\s+TIMESTAMP\('([^']+)'[^)]*\)\s+AND\s+TIMESTAMP\('([^']+)'[^)]*\)/i);
            if (dateMatch) {
                const startStr = dateMatch[1];
                const endStr = dateMatch[2];
                // Only override if not already set by URL params
                if (!dateRangeFromUrl) {
                    setPeriod('custom');
                    setDateRange({ from: new Date(startStr), to: new Date(endStr) });
                }
                // Replace the ENTIRE condition with [[AND {{created_at}} ]]
                // Regex to find "AND table.created_at BETWEEN ..." or just "created_at BETWEEN ..."
                const fullDateRegex = /(AND\s+)?[\w\-`.]*created_at\s+BETWEEN\s+TIMESTAMP\('([^']+)'[^)]*\)\s+AND\s+TIMESTAMP\('([^']+)'[^)]*\)/gi;
                modifiedSql = modifiedSql.replace(fullDateRegex, " [[AND {{created_at}} ]]");
            } else if (!dateRangeFromUrl) {
                // No hardcoded date, and no URL param: set default last 30 days
                setPeriod('last_30_days');
                setDateRange({ from: subDays(now, 30), to: now });
            }

            // 3. Hardcoded URL Path
            // Matches: url_path = '/some/path'
            // We need to be careful not to match joins, so look for literal strings that start with /
            const urlPathMatch = modifiedSql.match(/url_path\s*=\s*'(\/[^']*)'/i);
            if (urlPathMatch) {
                const foundPath = urlPathMatch[1];
                setUrlPath(foundPath);
                // Replace with [[AND {{url_sti}} ]] logic
                // Using a slightly more complex replacement to handle the "AND" correctly
                // Updated regex to handle table names with hyphens and backticks: [\w\-`.]*
                const fullUrlRegex = /(AND\s+)?[\w\-`.]*url_path\s*=\s*'(\/[^']*)'/gi;
                modifiedSql = modifiedSql.replace(fullUrlRegex, " [[AND {{url_sti}} ]]");
            }

            setQuery(modifiedSql);
        } else {
            setError('Ingen SQL-spørring funnet i URL. Del en lenke med ?sql= parameter.');
        }
    }, []);

    // Detect placeholders (Runs when query changes)
    useEffect(() => {
        if (!query) return;

        const datePattern = /\[\[\s*AND\s*\{\{created_at\}\}\s*\]\]/i;
        setHasMetabaseDateFilter(datePattern.test(query));

        // Expanded detection to include the simplified patterns we might inject
        const urlPathPattern = /\[\[\s*\{\{url_sti\}\}\s*--\s*\]\]\s*'\/'/i;
        const andUrlPathPattern = /\[\[\s*AND\s*\{\{url_sti\}\}\s*\]\]/i;
        const urlPathPattern2 = /\[\[\s*\{\{url_path\}\}\s*--\s*\]\]\s*'\/'/i;
        const andUrlPathPattern2 = /\[\[\s*AND\s*\{\{url_path\}\}\s*\]\]/i;
        setHasUrlPathFilter(
            urlPathPattern.test(query) ||
            andUrlPathPattern.test(query) ||
            urlPathPattern2.test(query) ||
            andUrlPathPattern2.test(query)
        );

        setHasWebsiteIdPlaceholder(/\{\{\s*website_id\s*\}\}/i.test(query));
        setHasNettsidePlaceholder(/\{\{\s*nettside\s*\}\}/i.test(query));

        // We removed hasHardcodedWebsiteId reliance because we rewrite it to a placeholder now

        const allVariablesRegex = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/gi;
        const matches = [...query.matchAll(allVariablesRegex)];
        const knownVariables = ['website_id', 'nettside', 'created_at', 'url_sti', 'url_path'];
        const detectedVars = matches.map(m => m[1]).filter(v => !knownVariables.includes(v.toLowerCase())).filter((v, i, arr) => arr.indexOf(v) === i);
        setCustomVariables(detectedVars);
    }, [query]);

    // Fetch available websites
    useEffect(() => {
        if (availableWebsites.length > 0) return;
        fetch('/api/bigquery/websites')
            .then(res => res.json())
            .then((res: { data: Website[] }) => setAvailableWebsites(res.data || []))
            .catch(console.error);
    }, [availableWebsites.length]);

    // Auto-select website if ID is set in state
    useEffect(() => {
        if (!websiteIdState || availableWebsites.length === 0) return;

        // Don't override if already selected correctly
        if (selectedWebsite && selectedWebsite.id === websiteIdState) return;

        const match = availableWebsites.find(w => w.id === websiteIdState);
        if (match) {
            setSelectedWebsite(match);
        }
    }, [websiteIdState, availableWebsites, selectedWebsite]);

    const executeQuery = async (queryToExecute: string) => {
        setLoading(true);
        setError(null);
        setQueryStats(null);

        const processedSql = applyUrlFiltersToSql(queryToExecute);
        console.log('Executing processed SQL:', processedSql);

        try {
            const response = await fetch('/api/bigquery', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: processedSql, analysisType: 'Grafdeling' }),
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Query failed');

            setResult(data);
            setQueryStats(data.queryStats);
        } catch (err: any) {
            setError(err.message || 'An error occurred');
        } finally {
            setLoading(false);
        }
    };

    const handleRetry = () => {
        if (query) executeQuery(query);
    };

    // Prepare chart data functions
    const prepareLineChartData = (includeAverage: boolean = false) => {
        if (!result || !result.data || result.data.length === 0) return null;
        const data = result.data;
        const keys = Object.keys(data[0]);

        if (keys.length < 2) return null;

        if (keys.length === 3) {
            const xKey = keys[0];
            const seriesKey = keys[1];
            const yKey = keys[2];
            const seriesMap = new Map<string, any[]>();

            data.forEach((row: any) => {
                const rawSeriesValue = row[seriesKey];
                const translatedSeriesValue = translateValue(seriesKey, rawSeriesValue);
                const seriesValue = String(translatedSeriesValue || 'Ukjent');
                if (!seriesMap.has(seriesValue)) seriesMap.set(seriesValue, []);

                const xValue = row[xKey];
                const yValue = typeof row[yKey] === 'number' ? row[yKey] : parseFloat(row[yKey]) || 0;
                let x: number | Date;
                if (typeof xValue === 'string' && xValue.match(/^\d{4}-\d{2}-\d{2}/)) x = new Date(xValue);
                else if (typeof xValue === 'number') x = xValue;
                else x = new Date(xValue).getTime() || 0;

                seriesMap.get(seriesValue)!.push({ x, y: yValue, xAxisCalloutData: String(xValue), yAxisCalloutData: String(yValue) });
            });

            const colors = ['#0067C5', '#FF9100', '#06893A', '#C30000', '#634689', '#A8874C', '#005B82', '#E18AAA'];
            const lineChartData = Array.from(seriesMap.entries()).map(([seriesName, points], index) => ({
                legend: seriesName,
                data: points,
                color: colors[index % colors.length],
                lineOptions: { lineBorderWidth: '2' },
            }));

            if (includeAverage) {
                const allXValues = new Set<number>();
                lineChartData.forEach(series => series.data.forEach((point: any) => allXValues.add(point.x instanceof Date ? point.x.getTime() : Number(point.x))));
                const averagePoints = Array.from(allXValues).sort((a, b) => a - b).map(xVal => {
                    const yValues: number[] = [];
                    lineChartData.forEach(series => {
                        const point = series.data.find((p: any) => (p.x instanceof Date ? p.x.getTime() : Number(p.x)) === xVal);
                        if (point) yValues.push(point.y);
                    });
                    const avgY = yValues.length > 0 ? yValues.reduce((sum, val) => sum + val, 0) / yValues.length : 0;
                    return { x: new Date(xVal), y: avgY, xAxisCalloutData: String(xVal), yAxisCalloutData: avgY.toFixed(2) };
                });
                lineChartData.push({ legend: 'Gjennomsnitt', data: averagePoints, color: '#262626', lineOptions: { lineBorderWidth: '2', strokeDasharray: '5 5' } as any });
            }
            return { data: { lineChartData }, enabledLegendsWrapLines: true };
        }

        const xKey = keys[0];
        const yKey = keys[1];
        const chartPoints = data.map((row: any, index: number) => {
            const xValRaw = row[xKey];
            const xValue = (xValRaw && typeof xValRaw === 'object' && 'value' in xValRaw) ? xValRaw.value : xValRaw;
            const yValue = typeof row[yKey] === 'number' ? row[yKey] : parseFloat(row[yKey]) || 0;
            let x: number | Date;
            if (typeof xValue === 'string' && xValue.match(/^\d{4}-\d{2}-\d{2}/)) x = new Date(xValue);
            else if (typeof xValue === 'number') x = xValue;
            else x = index;
            return { x, y: yValue, xAxisCalloutData: String(xValue), yAxisCalloutData: String(yValue) };
        });

        const lineChartData: any[] = [{ legend: yKey, data: chartPoints, color: '#0067C5', lineOptions: { lineBorderWidth: '2' } }];
        if (includeAverage) {
            const avgY = chartPoints.reduce((sum: number, point: any) => sum + point.y, 0) / chartPoints.length;
            const averageLinePoints = chartPoints.map((point: any) => ({ x: point.x, y: avgY, xAxisCalloutData: point.xAxisCalloutData, yAxisCalloutData: avgY.toFixed(2) }));
            lineChartData.push({ legend: 'Gjennomsnitt', data: averageLinePoints, color: '#262626', lineOptions: { lineBorderWidth: '2', strokeDasharray: '5 5' } as any });
        }
        return { data: { lineChartData }, enabledLegendsWrapLines: true };
    };

    const prepareBarChartData = () => {
        if (!result || !result.data || result.data.length === 0) return null;
        const data = result.data;
        if (data.length > 12) return null;
        const keys = Object.keys(data[0]);
        if (keys.length < 2) return null;
        const labelKey = keys[0];
        const valueKey = keys[1];
        const total = data.reduce((sum: number, row: any) => sum + (typeof row[valueKey] === 'number' ? row[valueKey] : parseFloat(row[valueKey]) || 0), 0);
        const barChartData = data.map((row: any, index: number) => {
            const value = typeof row[valueKey] === 'number' ? row[valueKey] : parseFloat(row[valueKey]) || 0;
            const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : '0';
            const rawLabel = row[labelKey];
            const translatedLabel = translateValue(labelKey, rawLabel);
            const label = String(translatedLabel || 'Ukjent');
            return { x: label, y: value, xAxisCalloutData: label, yAxisCalloutData: `${value} (${percentage}%)`, color: ['#0067C5', '#FF9100', '#06893A', '#C30000', '#634689', '#A8874C', '#005B82', '#E18AAA'][index % 8], legend: label };
        });
        return { data: barChartData, barWidth: 'auto' as 'auto', yAxisTickCount: 5, enableReflow: true, legendProps: { allowFocusOnLegends: true, canSelectMultipleLegends: false, styles: { root: { display: 'flex', flexWrap: 'wrap', rowGap: '8px', columnGap: '16px', maxWidth: '100%', fontSize: '16px' }, legend: { marginRight: 0, fontSize: '16px' } } } };
    };

    const preparePieChartData = () => {
        if (!result || !result.data || result.data.length === 0) return null;
        const data = result.data;
        if (data.length > 12) return null;
        const keys = Object.keys(data[0]);
        if (keys.length < 2) return null;
        const labelKey = keys[0];
        const valueKey = keys[1];
        const total = data.reduce((sum: number, row: any) => sum + (typeof row[valueKey] === 'number' ? row[valueKey] : parseFloat(row[valueKey]) || 0), 0);
        const pieChartData = data.map((row: any) => {
            const value = typeof row[valueKey] === 'number' ? row[valueKey] : parseFloat(row[valueKey]) || 0;
            const rawLabel = row[labelKey];
            const translatedLabel = translateValue(labelKey, rawLabel);
            const label = String(translatedLabel || 'Ukjent');
            return { y: value, x: label };
        });
        return { data: pieChartData, total };
    };

    const renderContent = () => {
        if (loading && !result) {
            return (
                <div className="flex flex-col items-center justify-center py-16">
                    <Loader size="3xlarge" title="Laster data..." />
                    <BodyLong className="mt-4 text-[var(--ax-text-subtle)]">Henter data...</BodyLong>
                </div>
            );
        }
        if (error && !loading) {
            return (
                <Alert variant="error"><BodyLong>{error}</BodyLong></Alert>
            );
        }
        if (!loading && !error && result) {
            return (
                <ResultsPanel
                    result={result}
                    loading={loading}
                    error={error}
                    queryStats={queryStats}
                    lastAction={null}
                    showLoadingMessage={loading}
                    executeQuery={handleRetry}
                    handleRetry={handleRetry}
                    prepareLineChartData={prepareLineChartData}
                    prepareBarChartData={prepareBarChartData}
                    preparePieChartData={preparePieChartData}
                    hideHeading={true}
                    sql={query}
                    showSqlCode={true}
                    showEditButton={true}
                    hiddenTabs={result && result.data && result.data.length > 12 ? ['barchart', 'piechart'] : []}
                    containerStyle="white"
                    websiteId={websiteId}
                />
            );
        }
        return null;
    };

    const hasFilters = hasMetabaseDateFilter || hasUrlPathFilter || hasWebsiteIdPlaceholder || hasNettsidePlaceholder || customVariables.length > 0;

    // Auto-execute query when filters change (debounced)
    useEffect(() => {
        if (!query || !hasFilters) return;

        const timer = setTimeout(() => {
            executeQuery(query);
        }, 800);

        return () => clearTimeout(timer);
    }, [websiteIdState, dateRange, urlPath, customVariableValues, hasFilters]);

    const filtersContent = hasFilters ? (
        <div className="space-y-6">
            {(hasWebsiteIdPlaceholder || hasNettsidePlaceholder) && (
                <WebsitePicker
                    selectedWebsite={selectedWebsite}
                    onWebsiteChange={(website) => {
                        setSelectedWebsite(website);
                        if (website) setWebsiteIdState(website.id);
                    }}
                />
            )}

            {hasMetabaseDateFilter && (
                <PeriodPicker
                    period={period}
                    startDate={dateRange.from}
                    endDate={dateRange.to}
                    onPeriodChange={(p) => {
                        setPeriod(p);
                        if (p !== 'custom') {
                            const now = new Date();
                            if (p === 'current_month') {
                                setDateRange({ from: new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1)), to: now });
                            } else if (p === 'last_month') {
                                setDateRange({ from: new Date(now.getFullYear(), now.getMonth() - 1, 1), to: new Date(now.getFullYear(), now.getMonth(), 0) });
                            } else {
                                setDateRange({ from: subDays(now, 30), to: now });
                            }
                        }
                    }}
                    onStartDateChange={(date) => setDateRange(prev => ({ ...prev, from: date }))}
                    onEndDateChange={(date) => setDateRange(prev => ({ ...prev, to: date }))}
                />
            )}

            {hasUrlPathFilter && (
                <TextField
                    label="URL-sti"
                    size="small"
                    value={urlPath}
                    onChange={(e) => setUrlPath(e.target.value)}
                />
            )}

            {customVariables.map(varName => (
                <TextField
                    key={varName}
                    label={varName}
                    size="small"
                    value={customVariableValues[varName] || ''}
                    onChange={(e) => setCustomVariableValues(prev => ({ ...prev, [varName]: e.target.value }))}
                />
            ))}

            <div className="pt-2">
                <Button onClick={() => executeQuery(query)} size="small" className="w-full">
                    Oppdater graf
                </Button>
            </div>
        </div>
    ) : null;

    return (
        <ChartLayout
            title={description || 'Umami grafdeling'}
            description={dashboardTitle ? `Fra dashboard: ${dashboardTitle}` : "Delt visualisering fra Umami"}
            currentPage="grafdeling"
            hideSidebar={false}
            hideAnalysisSelector={true}
            filters={filtersContent}
        >
            {renderContent()}
        </ChartLayout>
    );
}

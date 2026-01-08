import { useState, useEffect } from 'react';
import { Loader, Alert, Table, Pagination } from '@navikt/ds-react';
import { ILineChartDataPoint, LineChart, ResponsiveContainer } from '@fluentui/react-charting';
import { SavedChart } from '../data/dashboard/types';
import { format, subDays } from 'date-fns';
import { getBaseUrl } from '../lib/environment';
import { translateValue } from '../lib/translations';
// @ts-ignore
import SiteScores from './SiteScores';
// @ts-ignore
import SiteGroupScores from './SiteGroupScores';
import teamsData from '../data/teamsData.json';

interface DashboardWidgetProps {
    chart: SavedChart;
    websiteId: string;
    selectedWebsite?: any;
    filters: {
        urlFilters: string[];
        dateRange: string;
        pathOperator: string;
        metricType: 'visitors' | 'pageviews' | 'proportion';
        customStartDate?: Date;
        customEndDate?: Date;
    };
    onDataLoaded?: (stats: { id: string; gb: number; title: string }) => void;
    // Pre-fetched data from batched query (optional - if provided, skip individual fetch)
    prefetchedData?: any[];
    // If true, this chart is being batch-loaded and should wait instead of fetching individually
    shouldWaitForBatch?: boolean;
    // Siteimprove group ID for group-level scoring (from custom filter selection)
    siteimproveGroupId?: string;
}

export const DashboardWidget = ({ chart, websiteId, filters, onDataLoaded, selectedWebsite, prefetchedData, shouldWaitForBatch, siteimproveGroupId }: DashboardWidgetProps) => {
    // Initialize loading=true if we're a batchable widget (so we wait for batch data)
    const [loading, setLoading] = useState(shouldWaitForBatch ?? false);
    const [error, setError] = useState<string | null>(null);
    const [data, setData] = useState<any[]>([]);
    const [page, setPage] = useState(1);
    // Track if individual fetch has been done to prevent repeat fetches
    const [hasFetchedIndividually, setHasFetchedIndividually] = useState(false);

    // If prefetchedData is available, use it directly instead of fetching
    useEffect(() => {
        if (prefetchedData !== undefined) {
            setData(prefetchedData);
            setLoading(false);
            setError(null);
            setPage(1);
            setHasFetchedIndividually(false); // Reset since we got batch data
            return;
        }
    }, [prefetchedData]);

    // Reset fetch flag when filters change (to allow refetch with new params)
    useEffect(() => {
        setHasFetchedIndividually(false);
    }, [websiteId, filters]);

    useEffect(() => {
        // Skip if we already have batch data
        if (prefetchedData !== undefined) return;

        // If told to wait for batch, just ensure loading state is shown
        if (shouldWaitForBatch) {
            setLoading(true);
            return;
        }

        // If we've already fetched individually, don't fetch again
        if (hasFetchedIndividually) return;

        const fetchData = async () => {
            if (!chart.sql) return;

            setLoading(true);
            setError(null);

            try {
                let processedSql = chart.sql;

                // 1. Substitute website_id
                processedSql = processedSql.replace(/{{website_id}}/g, websiteId);

                // 2. Substitute URL Path
                // Pattern: [[ {{url_sti}} --]] 'default_value'
                // This pattern looks for the block [[ {{url_sti}} --]] and the following token which is usually the default.
                // However, based on the specific strings seen:
                // ... url_path = [[ {{url_sti}} --]] '/'
                // We should handle the metabase-like syntax manually or regex.

                // Simple regex to catch the block:  `\[\[\s*\{\{url_sti\}\}\s*--\s*\]\]`
                // And we need to find what comes after it to decide what to do?
                // Actually, the user's syntax in SQLPreview was:
                // `url_path = [[ {{url_sti}} --]] '/'`
                // If filters.urlFilters has values, we replace `[[ {{url_sti}} --]] '/'` with `'value'` or `'value1', 'value2'`.
                // If empty, we replace `[[ {{url_sti}} --]]` with nothing? No, that leaves `url_path = '/'`. 
                // Wait. `url_path = [[ {{url_sti}} --]] '/'`
                // If I have a value: `url_path = 'my/path'`
                // If no value: `url_path = '/'`
                // So I need to replace the WHOLE sequence `[[ {{url_sti}} --]] '/'` with the active value.

                if (filters.urlFilters.length > 0) {
                    const operator = filters.pathOperator || 'equals';

                    // Regex to capture the context around the template block
                    // We need to handle both "url_path = [[ {{url_sti}} --]] '/'" patterns
                    // For multiple values with starts-with, we need OR conditions
                    // For multiple values with equals, we use IN clause

                    if (operator === 'starts-with') {
                        if (filters.urlFilters.length === 1) {
                            // Single value: simple LIKE
                            const assignmentRegex = /=\s*\[\[\s*\{\{url_sti\}\}\s*--\s*\]\]\s*('[^']+')/gi;
                            processedSql = processedSql.replace(assignmentRegex, `LIKE '${filters.urlFilters[0]}%'`);
                        } else {
                            // Multiple values: need to replace "url_path = [[ ... ]] '/'" with "(url_path LIKE 'x%' OR url_path LIKE 'y%')"
                            // First, identify the column name before the = sign
                            const multiLikeRegex = /(\S+)\s*=\s*\[\[\s*\{\{url_sti\}\}\s*--\s*\]\]\s*('[^']+')/gi;
                            processedSql = processedSql.replace(multiLikeRegex, (_match, column) => {
                                const likeConditions = filters.urlFilters.map(p => `${column} LIKE '${p}%'`).join(' OR ');
                                return `(${likeConditions})`;
                            });
                        }
                    } else {
                        // equals operator - support multiple values with IN clause
                        const assignmentRegex = /=\s*\[\[\s*\{\{url_sti\}\}\s*--\s*\]\]\s*('[^']+')/gi;
                        if (filters.urlFilters.length === 1) {
                            processedSql = processedSql.replace(assignmentRegex, `= '${filters.urlFilters[0]}'`);
                        } else {
                            // Multiple values: use IN clause
                            const quotedPaths = filters.urlFilters.map(p => `'${p}'`).join(', ');
                            processedSql = processedSql.replace(assignmentRegex, `IN (${quotedPaths})`);
                        }
                    }
                } else {
                    // If no filters, replace just the `[[...]]` part with empty string? 
                    // No, `[[ {{url_sti}} --]]` acts as a comment marker that says "if variable is missing, use what follows".
                    // So we remove the marker `[[ {{url_sti}} --]]` effectively enabling the default value `'/'`.
                    processedSql = processedSql.replace(/\[\[\s*\{\{url_sti\}\}\s*--\s*\]\]/gi, "");
                }

                // 3. Substitute Date / Created At
                // Pattern: `[[AND {{created_at}} ]]`
                // This is a Metabase conditional clause. If we have a date range, we substitute it with `AND created_at BETWEEN ...`
                // If not, we remove the block.

                // Calculate dates
                const now = new Date();
                let startDate: Date;
                let endDate = now;

                if (filters.dateRange === 'custom' && filters.customStartDate && filters.customEndDate) {
                    startDate = filters.customStartDate;
                    endDate = filters.customEndDate;
                } else if (filters.dateRange === 'this-month') {
                    startDate = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));
                } else if (filters.dateRange === 'last-month') {
                    startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                    endDate = new Date(now.getFullYear(), now.getMonth(), 0);
                } else {
                    startDate = subDays(now, 30);
                }

                const fromSql = `TIMESTAMP('${format(startDate, 'yyyy-MM-dd')}')`;
                const toSql = `TIMESTAMP('${format(endDate, 'yyyy-MM-dd')}T23:59:59')`;

                const dateReplacement = `AND \`team-researchops-prod-01d6.umami.public_website_event\`.created_at BETWEEN ${fromSql} AND ${toSql}`;

                // Replace the block
                processedSql = processedSql.replace(/\[\[\s*AND\s*\{\{created_at\}\}\s*\]\]/gi, dateReplacement);

                // 4. Handle metric type (visitors vs pageviews vs proportion)
                if (filters.metricType === 'pageviews') {
                    // Replace COUNT(DISTINCT [table.]session_id) as Unike_besokende with COUNT(*) as Sidevisninger
                    // Handle both "base_query.session_id" and plain "session_id"
                    processedSql = processedSql.replace(
                        /COUNT\s*\(\s*DISTINCT\s+(?:[a-zA-Z_\.]+\.)?session_id\s*\)\s+as\s+Unike_besokende/gi,
                        'COUNT(*) as Sidevisninger'
                    );
                    // Also replace any standalone references to Unike_besokende (e.g., in ORDER BY)
                    processedSql = processedSql.replace(/\bUnike_besokende\b/g, 'Sidevisninger');
                } else if (filters.metricType === 'proportion') {
                    // Replace COUNT(DISTINCT) with a percentage calculation
                    // IMPORTANT: Use ALL site visitors as denominator, not just filtered visitors
                    // This makes proportion meaningful when using path filters
                    const totalSiteVisitorsSubquery = `(SELECT COUNT(DISTINCT session_id) FROM \`team-researchops-prod-01d6.umami.public_website_event\` WHERE website_id = '${websiteId}' AND event_type = 1 AND created_at BETWEEN ${fromSql} AND ${toSql})`;

                    processedSql = processedSql.replace(
                        /COUNT\s*\(\s*DISTINCT\s+(?:([a-zA-Z_\.]+)\.)?session_id\s*\)\s+as\s+Unike_besokende/gi,
                        (_match, tablePrefix) => {
                            const sessionRef = tablePrefix ? `${tablePrefix}.session_id` : 'session_id';
                            return `CONCAT(CAST(ROUND(COUNT(DISTINCT ${sessionRef}) * 100.0 / ${totalSiteVisitorsSubquery}, 1) AS STRING), '%') as Andel`;
                        }
                    );
                    // Also replace any standalone references to Unike_besokende (e.g., in ORDER BY)
                    processedSql = processedSql.replace(/\bUnike_besokende\b/g, 'Andel');
                }


                const response = await fetch('/api/bigquery', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ query: processedSql, analysisType: 'Dashboard' }),
                });

                if (!response.ok) {
                    const err = await response.json();
                    throw new Error(err.error || 'Feil ved henting av data');
                }

                const result = await response.json();
                setData(result.data || []);

                if (result.queryStats && onDataLoaded) {
                    const gb = result.queryStats.totalBytesProcessed ? (result.queryStats.totalBytesProcessed / (1024 ** 3)) : 0;
                    onDataLoaded({
                        id: chart.id || '',
                        gb: gb,
                        title: chart.title
                    });
                }

                setPage(1); // Reset to first page on new data
                setHasFetchedIndividually(true); // Mark as fetched to prevent re-fetch
            } catch (err: any) {
                console.error(err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [chart.sql, websiteId, filters, prefetchedData, shouldWaitForBatch, hasFetchedIndividually]);

    // Render logic based on chart.type
    // Calculate span based on 20-column grid
    let span = 10; // Default half (50%) => 10/20
    const w = chart.width;

    if (w === 'full') span = 20;
    else if (w === 'half') span = 10;
    else if (w) {
        // Try parsing number
        const val = parseInt(w);
        if (!isNaN(val)) {
            // value is percentage (e.g. 60), map to 20 columns
            // 100% = 20 cols. 1% = 0.2 cols.
            span = Math.round(val * 0.2);
        }
    }

    // Ensure min 1 span
    span = Math.max(1, span);

    // Explicit map to ensure Tailwind JIT picks up the classes
    const SPAN_CLASSES: Record<number, string> = {
        1: 'md:col-span-1',
        2: 'md:col-span-2',
        3: 'md:col-span-3',
        4: 'md:col-span-4',
        5: 'md:col-span-5',
        6: 'md:col-span-6',
        7: 'md:col-span-7',
        8: 'md:col-span-8',
        9: 'md:col-span-9',
        10: 'md:col-span-10',
        11: 'md:col-span-11',
        12: 'md:col-span-12',
        13: 'md:col-span-13',
        14: 'md:col-span-14',
        15: 'md:col-span-15',
        16: 'md:col-span-16',
        17: 'md:col-span-17',
        18: 'md:col-span-18',
        19: 'md:col-span-19',
        20: 'md:col-span-20',
    };

    const colClass = `col-span-full ${SPAN_CLASSES[span] || 'md:col-span-10'}`;

    if (chart.type === 'siteimprove') {
        const baseUrl = getBaseUrl({
            localUrl: "https://reops-proxy.intern.nav.no",
            prodUrl: "https://reops-proxy.ansatt.nav.no",
        });

        // If chart has siteimprove_id, use group-level scoring
        if (chart.siteimprove_id) {
            return (
                <SiteGroupScores
                    className={colClass}
                    siteId={chart.siteimprove_id}
                    portalSiteId={chart.siteimprove_portal_id}
                    groupId={siteimproveGroupId}
                    baseUrl={baseUrl}
                />
            );
        }

        // Otherwise, use page-level scoring (original behavior)
        if (!selectedWebsite) return null;

        let team = null;
        let siteDomain = selectedWebsite.domain;
        if (!siteDomain.startsWith('http')) {
            siteDomain = `https://${siteDomain}`;
        }

        try {
            // Try to match by origin if valid URL
            const urlObj = new URL(siteDomain);
            const domain = urlObj.origin;
            team = teamsData.find((t: any) => {
                if (!t.teamDomain) return false;
                // Normalize team domain to origin to ensure safely matching
                try {
                    const teamUrl = new URL(t.teamDomain);
                    return domain === teamUrl.origin;
                } catch {
                    // Fallback if teamDomain in matching data is weird
                    return domain.startsWith(t.teamDomain);
                }
            });
            console.log('[DashboardWidget] Matched team by origin:', team, 'for domain:', domain);
        } catch (e) {
            console.error('Error parsing URL:', e);
            // Fallback to direct string match or partial match
            team = teamsData.find((t: any) => t.teamDomain === selectedWebsite.domain || selectedWebsite.domain.includes(t.teamDomain) || t.teamDomain.includes(selectedWebsite.domain));
            console.log('[DashboardWidget] Matched team by string fallback:', team, 'for domain:', selectedWebsite.domain);
        }

        if (!team || !team.teamSiteimproveSite) {
            console.log('[DashboardWidget] No compatible team found or missing Siteimprove ID');
            return null;
        }

        // Construct page URL from filters
        const path = (filters.urlFilters && filters.urlFilters.length > 0) ? filters.urlFilters[0] : '/';
        // Ensure path starts with slash if not empty
        const safePath = path.startsWith('/') ? path : `/${path}`;
        const fullUrl = `${team.teamDomain}${safePath}`;

        return (
            <SiteScores
                className={colClass}
                pageUrl={fullUrl}
                siteimproveSelectedDomain={team.teamSiteimproveSite}
                baseUrl={baseUrl}
            />
        );
    }

    if (chart.type === 'title') {
        return (
            <div className={`pt-2 ${colClass}`}>
                <h2 className="text-2xl font-bold text-gray-800">{chart.title}</h2>
                {chart.description && <p className="text-gray-600 mt-1">{chart.description}</p>}
            </div>
        );
    }

    const renderContent = () => {
        if (loading) return <div className="flex justify-center p-8"><Loader /></div>;
        if (error) return <Alert variant="error">{error}</Alert>;
        if (!data || data.length === 0) return <div className="text-gray-500 p-8 text-center">Ingen data funnet</div>;

        if (chart.type === 'line') {
            const points: ILineChartDataPoint[] = data.map((row: any) => {
                const keys = Object.keys(row);
                const xVal = row[keys[0]].value || row[keys[0]]; // Handle BQ format if needed
                const yVal = parseFloat(row[keys[1]]) || 0;
                return {
                    x: new Date(xVal),
                    y: yVal,
                    legend: format(new Date(xVal), 'dd.MM'),
                    xAxisCalloutData: format(new Date(xVal), 'dd.MM'),
                    yAxisCalloutData: String(yVal)
                };
            });

            const lines = [{
                legend: chart.title,
                data: points,
                color: '#0067c5',
            }];

            return (
                <div style={{ width: '100%', height: '350px' }}>
                    <ResponsiveContainer>
                        <LineChart
                            data={{ lineChartData: lines }}
                            yAxisTickFormat={(d: any) => d.toLocaleString('nb-NO')}
                            margins={{ left: 60, right: 20, top: 20, bottom: 40 }}
                        />
                    </ResponsiveContainer>
                </div>
            );
        } else if (chart.type === 'table') {
            const rowsPerPage = 10;
            const totalRows = data.length;
            const totalPages = Math.ceil(totalRows / rowsPerPage);

            // Simple client-side pagination
            const start = (page - 1) * rowsPerPage;
            const end = start + rowsPerPage;
            const currentData = data.slice(start, end);

            return (
                <div className="flex flex-col gap-4">
                    <div className="overflow-x-auto">
                        <Table size="small">
                            <Table.Header>
                                <Table.Row>
                                    {Object.keys(data[0]).map(key => (
                                        <Table.HeaderCell key={key}>{key}</Table.HeaderCell>
                                    ))}
                                </Table.Row>
                            </Table.Header>
                            <Table.Body>
                                {currentData.map((row, i) => {
                                    const keys = Object.keys(row);
                                    return (
                                        <Table.Row key={i}>
                                            {keys.map((key, j) => {
                                                const val = row[key];
                                                const translatedVal = translateValue(key, val);
                                                const displayVal = typeof translatedVal === 'number'
                                                    ? translatedVal.toLocaleString('nb-NO')
                                                    : String(translatedVal);
                                                return (
                                                    <Table.DataCell key={j} className="whitespace-nowrap" title={String(val)}>
                                                        {displayVal}
                                                    </Table.DataCell>
                                                );
                                            })}
                                        </Table.Row>
                                    );
                                })}
                            </Table.Body>
                        </Table>
                    </div>
                    {totalRows > rowsPerPage && (
                        <div className="flex justify-center">
                            <Pagination
                                page={page}
                                onPageChange={setPage}
                                count={totalPages}
                                size="small"
                            />
                        </div>
                    )}
                </div>
            );
        }


        return <div>Ukjent diagramtype: {chart.type}</div>;
    };

    return (
        <div className={`bg-white p-6 rounded-lg border border-gray-200 shadow-sm min-h-[400px] ${colClass}`}>
            <div className="flex flex-col mb-6">
                <h2 className="text-xl font-semibold">{chart.title}</h2>
                {chart.description && (
                    <p className="text-gray-600 text-sm mt-1">{chart.description}</p>
                )}
            </div>
            {renderContent()}
        </div>
    );
};

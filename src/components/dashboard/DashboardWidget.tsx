import { useState, useEffect } from 'react';
import { Loader, Alert, Table, Pagination, Button } from '@navikt/ds-react';
import type { ILineChartDataPoint} from '@fluentui/react-charting';
import { LineChart, ResponsiveContainer } from '@fluentui/react-charting';
import { ExternalLink, MoreVertical } from 'lucide-react';
import type { SavedChart } from '../../data/dashboard';
import { format } from 'date-fns';
import { translateValue } from '../../lib/translations';
import AnalysisActionModal from '../analysis/AnalysisActionModal';
// @ts-expect-error Untyped JS module
import SiteScores from '../siteimprove/SiteScores';
// @ts-expect-error Untyped JS module
import SiteGroupScores from '../siteimprove/SiteGroupScores';
import teamsData from '../../data/teamsData.json';
import { processDashboardSql } from './dashboardQueryUtils.ts';
import ChartActionModal from '../analysis/ChartActionModal';

type JsonPrimitive = string | number | boolean | null;
interface JsonObject {
    [key: string]: JsonValue;
}
type JsonValue = JsonPrimitive | JsonObject | JsonValue[];

type DashboardRow = Record<string, unknown>;

const isRecord = (value: unknown): value is Record<string, unknown> => {
    return typeof value === 'object' && value !== null;
};

const getErrorMessage = (value: unknown, fallback: string): string => {
    if (isRecord(value) && typeof value.error === 'string') {
        return value.error;
    }
    return fallback;
};

const parseDashboardResponse = (value: unknown): { data: DashboardRow[]; totalBytesProcessed?: number } => {
    if (!isRecord(value)) return { data: [] };
    const data = Array.isArray(value.data) ? value.data.filter(isRecord) : [];
    const totalBytesProcessed = isRecord(value.queryStats) && typeof value.queryStats.totalBytesProcessed === 'number'
        ? value.queryStats.totalBytesProcessed
        : undefined;
    return { data, totalBytesProcessed };
};

type SelectedWebsite = {
    domain: string;
    // allow extra fields without using `any`
    [key: string]: unknown;
};

type TeamData = {
    teamDomain?: string;
    teamSiteimproveSite?: string | number | boolean;
    [key: string]: unknown;
};

interface DashboardWidgetProps {
    chart: SavedChart;
    websiteId: string;
    selectedWebsite?: SelectedWebsite;
    filters: {
        urlFilters: string[];
        dateRange: string;
        pathOperator: string;
        metricType: 'visitors' | 'pageviews' | 'proportion' | 'visits';
        customStartDate?: Date;
        customEndDate?: Date;
    };
    onDataLoaded?: (stats: { id: string; gb: number; title: string; totalCount?: number }) => void;
    // Pre-fetched data from batched query (optional - if provided, skip individual fetch)
    prefetchedData?: DashboardRow[];
    // If true, this chart is being batch-loaded and should wait instead of fetching individually
    shouldWaitForBatch?: boolean;
    // Siteimprove group ID for group-level scoring (from custom filter selection)
    siteimproveGroupId?: string;
    dashboardTitle?: string;
}

export const DashboardWidget = ({ chart, websiteId, filters, onDataLoaded, selectedWebsite, prefetchedData, shouldWaitForBatch, siteimproveGroupId, dashboardTitle }: DashboardWidgetProps) => {
    const [loading, setLoading] = useState(shouldWaitForBatch ?? false);
    const [error, setError] = useState<string | null>(null);
    const [data, setData] = useState<DashboardRow[]>([]);
    const [page, setPage] = useState(1);
    // Track if individual fetch has been done to prevent repeat fetches
    const [hasFetchedIndividually, setHasFetchedIndividually] = useState(false);
    // State for AnalysisActionModal (for links in table)
    const [selectedUrl, setSelectedUrl] = useState<string | null>(null);
    // State for ChartActionModal (for title click)
    const [isActionModalOpen, setIsActionModalOpen] = useState(false);



    // Helper to check if a value is a clickable URL path
    const isClickablePath = (val: unknown): val is string => {
        return typeof val === 'string' && val.startsWith('/') && val !== '/';
    };

    const formatTableValue = (val: unknown): string => {
        if (val === null || val === undefined) return '';
        if (typeof val === 'string') return val;
        if (typeof val === 'number' || typeof val === 'boolean') return String(val);
        try {
            return JSON.stringify(val);
        } catch {
            return '';
        }
    };

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
                const processedSql = processDashboardSql(chart.sql, websiteId, filters);

                const response = await fetch('/api/bigquery', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ query: processedSql, analysisType: 'Dashboard' }),
                });

                if (!response.ok) {
                    const errPayload = await response.json() as unknown;
                    throw new Error(getErrorMessage(errPayload, 'Feil ved henting av data'));
                }

                const resultPayload = await response.json() as unknown;
                const parsed = parseDashboardResponse(resultPayload);
                const resultData = parsed.data;
                setData(resultData);

                let totalCount = 0;
                if (resultData.length > 0) {
                    const keys = Object.keys(resultData[0]);
                    if (keys.length >= 2) {
                        const metricKey = keys[1];
                        totalCount = resultData.reduce((acc: number, row) => {
                            const raw = row[metricKey];
                            const val = typeof raw === 'number' ? raw : parseFloat(String(raw));
                            return Number.isFinite(val) ? acc + val : acc;
                        }, 0);
                    }
                }

                if (onDataLoaded) {
                    const bytes = parsed.totalBytesProcessed ?? 0;
                    const gb = bytes ? bytes / (1024 ** 3) : 0;
                    onDataLoaded({
                        id: chart.id || '',
                        gb,
                        title: chart.title,
                        totalCount,
                    });
                }

                setPage(1);
                setHasFetchedIndividually(true);
            } catch (err: unknown) {
                const message = err instanceof Error ? err.message : 'Ukjent feil';
                setError(message);
            } finally {
                setLoading(false);
            }
        };

        void fetchData();
    }, [
        chart.sql,
        chart.id,
        chart.title,
        websiteId,
        filters,
        prefetchedData,
        shouldWaitForBatch,
        hasFetchedIndividually,
        onDataLoaded,
    ]);

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
        const baseUrl = '/api/siteimprove';

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

        let team: TeamData | null = null;
        let siteDomain = selectedWebsite.domain;
        if (!siteDomain.startsWith('http')) {
            siteDomain = `https://${siteDomain}`;
        }

        try {
            // Try to match by origin if valid URL
            const urlObj = new URL(siteDomain);
            const domain = urlObj.origin;
            team = (teamsData as TeamData[]).find((t) => {
                if (!t.teamDomain) return false;
                // Normalize team domain to origin to ensure safely matching
                try {
                    const teamUrl = new URL(t.teamDomain);
                    return domain === teamUrl.origin;
                } catch {
                    // Fallback if teamDomain in matching data is weird
                    return domain.startsWith(t.teamDomain);
                }
            }) ?? null;
        } catch {
            // Fallback to direct string match or partial match
            team =
                (teamsData as TeamData[]).find(
                    (t) =>
                        !!t.teamDomain &&
                        (t.teamDomain === selectedWebsite.domain ||
                            selectedWebsite.domain.includes(t.teamDomain) ||
                            t.teamDomain.includes(selectedWebsite.domain))
                ) ?? null;
        }

        if (!team || !team.teamSiteimproveSite || !team.teamDomain) {
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
                <h2 className="text-2xl font-bold text-[var(--ax-text-default)]">{chart.title}</h2>
                {chart.description && <p className="text-[var(--ax-text-subtle)] mt-1">{chart.description}</p>}
            </div>
        );
    }

    const renderContent = () => {
        if (loading) return <div className="flex justify-center p-8"><Loader /></div>;
        if (error) return <Alert variant="error">{error}</Alert>;
        if (!data || data.length === 0) return <div className="text-[var(--ax-text-subtle)] p-8 text-center">Ingen data funnet</div>;

        if (chart.type === 'line') {
            const points: ILineChartDataPoint[] = data.map((row) => {
                const keys = Object.keys(row);
                const rawX = (row as Record<string, unknown>)[keys[0]];
                const xVal =
                    rawX && typeof rawX === 'object' && 'value' in (rawX as JsonObject)
                        ? (rawX as JsonObject).value
                        : rawX;

                const rawY = (row as Record<string, unknown>)[keys[1]];
                const yVal = typeof rawY === 'number' ? rawY : parseFloat(String(rawY)) || 0;

                return {
                    x: new Date(String(xVal)),
                    y: yVal,
                    legend: format(new Date(String(xVal)), 'dd.MM'),
                    xAxisCalloutData: format(new Date(String(xVal)), 'dd.MM'),
                    yAxisCalloutData: String(yVal),
                };
            });

            const lines = [{
                legend: chart.title,
                data: points,
                color: '#0067c5',
            }];

            // Generate a unique key based on data to force re-render when data changes
            // This ensures the x-axis labels are calculated with correct container dimensions
            const firstX = points[0]?.x;
            const lastX = points[points.length - 1]?.x;
            const chartKey = `line-${points.length}-${firstX instanceof Date ? firstX.getTime() : firstX || 0}-${lastX instanceof Date ? lastX.getTime() : lastX || 0}`;

            return (
                <div style={{ width: '100%', height: '350px' }}>
                    <ResponsiveContainer>
                        <LineChart
                            key={chartKey}
                            data={{ lineChartData: lines }}
                            yAxisTickFormat={(d: number) => d.toLocaleString('nb-NO')}
                            margins={{ left: 60, right: 20, top: 20, bottom: 40 }}
                            styles={{
                                xAxis: { text: { fill: 'var(--ax-text-subtle)' } },
                                yAxis: { text: { fill: 'var(--ax-text-subtle)' } },
                            }}
                            legendProps={{
                                styles: {
                                    text: { color: 'var(--ax-text-subtle)' },
                                },
                            }}
                        />
                    </ResponsiveContainer>
                </div>
            );
        } else if (chart.type === 'table') {
            // Extract __TOTAL__ row if showTotal is enabled
            let tableData = data;

            if (chart.showTotal) {
                tableData = data.filter((row) => !Object.values(row).includes('__TOTAL__'));
            }

            const rowsPerPage = 10;
            const totalRows = tableData.length;
            const totalPages = Math.ceil(totalRows / rowsPerPage);

            // Simple client-side pagination
            const start = (page - 1) * rowsPerPage;
            const end = start + rowsPerPage;
            const currentData = tableData.slice(start, end);

            return (
                <div className="flex flex-col gap-4">
                    <div className="overflow-x-auto">
                        <Table size="small">
                            <Table.Header>
                                <Table.Row>
                                    {Object.keys(tableData[0] || data[0]).map(key => (
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
                                                const val = (row as Record<string, unknown>)[key];
                                                const rawString = formatTableValue(val);
                                                const translatedVal = translateValue(key, rawString);
                                                const displayVal = typeof val === 'number'
                                                    ? val.toLocaleString('nb-NO')
                                                    : translatedVal;
                                                const clickable = isClickablePath(val);
                                                return (
                                                    <Table.DataCell
                                                        key={j}
                                                        className={`whitespace-nowrap ${clickable ? 'cursor-pointer' : ''}`}
                                                        title={rawString}
                                                        onClick={clickable ? () => setSelectedUrl(val) : undefined}
                                                    >
                                                        {clickable ? (
                                                            <span className="text-blue-600 hover:underline flex items-center gap-1">
                                                                {displayVal} <ExternalLink className="h-3 w-3" />
                                                            </span>
                                                        ) : (
                                                            displayVal
                                                        )}
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

    // Extract total value for tables with showTotal
    const tableTotalValue = chart.showTotal && chart.type === 'table' && data.length > 0 ? (() => {
        const totalRow = data.find((row) => Object.values(row).includes('__TOTAL__'));
        if (!totalRow) return null;
        const keys = Object.keys(totalRow);
        for (const key of keys) {
            const val = (totalRow as Record<string, unknown>)[key];
            if (typeof val === 'number') return val;
        }
        return null;
    })() : null;

    return (
        <>
            <div className={`bg-[var(--ax-bg-default)] p-6 rounded-lg border border-[var(--ax-border-neutral-subtle)] shadow-sm min-h-[400px] ${colClass}`}>
                <div className="flex flex-col mb-4">
                    <div className="flex items-center justify-between gap-3">
                        <h2 className="text-xl font-semibold text-[var(--ax-text-default)]">
                            {chart.title}
                        </h2>
                        {chart.sql && (
                            <Button
                                variant="tertiary"
                                size="small"
                                onClick={() => setIsActionModalOpen(true)}
                                title={`Flere valg for ${chart.title}`}
                                aria-label={`Flere valg for ${chart.title}`}
                                icon={<MoreVertical aria-hidden="true" />}
                            />
                        )}
                    </div>
                    {tableTotalValue !== null && (
                        <p className="text-lg text-[var(--ax-text-default)] mt-1">
                            {tableTotalValue.toLocaleString('nb-NO')} {filters.metricType === 'pageviews' ? 'sidevisninger totalt' : filters.metricType === 'visits' ? 'økter totalt' : 'besøk totalt'}
                        </p>
                    )}
                    {chart.description && (
                        <p className="text-[var(--ax-text-subtle)] text-sm mt-1">{chart.description}</p>
                    )}
                </div>
                {renderContent()}
            </div>

            <AnalysisActionModal
                open={!!selectedUrl}
                onClose={() => setSelectedUrl(null)}
                urlPath={selectedUrl}
                websiteId={websiteId}
                period={filters.dateRange}
                domain={selectedWebsite?.domain}
            />

            <ChartActionModal
                open={isActionModalOpen}
                onClose={() => setIsActionModalOpen(false)}
                chart={chart}
                websiteId={websiteId}
                filters={filters}
                domain={selectedWebsite?.domain}
                data={data}
                dashboardTitle={dashboardTitle}
            />
        </>
    );
};

import { useState, useEffect } from 'react';
import { Loader, Alert, Table, Pagination } from '@navikt/ds-react';
import { ILineChartDataPoint, LineChart, ResponsiveContainer } from '@fluentui/react-charting';
import { SavedChart } from '../data/dashboard/types';
import { format, subDays } from 'date-fns';

interface DashboardWidgetProps {
    chart: SavedChart;
    websiteId: string;
    filters: {
        urlFilters: string[];
        dateRange: string;
        pathOperator: string;
        metricType: 'visitors' | 'pageviews';
    };
    onDataLoaded?: (stats: { id: string; gb: number; title: string }) => void;
}

export const DashboardWidget = ({ chart, websiteId, filters, onDataLoaded }: DashboardWidgetProps) => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [data, setData] = useState<any[]>([]);
    const [page, setPage] = useState(1);

    useEffect(() => {
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

                const urlBlockRegex = /\[\[\s*\{\{url_sti\}\}\s*--\s*\]\]\s*('[^']+')/gi;

                if (filters.urlFilters.length > 0) {
                    // If we have filters, replace the whole block + default with the filter values
                    // Handling multiple values might require changing = to IN (...), but let's assume single for now or user uses =
                    // joining with OR is tricky in text replace.
                    // The user's Combobox allows multiple.
                    // If multiple: `url_path IN ('/a', '/b')`. 
                    // But the SQL has `url_path = ...`.
                    // I will just join them for now or pick the first one to avoid SQL syntax error if I don't parse the `=` sign.
                    // TODO: Better multi-value support.
                    const val = filters.urlFilters[0]; // Take first for safety
                    processedSql = processedSql.replace(urlBlockRegex, `'${val}'`);
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

                if (filters.dateRange === 'this-month') {
                    startDate = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));
                } else if (filters.dateRange === 'last-month') {
                    startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                    endDate = new Date(now.getFullYear(), now.getMonth(), 0);
                } else {
                    startDate = subDays(now, 30);
                }

                const fromSql = `TIMESTAMP('${format(startDate, 'yyyy-MM-dd')}')`;
                const toSql = `TIMESTAMP('${format(endDate, 'yyyy-MM-dd')}T23:59:59')`;

                const dateReplacement = `AND created_at BETWEEN ${fromSql} AND ${toSql}`;

                // Replace the block
                processedSql = processedSql.replace(/\[\[\s*AND\s*\{\{created_at\}\}\s*\]\]/gi, dateReplacement);


                const response = await fetch('/api/bigquery', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ query: processedSql }),
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
                        id: chart.id,
                        gb: gb,
                        title: chart.title
                    });
                }

                setPage(1); // Reset to first page on new data
            } catch (err: any) {
                console.error(err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [chart.sql, websiteId, filters]);

    // Render logic based on chart.type
    if (chart.type === 'title') {
        return (
            <div className={`col-span-1 md:col-span-2 pt-2 ${chart.width === 'half' ? 'md:col-span-1' : ''}`}>
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
            // Adapt data for LineChart
            // Assume col 0 is X (date), col 1 is Y (value)
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
                                {currentData.map((row, i) => (
                                    <Table.Row key={i}>
                                        {Object.values(row).map((val: any, j) => (
                                            <Table.DataCell key={j} className="whitespace-nowrap" title={String(val)}>
                                                {String(val)}
                                            </Table.DataCell>
                                        ))}
                                    </Table.Row>
                                ))}
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
        <div className={`bg-white p-6 rounded-lg border border-gray-200 shadow-sm min-h-[400px] ${chart.width === 'full' ? 'col-span-1 md:col-span-2' : ''}`}>
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

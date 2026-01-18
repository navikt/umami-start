import { useState, useEffect } from 'react';
import ResultsPanel from '../components/chartbuilder/results/ResultsPanel';
import { Alert, Heading, BodyLong, Loader } from '@navikt/ds-react';
import { translateValue } from '../lib/translations';

export default function Grafdeling() {
    const [query, setQuery] = useState('');
    const [result, setResult] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [description, setDescription] = useState<string>('');
    const [queryStats, setQueryStats] = useState<any>(null);

    // Extract websiteId from SQL query
    const extractWebsiteId = (sql: string): string | undefined => {
        // Match patterns like: website_id = 'uuid' or website_id='uuid'
        const match = sql.match(/website_id\s*=\s*['"]([0-9a-f-]{36})['"]/i);
        return match?.[1];
    };

    const websiteId = extractWebsiteId(query);

    // Check for SQL in URL params on mount and auto-execute
    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        let sqlParam = urlParams.get('sql');
        const descParam = urlParams.get('beskrivelse') || urlParams.get('desc');

        if (descParam) {
            setDescription(descParam);
        }

        if (sqlParam) {
            // Fix for double-encoded URLs (common issue with Slack on iOS)
            // If the string contains encoded characters that are common in SQL (newline, space, =, ', ,),
            // it likely means the URL was double-encoded.
            if (/%(0A|20|3D|27|2C|28|29)/i.test(sqlParam)) {
                try {
                    sqlParam = decodeURIComponent(sqlParam);
                } catch (e) {
                    console.warn('Failed to decode potentially double-encoded SQL:', e);
                }
            }

            setQuery(sqlParam);
            executeQuery(sqlParam);
        } else {
            setError('Ingen SQL-spørring funnet i URL. Del en lenke med ?sql= parameter.');
        }
    }, []);

    const executeQuery = async (queryToExecute: string) => {
        setLoading(true);
        setError(null);
        setResult(null);
        setQueryStats(null);

        try {
            const response = await fetch('/api/bigquery', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ query: queryToExecute, analysisType: 'Grafdeling' }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Query failed');
            }

            setResult(data);
            setQueryStats(data.queryStats);
        } catch (err: any) {
            setError(err.message || 'An error occurred');
        } finally {
            setLoading(false);
        }
    };

    const handleRetry = () => {
        if (query) {
            executeQuery(query);
        }
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

            data.forEach((row: any) => {
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
                    x = new Date(xValue);
                } else if (typeof xValue === 'number') {
                    x = xValue;
                } else {
                    x = new Date(xValue).getTime() || 0;
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

        const barChartData = data.map((row: any, index: number) => {
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
                color: ['#0067C5', '#FF9100', '#06893A', '#C30000', '#634689', '#A8874C', '#005B82', '#E18AAA'][index % 8],
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
                        fontSize: '16px',
                    },
                    legend: {
                        marginRight: 0,
                        fontSize: '16px',
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
        <div className="py-8 max-w-[1600px] mx-auto">
            <div className="mb-8">
                <Heading level="1" size="large" className="mb-2 pt-3 max-w-3xl">
                    {description ? description : 'Umami grafdeling'}
                </Heading>
            </div>

            {/* Initial Loading State */}
            {loading && !result && (
                <div className="flex flex-col items-center justify-center py-16 bg-white rounded-lg shadow-sm border border-gray-200">
                    <Loader size="3xlarge" title="Laster data..." />
                    <BodyLong className="mt-4 text-gray-600">Henter data...</BodyLong>
                </div>
            )}

            {/* Error Display */}
            {error && !loading && (
                <Alert variant="error">
                    <Heading level="3" size="small" spacing>
                        Feil
                    </Heading>
                    <BodyLong>{error}</BodyLong>
                </Alert>
            )}

            {/* Results Display - Full Width */}
            {!loading && !error && result && (
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
            )}
        </div>
    );
}

import type { ComponentType } from 'react';
import { Label, Loader, Select, Switch } from '@navikt/ds-react';
import { LineChart, ResponsiveContainer } from '@fluentui/react-charting';
import type { ILineChartProps } from '@fluentui/react-charting';
import TrafficStats from './TrafficStats';
import type { Website } from '../../../types/chart';

type Granularity = 'day' | 'week' | 'month' | 'hour';

type ComparisonSummary = {
    currentValue: number;
    previousValue: number;
    deltaValue: number;
    deltaPercent: number | null;
};

type ComparisonRangeLabel = {
    current: string;
    previous: string;
};

type SeriesPoint = {
    time: string;
    count: number;
};

type IncludedPageRow = {
    name: string;
    count: number;
    previousCount?: number;
    deltaCount?: number;
};

type ChartDataTableProps = {
    data: SeriesPoint[];
    previousData: SeriesPoint[];
    metricLabel: string;
    submittedDateRange: { startDate: Date; endDate: Date } | null;
    submittedPreviousDateRange: { startDate: Date; endDate: Date } | null;
};

type TrafficTableProps = {
    title: string;
    data: IncludedPageRow[];
    onRowClick?: (name: string) => void;
    selectedWebsite: Website | null;
    metricLabel: string;
    showCompare?: boolean;
};

type OversiktTabContentProps = {
    hasAttemptedFetch: boolean;
    isLoadingPageMetrics: boolean;
    hasFetchedPageMetrics: boolean;
    submittedComparePreviousPeriod: boolean;
    comparisonSummary: ComparisonSummary | null;
    comparisonRangeLabel: ComparisonRangeLabel | null;
    submittedDateRange: { startDate: Date; endDate: Date } | null;
    submittedPreviousDateRange: { startDate: Date; endDate: Date } | null;
    formatComparisonValue: (value: number) => string;
    formatComparisonDelta: (value: number) => string;
    seriesData: SeriesPoint[];
    submittedMetricType: string;
    totalOverride?: number;
    submittedGranularity: Granularity;
    showAverage: boolean;
    onShowAverageChange: (checked: boolean) => void;
    comparePreviousPeriod: boolean;
    onComparePreviousPeriodChange: (checked: boolean) => void;
    granularity: Granularity;
    onGranularityChange: (value: Granularity) => void;
    chartData: ILineChartProps['data'] | null;
    chartYMax: number;
    chartYMin: number;
    chartKey: string;
    processedSeriesData: SeriesPoint[];
    processedPreviousSeriesData: SeriesPoint[];
    getMetricLabelWithCount: (type: string) => string;
    includedPagesWithCompare: IncludedPageRow[];
    onSelectInternalUrl: (name: string) => void;
    selectedWebsite: Website | null;
    getMetricLabelCapitalized: (type: string) => string;
    ChartDataTableComponent: ComponentType<ChartDataTableProps>;
    TrafficTableComponent: ComponentType<TrafficTableProps>;
};

const OversiktTabContent = ({
    hasAttemptedFetch,
    isLoadingPageMetrics,
    hasFetchedPageMetrics,
    submittedComparePreviousPeriod,
    comparisonSummary,
    comparisonRangeLabel,
    submittedDateRange,
    submittedPreviousDateRange,
    formatComparisonValue,
    formatComparisonDelta,
    seriesData,
    submittedMetricType,
    totalOverride,
    submittedGranularity,
    showAverage,
    onShowAverageChange,
    comparePreviousPeriod,
    onComparePreviousPeriodChange,
    granularity,
    onGranularityChange,
    chartData,
    chartYMax,
    chartYMin,
    chartKey,
    processedSeriesData,
    processedPreviousSeriesData,
    getMetricLabelWithCount,
    includedPagesWithCompare,
    onSelectInternalUrl,
    selectedWebsite,
    getMetricLabelCapitalized,
    ChartDataTableComponent,
    TrafficTableComponent,
}: OversiktTabContentProps) => {
    if (hasAttemptedFetch && (isLoadingPageMetrics || !hasFetchedPageMetrics)) {
        return (
            <div className="flex justify-center items-center h-full py-16">
                <Loader size="xlarge" title="Henter data..." />
            </div>
        );
    }

    return (
        <>
            {!submittedComparePreviousPeriod && (
                <TrafficStats
                    data={seriesData}
                    metricType={submittedMetricType}
                    totalOverride={totalOverride}
                    granularity={submittedGranularity}
                />
            )}
            {submittedComparePreviousPeriod && comparisonSummary && comparisonRangeLabel && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div className="bg-[var(--ax-bg-default)] p-4 rounded-lg border border-[var(--ax-border-neutral-subtle)] shadow-sm">
                        <div className="text-sm text-[var(--ax-text-default)] font-medium mb-1">Denne perioden</div>
                        <div className="text-2xl font-bold text-[var(--ax-text-default)]">
                            {formatComparisonValue(comparisonSummary.currentValue)}
                        </div>
                        <div className="text-sm text-[var(--ax-text-subtle)] mt-1">{comparisonRangeLabel.current}</div>
                    </div>
                    <div className="bg-[var(--ax-bg-default)] p-4 rounded-lg border border-[var(--ax-border-neutral-subtle)] shadow-sm">
                        <div className="text-sm text-[var(--ax-text-default)] font-medium mb-1">Forrige periode</div>
                        <div className="text-2xl font-bold text-[var(--ax-text-default)]">
                            {formatComparisonValue(comparisonSummary.previousValue)}
                        </div>
                        <div className="text-sm text-[var(--ax-text-subtle)] mt-1">{comparisonRangeLabel.previous}</div>
                    </div>
                    <div className="bg-[var(--ax-bg-default)] p-4 rounded-lg border border-[var(--ax-border-neutral-subtle)] shadow-sm">
                        <div className="text-sm text-[var(--ax-text-default)] font-medium mb-1">Endring</div>
                        <div className={`text-2xl font-bold ${comparisonSummary.deltaPercent !== null ? (comparisonSummary.deltaPercent > 0 ? 'text-green-700' : comparisonSummary.deltaPercent < 0 ? 'text-red-700' : 'text-[var(--ax-text-default)]') : 'text-[var(--ax-text-default)]'}`}>
                            {comparisonSummary.deltaPercent === null
                                ? '–'
                                : `${comparisonSummary.deltaPercent >= 0 ? '+' : ''}${comparisonSummary.deltaPercent.toFixed(1)}%`}
                        </div>
                        <div className="text-sm text-[var(--ax-text-subtle)] mt-1">
                            {formatComparisonDelta(comparisonSummary.deltaValue)}
                        </div>
                    </div>
                </div>
            )}
            <div className="flex flex-col gap-8">
                <div className="flex flex-col gap-4">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-2">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4 w-full sm:w-auto">
                            <Switch
                                checked={showAverage}
                                onChange={(e) => onShowAverageChange(e.target.checked)}
                                size="small"
                            >
                                Vis gjennomsnitt
                            </Switch>
                            <Switch
                                checked={comparePreviousPeriod}
                                onChange={(e) => onComparePreviousPeriodChange(e.target.checked)}
                                size="small"
                            >
                                Sammenlign forrige periode
                            </Switch>
                        </div>
                        <div className="flex items-center gap-2">
                            <Label size="small" htmlFor="traffic-granularity">Intervall</Label>
                            <Select
                                id="traffic-granularity"
                                label="Tidsoppløsning"
                                hideLabel
                                size="small"
                                value={granularity}
                                onChange={(e) => onGranularityChange(e.target.value as Granularity)}
                            >
                                <option value="day">Daglig</option>
                                <option value="week">Ukentlig</option>
                                <option value="month">Månedlig</option>
                                <option value="hour">Time</option>
                            </Select>
                        </div>
                    </div>
                    <div style={{ width: '100%', height: '400px' }}>
                        {chartData ? (
                            <ResponsiveContainer>
                                <LineChart
                                    key={chartKey}
                                    data={chartData}
                                    legendsOverflowText={'Overflow Items'}
                                    yAxisTickFormat={(d: number | string) => submittedMetricType === 'proportion' ? `${Number(d).toFixed(1)}%` : Number(d).toLocaleString('nb-NO')}
                                    yAxisTickCount={6}
                                    yMaxValue={chartYMax}
                                    yMinValue={chartYMin}
                                    allowMultipleShapesForPoints={true}
                                    enablePerfOptimization={true}
                                    margins={{ left: 85, right: 40, top: 20, bottom: 35 }}
                                    legendProps={{
                                        allowFocusOnLegends: true,
                                        styles: {
                                            text: { color: 'var(--ax-text-default)' },
                                        }
                                    }}
                                />
                            </ResponsiveContainer>
                        ) : (
                            <div className="flex items-center justify-center h-full text-gray-500">
                                Ingen data tilgjengelig for diagram
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex flex-col md:flex-row gap-8 mt-8">
                    <div className="w-full md:flex-1 md:basis-0 min-w-0">
                        <ChartDataTableComponent
                            data={processedSeriesData}
                            previousData={processedPreviousSeriesData}
                            metricLabel={getMetricLabelWithCount(submittedMetricType)}
                            submittedDateRange={submittedDateRange}
                            submittedPreviousDateRange={submittedPreviousDateRange}
                        />
                    </div>

                    <div className="w-full md:flex-1 md:basis-0 min-w-0">
                        <TrafficTableComponent
                            title="Inkluderte sider"
                            data={includedPagesWithCompare}
                            onRowClick={onSelectInternalUrl}
                            selectedWebsite={selectedWebsite}
                            metricLabel={getMetricLabelCapitalized(submittedMetricType)}
                            showCompare={submittedComparePreviousPeriod}
                        />
                    </div>
                </div>
            </div>
        </>
    );
};

export default OversiktTabContent;

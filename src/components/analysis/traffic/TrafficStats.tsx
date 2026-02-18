import React from 'react';

interface TrafficStatsProps {
    data: any[];
    metricType: string;
    /** Optional: Override the total with actual unique count (e.g., from page metrics) */
    totalOverride?: number;
    granularity?: 'day' | 'week' | 'month' | 'hour';
}

const TrafficStats: React.FC<TrafficStatsProps> = ({ data, metricType, totalOverride, granularity = 'day' }) => {
    if (!data || data.length === 0) return null;

    // Calculate stats
    const values = data.map(item => item.count);
    const sum = values.reduce((a, b) => a + b, 0);
    const avg = sum / values.length;

    // Find absolute max and corresponding date
    const maxItem = data.reduce((prev, current) => (prev.count > current.count) ? prev : current, data[0]);
    const max = maxItem.count;

    let maxLabelText = '';
    if (granularity === 'hour') {
        maxLabelText = new Date(maxItem.time).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' });
        // Add date if spanning multiple days might be good, but usually 'hour' is for short periods. 
        // Let's include date just in case.
        maxLabelText = `${new Date(maxItem.time).toLocaleDateString('nb-NO')} ${maxLabelText}`;
    } else if (granularity === 'week') {
        // Week number
        // Note: Formatting week number requires date-fns or similar if we want "Uke X", 
        // but here we just use date string or leave as is. 
        // The original used local date string.
        maxLabelText = new Date(maxItem.time).toLocaleDateString('nb-NO');
    } else if (granularity === 'month') {
        // Month name
        maxLabelText = new Date(maxItem.time).toLocaleString('nb-NO', { month: 'long', year: 'numeric' });
    } else {
        maxLabelText = new Date(maxItem.time).toLocaleDateString('nb-NO');
    }

    // Calculate median
    const sortedValues = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sortedValues.length / 2);
    const median = sortedValues.length % 2 !== 0
        ? sortedValues[mid]
        : (sortedValues[mid - 1] + sortedValues[mid]) / 2;

    // Formatting helper
    const formatValue = (val: number) => {
        if (metricType === 'proportion') {
            return `${(val * 100).toFixed(1)}%`;
        }
        return Math.round(val).toLocaleString('nb-NO');
    };

    // Determine labels and values based on metric type
    // Use totalOverride if provided (actual unique count), otherwise fall back to sum
    const getMetricLabel = (type: string) => {
        switch (type) {
            case 'pageviews': return 'sidevisninger';
            case 'visits': return 'økter';
            default: return 'unike besøkende';
        }
    };
    const valueSuffix = metricType === 'proportion' ? '' : getMetricLabel(metricType);
    let box1Label = 'Totalt';
    let box1Value = totalOverride !== undefined ? totalOverride : sum;

    let timeUnitLabel = 'dag';
    if (granularity === 'hour') timeUnitLabel = 'time';
    if (granularity === 'week') timeUnitLabel = 'uke';
    if (granularity === 'month') timeUnitLabel = 'måned';

    let box2Label = `Gjennomsnitt per ${timeUnitLabel}`;
    let box2Value = avg;
    let box2Suffix = valueSuffix;

    let box3Label = 'Topp-periode';
    if (granularity === 'day') box3Label = 'Toppdag';
    if (granularity === 'hour') box3Label = 'Topp-time';

    let box3Value = max;
    let box3Subtext = maxLabelText;

    if (metricType === 'proportion') {
        box1Label = 'Gjennomsnittlig andel';
        box1Value = avg; // Average proportion (0.x)

        box2Label = 'Median andel';
        box2Value = median; // Median proportion (0.x)

        box3Label = 'Høyeste andel';
        box3Value = max; // Max proportion (0.x)
        box3Subtext = maxLabelText;
    } else {
        box2Suffix = `${valueSuffix} (median: ${formatValue(median)})`;

        // Show date/time in the tile heading for top period cards.
        box3Label = `${box3Label} ${maxLabelText}`;
        box3Subtext = '';
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-[var(--ax-bg-default)] p-4 rounded-lg border border-[var(--ax-border-neutral-subtle)] shadow-sm">
                <div className="text-sm text-[var(--ax-text-default)] font-medium mb-1">{box1Label}</div>
                <div className="text-2xl font-bold text-[var(--ax-text-default)] flex items-baseline gap-2">
                    {formatValue(box1Value)}
                    {valueSuffix && (
                        <span className="text-sm font-normal text-[var(--ax-text-neutral-subtle)]">
                            {valueSuffix}
                        </span>
                    )}
                </div>
            </div>
            <div className="bg-[var(--ax-bg-default)] p-4 rounded-lg border border-[var(--ax-border-neutral-subtle)] shadow-sm">
                <div className="text-sm text-[var(--ax-text-default)] font-medium mb-1">{box2Label}</div>
                <div className="text-2xl font-bold text-[var(--ax-text-default)] flex items-baseline flex-wrap gap-2">
                    {formatValue(box2Value)}
                    {box2Suffix && (
                        <span className="text-sm font-normal text-[var(--ax-text-neutral-subtle)]">
                            {box2Suffix}
                        </span>
                    )}
                </div>
            </div>
            <div className="bg-[var(--ax-bg-default)] p-4 rounded-lg border border-[var(--ax-border-neutral-subtle)] shadow-sm">
                <div className="text-sm text-[var(--ax-text-default)] font-medium mb-1">{box3Label}</div>
                <div className="text-2xl font-bold text-[var(--ax-text-default)] flex items-baseline flex-wrap gap-2">
                    {formatValue(box3Value)}
                    {(valueSuffix || box3Subtext) && (
                        <span className="text-sm font-normal text-[var(--ax-text-neutral-subtle)] inline-flex flex-wrap gap-1">
                            {valueSuffix && <span>{valueSuffix}</span>}
                            {box3Subtext && <span>{box3Subtext}</span>}
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
};

export default TrafficStats;

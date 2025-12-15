import React from 'react';

interface TrafficStatsProps {
    data: any[];
    metricType: string;
}

const TrafficStats: React.FC<TrafficStatsProps> = ({ data, metricType }) => {
    if (!data || data.length === 0) return null;

    // Calculate stats
    const values = data.map(item => item.count);
    const sum = values.reduce((a, b) => a + b, 0);
    const avg = sum / values.length;

    // Find absolute max and corresponding date
    const maxItem = data.reduce((prev, current) => (prev.count > current.count) ? prev : current, data[0]);
    const max = maxItem.count;
    const maxDate = new Date(maxItem.time).toLocaleDateString('nb-NO');

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
    let box1Label = `Totalt ${metricType === 'pageviews' ? 'sidevisninger' : 'besøkende'}`;
    let box1Value = sum;

    let box2Label = 'Gjennomsnitt per dag';
    let box2Value = avg;

    let box3Label = 'Toppdag';
    let box3Value = max;
    let box3Subtext = '';

    if (metricType === 'proportion') {
        box1Label = 'Gjennomsnittlig andel';
        box1Value = avg; // Average proportion (0.x)

        box2Label = 'Median andel';
        box2Value = median; // Median proportion (0.x)

        box3Label = 'Høyeste andel';
        box3Value = max; // Max proportion (0.x)
        box3Subtext = maxDate;
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                <div className="text-sm text-gray-900 font-medium mb-1">{box1Label}</div>
                <div className="text-2xl font-bold text-gray-900">
                    {formatValue(box1Value)}
                </div>
            </div>
            <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                <div className="text-sm text-gray-900 font-medium mb-1">{box2Label}</div>
                <div className="text-2xl font-bold text-gray-900">
                    {formatValue(box2Value)}
                </div>
            </div>
            <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                <div className="text-sm text-gray-900 font-medium mb-1">{box3Label}</div>
                <div className="text-2xl font-bold text-gray-900 flex items-baseline gap-2">
                    {formatValue(box3Value)}
                    {box3Subtext && (
                        <span className="text-sm font-normal text-gray-500">
                            {box3Subtext}
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
};

export default TrafficStats;

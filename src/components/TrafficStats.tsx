import React from 'react';

interface TrafficStatsProps {
    data: any[];
    metricType: string;
}

const TrafficStats: React.FC<TrafficStatsProps> = ({ data, metricType }) => {
    if (!data || data.length === 0) return null;

    const total = data.reduce((sum, item) => sum + item.count, 0);
    const average = Math.round(total / data.length);
    const peak = Math.max(...data.map(item => item.count));

    const metricLabel = metricType === 'pageviews' ? 'Sidevisninger' : 'Besøkende';

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                <div className="text-sm text-gray-900 font-medium mb-1">Totalt {metricLabel.toLowerCase()}</div>
                <div className="text-2xl font-bold text-gray-900">
                    {total.toLocaleString('nb-NO')}
                </div>
            </div>
            <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                <div className="text-sm text-gray-900 font-medium mb-1">Gjennomsnitt per dag</div>
                <div className="text-2xl font-bold text-gray-900">
                    {average.toLocaleString('nb-NO')}
                </div>
            </div>
            <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                <div className="text-sm text-gray-900 font-medium mb-1">Toppdag</div>
                <div className="text-2xl font-bold text-gray-900">
                    {peak.toLocaleString('nb-NO')}
                </div>
            </div>
        </div>
    );
};

export default TrafficStats;

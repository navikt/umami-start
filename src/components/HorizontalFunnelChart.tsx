import React from 'react';

interface FunnelStep {
    step: number;
    count: number;
    url?: string;
    dropoff?: number;
    conversionRate?: number;
}

interface FunnelChartProps {
    data: FunnelStep[];
    loading?: boolean;
}

const HorizontalFunnelChart: React.FC<FunnelChartProps> = ({ data, loading }) => {
    if (loading) {
        return <div className="animate-pulse h-64 bg-gray-100 rounded-lg"></div>;
    }

    if (!data || data.length === 0) {
        return <div className="text-center p-8 text-gray-500">Ingen data tilgjengelig for trakten.</div>;
    }

    const themeColor = 'rgb(19, 17, 54)';

    return (
        <div className="w-full overflow-x-auto py-12 px-4">
            <div className="flex flex-row items-start justify-center min-w-max mx-auto space-x-0">
                {data.map((item, index) => {
                    const prevItem = index > 0 ? data[index - 1] : null;
                    const percentageOfPrev = prevItem && prevItem.count > 0 ? Math.round((item.count / prevItem.count) * 100) : 100;

                    const dropoffCount = prevItem ? prevItem.count - item.count : 0;
                    const dropoffPercentage = prevItem ? 100 - percentageOfPrev : 0;

                    return (
                        <div key={item.step} className="flex flex-row items-start">
                            {/* Connector and Drop-off visualization */}
                            {index > 0 && (
                                <div className="flex flex-col items-center justify-start w-48 pt-20 relative mx-2">
                                    {/* Horizontal Flow Line */}
                                    <div className="h-3 w-full bg-blue-100 absolute top-24 left-0 right-0 -z-10 rounded-full">
                                        <div
                                            className="h-full bg-blue-500 rounded-full opacity-20"
                                            style={{ width: `${percentageOfPrev}%` }}
                                        ></div>
                                    </div>

                                    {/* Conversion Stats (Gikk videre) */}
                                    <div className="bg-white border-2 border-blue-100 rounded-xl px-4 py-2 z-10 mb-4 flex flex-col items-center shadow-sm min-w-[120px]">
                                        <span className="text-xl font-bold text-blue-900">{percentageOfPrev}%</span>
                                        <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">Gikk videre</span>
                                    </div>

                                    {/* Drop-off Branch */}
                                    {dropoffCount > 0 && (
                                        <div className="flex flex-col items-center animate-in fade-in slide-in-from-top-4 duration-500">
                                            {/* Vertical line down */}
                                            <div className="h-16 w-0.5 bg-red-100 mb-2"></div>

                                            {/* Drop-off Stats */}
                                            <div className="bg-red-50 border border-red-100 rounded-lg p-3 flex flex-col items-center shadow-sm">
                                                <span className="text-xs font-bold text-red-600 uppercase tracking-wider mb-1">Falt fra</span>
                                                <span className="text-lg font-bold text-red-700">-{dropoffCount.toLocaleString('nb-NO')}</span>
                                                <span className="text-xs text-red-500">({dropoffPercentage}%)</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* The Step Box */}
                            <div
                                className="relative flex flex-col items-center justify-center p-6 rounded-xl shadow-lg"
                                style={{
                                    backgroundColor: themeColor,
                                    color: 'white',
                                    width: '280px',
                                    height: '200px'
                                }}
                            >
                                <div className="text-xs font-bold opacity-70 uppercase tracking-wider mb-3">
                                    Steg {item.step + 1}
                                </div>
                                <div className="text-4xl font-bold mb-4">
                                    {item.count.toLocaleString('nb-NO')}
                                </div>
                                <div className="w-full border-t border-white/10 my-2"></div>
                                <div className="text-sm opacity-90 text-center break-words w-full px-2 font-medium leading-snug" title={item.url}>
                                    {item.url}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default HorizontalFunnelChart;

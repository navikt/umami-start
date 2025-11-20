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

const FunnelChart: React.FC<FunnelChartProps> = ({ data, loading }) => {
    if (loading) {
        return <div className="animate-pulse h-64 bg-gray-100 rounded-lg"></div>;
    }

    if (!data || data.length === 0) {
        return <div className="text-center p-8 text-gray-500">Ingen data tilgjengelig for trakten.</div>;
    }

    const maxCount = Math.max(...data.map(d => d.count));
    const themeColor = 'rgb(19, 17, 54)';

    return (
        <div className="flex flex-col items-center w-full max-w-4xl mx-auto py-12 px-4">
            {data.map((item, index) => {
                const prevItem = index > 0 ? data[index - 1] : null;
                const percentageOfPrev = prevItem && prevItem.count > 0 ? Math.round((item.count / prevItem.count) * 100) : 100;

                // Calculate width, ensuring a minimum width for readability
                const widthPercentage = maxCount > 0 ? Math.max((item.count / maxCount) * 100, 20) : 20;

                // Calculate dropoff from previous step
                const dropoffCount = prevItem ? prevItem.count - item.count : 0;
                const dropoffPercentage = prevItem ? 100 - percentageOfPrev : 0;

                return (
                    <div key={item.step} className="w-full flex flex-col items-center relative">
                        {/* Connector line from previous step */}
                        {index > 0 && (
                            <div className="h-6 w-0.5 bg-gray-300 my-1"></div>
                        )}

                        <div className="w-full flex items-center justify-center relative group">

                            {/* Left side stats (Conversion rate) */}
                            <div className="absolute left-0 w-[20%] text-right pr-6 hidden md:block">
                                {index > 0 && (
                                    <div className="flex flex-col items-end">
                                        <span className="text-2xl font-bold text-gray-900">{percentageOfPrev}%</span>
                                        <span className="text-sm font-medium text-gray-600">gikk videre</span>
                                    </div>
                                )}
                            </div>

                            {/* The Bar */}
                            <div
                                className="relative flex flex-col items-center justify-center py-6 px-8 rounded-xl shadow-sm transition-all duration-300 hover:shadow-md"
                                style={{
                                    width: `${widthPercentage}%`,
                                    backgroundColor: themeColor,
                                    color: 'white',
                                    minWidth: '280px'
                                }}
                            >
                                <div className="text-xs font-bold opacity-80 uppercase tracking-wider mb-2">
                                    Steg {item.step + 1}
                                </div>
                                <div className="text-3xl font-bold mb-2">
                                    {item.count.toLocaleString('nb-NO')}
                                </div>
                                <div className="text-base opacity-90 truncate max-w-full px-2 font-medium" title={item.url}>
                                    {item.url}
                                </div>
                            </div>

                            {/* Right side stats (Dropoff) */}
                            <div className="absolute right-0 w-[20%] pl-6 hidden md:block text-left">
                                {index > 0 && dropoffCount > 0 && (
                                    <div className="flex flex-col items-start">
                                        <span className="text-xl font-bold text-red-600">-{dropoffCount.toLocaleString('nb-NO')}</span>
                                        <span className="text-sm font-medium text-red-600">falt fra ({dropoffPercentage}%)</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Mobile stats view */}
                        <div className="flex justify-between w-full max-w-[280px] mt-2 md:hidden text-xs text-gray-500">
                            {index > 0 && (
                                <>
                                    <span>{percentageOfPrev}% videre</span>
                                    <span className="text-red-500">{dropoffPercentage}% falt fra</span>
                                </>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export default FunnelChart;

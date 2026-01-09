import React, { useState } from 'react';
import { ExternalLink } from 'lucide-react';
import AnalysisActionModal from './AnalysisActionModal';

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
    websiteId?: string;
    period?: string;
}

const FunnelChart: React.FC<FunnelChartProps> = ({ data, loading, websiteId, period }) => {
    const [selectedUrl, setSelectedUrl] = useState<string | null>(null);

    if (loading) {
        return <div className="animate-pulse h-64 bg-gray-100 rounded-lg"></div>;
    }

    if (!data || data.length === 0) {
        return <div className="text-center p-8 text-gray-500">Ingen data tilgjengelig for trakten.</div>;
    }

    const maxCount = Math.max(...data.map(d => d.count));
    const themeColor = 'rgb(19, 17, 54)';

    const handleUrlClick = (e: React.MouseEvent, urlPath: string) => {
        if (!websiteId) return;
        e.stopPropagation();
        setSelectedUrl(urlPath);
    };

    return (
        <>
            <div className="flex flex-col items-center w-full max-w-5xl mx-auto py-8 px-4">
                {data.map((item, index) => {
                    const prevItem = index > 0 ? data[index - 1] : null;
                    const percentageOfPrev = prevItem && prevItem.count > 0 ? Math.round((item.count / prevItem.count) * 100) : 100;

                    // Calculate width relative to the center column (which will be 60% of total)
                    const widthPercentage = maxCount > 0 ? Math.max((item.count / maxCount) * 100, 20) : 20;

                    // Calculate dropoff from previous step
                    const dropoffCount = prevItem ? prevItem.count - item.count : 0;
                    const dropoffPercentage = prevItem ? 100 - percentageOfPrev : 0;

                    const isClickable = websiteId && item.url && item.url.startsWith('/');

                    return (
                        <div key={item.step} className="w-full flex flex-col items-center relative">
                            {/* Connector line from previous step */}
                            {index > 0 && (
                                <div className="h-4 w-0.5 bg-gray-300 my-1"></div>
                            )}

                            <div className="w-full flex items-center justify-center relative group">

                                {/* Left side stats (Conversion rate) */}
                                <div className="w-[20%] text-right pr-4 hidden md:block">
                                    {index > 0 && (
                                        <div className="flex flex-col items-end">
                                            <span className="text-xl font-bold text-gray-900">{percentageOfPrev}%</span>
                                            <span className="text-xs font-medium text-gray-600">gikk videre</span>
                                        </div>
                                    )}
                                </div>

                                {/* The Bar Container - 60% width */}
                                <div className="w-[60%] flex justify-center">
                                    <div
                                        className="relative flex flex-col items-center justify-center py-3 px-4 rounded-lg shadow-sm transition-all duration-300 hover:shadow-md"
                                        style={{
                                            width: `${widthPercentage}%`,
                                            backgroundColor: themeColor,
                                            color: 'white',
                                            minWidth: '200px'
                                        }}
                                    >
                                        <div className="text-[10px] font-bold opacity-80 uppercase tracking-wider mb-1">
                                            Steg {item.step + 1}
                                        </div>
                                        <div className="text-2xl font-bold mb-1">
                                            {item.count.toLocaleString('nb-NO')}
                                        </div>

                                        {/* URL Display */}
                                        <div
                                            className={`text-sm opacity-90 max-w-full px-2 font-medium break-words text-center flex items-center justify-center gap-1 ${isClickable ? 'cursor-pointer hover:underline hover:opacity-100' : ''}`}
                                            title={item.url}
                                            onClick={(e) => isClickable && item.url ? handleUrlClick(e, item.url) : undefined}
                                        >
                                            <span>{item.url}</span>
                                            {isClickable && <ExternalLink size={12} className="inline-block flex-shrink-0" />}
                                        </div>
                                    </div>
                                </div>

                                {/* Right side stats (Dropoff) */}
                                <div className="w-[20%] pl-4 hidden md:block text-left">
                                    {index > 0 && dropoffCount > 0 && (
                                        <div className="flex flex-col items-start">
                                            <span className="text-lg font-bold text-red-600">-{dropoffCount.toLocaleString('nb-NO')}</span>
                                            <span className="text-xs font-medium text-red-600">falt fra ({dropoffPercentage}%)</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Mobile stats view */}
                            <div className="flex justify-between w-full max-w-[200px] mt-1 md:hidden text-xs text-gray-500">
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

            <AnalysisActionModal
                open={!!selectedUrl}
                onClose={() => setSelectedUrl(null)}
                urlPath={selectedUrl}
                websiteId={websiteId}
                period={period}
            />
        </>
    );
};

export default FunnelChart;

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

const HorizontalFunnelChart: React.FC<FunnelChartProps> = ({ data, loading, websiteId, period }) => {
    const [selectedUrl, setSelectedUrl] = useState<string | null>(null);

    if (loading) {
        return <div className="animate-pulse h-64 bg-gray-100 rounded-lg"></div>;
    }

    if (!data || data.length === 0) {
        return <div className="text-center p-8 text-gray-500">Ingen data tilgjengelig for trakten.</div>;
    }

    const themeColor = 'rgb(19, 17, 54)';

    const handleUrlClick = (e: React.MouseEvent, urlPath: string) => {
        if (!websiteId) return;
        e.stopPropagation();
        setSelectedUrl(urlPath);
    };

    return (
        <>
            <div className="w-full overflow-x-auto py-8 px-4">
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
                                    <div className="flex flex-col items-center justify-start w-32 pt-16 relative mx-1">
                                        {/* Horizontal Flow Line */}
                                        <div className="h-2 w-full bg-blue-100 absolute top-[4.5rem] left-0 right-0 -z-10 rounded-full">
                                            <div
                                                className="h-full bg-blue-500 rounded-full opacity-20"
                                                style={{ width: `${percentageOfPrev}%` }}
                                            ></div>
                                        </div>

                                        {/* Conversion Stats (Gikk videre) */}
                                        <div className="bg-white border border-blue-100 rounded-lg px-2 py-1 z-10 mb-2 flex flex-col items-center shadow-sm min-w-[90px]">
                                            <span className="text-sm font-bold text-blue-900">{percentageOfPrev}%</span>
                                            <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">Videre</span>
                                        </div>

                                        {/* Drop-off Branch */}
                                        {dropoffCount > 0 && (
                                            <div className="flex flex-col items-center animate-in fade-in slide-in-from-top-4 duration-500">
                                                {/* Vertical line down */}
                                                <div className="h-8 w-0.5 bg-red-100 mb-1"></div>

                                                {/* Drop-off Stats */}
                                                <div className="bg-red-50 border border-red-100 rounded-md p-2 flex flex-col items-center shadow-sm min-w-[90px]">
                                                    <span className="text-[10px] font-bold text-red-600 uppercase tracking-wider mb-0.5">Falt fra</span>
                                                    <span className="text-sm font-bold text-red-700">-{dropoffCount.toLocaleString('nb-NO')}</span>
                                                    <span className="text-[10px] text-red-500">({dropoffPercentage}%)</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* The Step Box */}
                                <div
                                    className="relative flex flex-col items-center justify-center py-4 px-4 rounded-lg shadow-sm transition-all duration-300 hover:shadow-md"
                                    style={{
                                        backgroundColor: themeColor,
                                        color: 'white',
                                        width: '200px',
                                        minHeight: '140px'
                                    }}
                                >
                                    <div className="text-[10px] font-bold opacity-80 uppercase tracking-wider mb-2">
                                        Steg {item.step + 1}
                                    </div>
                                    <div className="text-2xl font-bold mb-2">
                                        {item.count.toLocaleString('nb-NO')}
                                    </div>
                                    <div className="w-full border-t border-white/10 my-2"></div>
                                    {item.url && websiteId ? (
                                        <div
                                            className="text-xs opacity-90 text-center break-words w-full px-1 font-medium leading-snug cursor-pointer hover:underline flex items-center justify-center gap-1"
                                            title={item.url}
                                            onClick={(e) => handleUrlClick(e, item.url!)}
                                        >
                                            {item.url} <ExternalLink className="h-3 w-3 opacity-70" />
                                        </div>
                                    ) : (
                                        <div className="text-xs opacity-90 text-center break-words w-full px-1 font-medium leading-snug" title={item.url}>
                                            {item.url}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
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

export default HorizontalFunnelChart;

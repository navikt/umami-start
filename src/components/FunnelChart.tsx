import React, { useState } from 'react';
import { ExternalLink } from 'lucide-react';
import AnalysisActionModal from './AnalysisActionModal';

interface FunnelStep {
    step: number;
    count: number;
    url?: string;
    dropoff?: number;
    conversionRate?: number;
    params?: { key: string; value: string; operator: 'equals' | 'contains' }[];
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
            <div className="flex flex-col items-center w-full max-w-5xl mx-auto py-6 px-4">
                {data.map((item, index) => {
                    const prevItem = index > 0 ? data[index - 1] : null;
                    const percentageOfPrev = prevItem && prevItem.count > 0 ? Math.round((item.count / prevItem.count) * 100) : 100;

                    // Calculate width relative to the center column
                    const widthPercentage = maxCount > 0 ? Math.max((item.count / maxCount) * 100, 20) : 20;

                    // Calculate dropoff from previous step
                    const dropoffCount = prevItem ? prevItem.count - item.count : 0;
                    const dropoffPercentage = prevItem ? 100 - percentageOfPrev : 0;

                    // Calculate total conversion (% of users from first step)
                    const firstStepCount = data[0]?.count || 1;
                    const totalConversionPercent = Math.round((item.count / firstStepCount) * 100);

                    const isClickable = websiteId && item.url && item.url.startsWith('/');

                    return (
                        <div key={item.step} className="w-full flex flex-col items-center relative">
                            {/* Connector with stats between cards */}
                            {index > 0 && (
                                <div className="w-full flex items-center justify-center py-2 relative">
                                    {/* Left side: gikk videre (conversion) */}
                                    <div className="flex-1 flex justify-end pr-3 md:pr-6">
                                        <div
                                            className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-green-50 border border-green-200"
                                            title={`${percentageOfPrev}% av brukerne fra forrige steg gikk videre til dette steget`}
                                        >
                                            <span className="text-lg md:text-xl font-bold text-green-700">{percentageOfPrev}%</span>
                                            <span className="text-sm font-medium text-green-700 hidden sm:inline">gikk videre</span>
                                        </div>
                                    </div>

                                    {/* Center: Connector line */}
                                    <div className="flex flex-col items-center">
                                        <div className="w-0.5 h-3 bg-gray-300"></div>
                                        <div className="w-2 h-2 rounded-full bg-gray-400"></div>
                                        <div className="w-0.5 h-3 bg-gray-300"></div>
                                    </div>

                                    {/* Right side: falt fra (dropoff) */}
                                    <div className="flex-1 flex justify-start pl-3 md:pl-6">
                                        {dropoffCount > 0 ? (
                                            <div
                                                className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-red-50 border border-red-200"
                                                title={`${dropoffCount.toLocaleString('nb-NO')} brukere (${dropoffPercentage}%) falt fra mellom forrige steg og dette steget`}
                                            >
                                                <span className="text-lg md:text-xl font-bold text-red-700">{dropoffPercentage}%</span>
                                                <span className="text-sm font-medium text-red-700 hidden sm:inline">falt fra (-{dropoffCount.toLocaleString('nb-NO')})</span>
                                            </div>
                                        ) : (
                                            <div className="px-3 py-1.5">
                                                <span className="text-sm font-medium text-gray-400">Ingen frafall</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* The Step Card */}
                            <div className="w-full flex justify-center" style={{ maxWidth: '600px', margin: '0 auto' }}>
                                <div
                                    className="relative flex flex-col items-center justify-center py-3 px-4 rounded-lg shadow-sm transition-all duration-300 hover:shadow-md"
                                    style={{
                                        width: `${widthPercentage}%`,
                                        backgroundColor: themeColor,
                                        color: 'white',
                                        minWidth: '180px'
                                    }}
                                >
                                    <div className="text-[11px] font-bold opacity-80 uppercase tracking-wider mb-0.5">
                                        Steg {item.step + 1}
                                    </div>
                                    <div className="flex items-baseline gap-2 mb-0.5">
                                        <span className="text-2xl md:text-3xl font-bold">
                                            {item.count.toLocaleString('nb-NO')}
                                        </span>
                                        <span
                                            className="text-sm md:text-base font-medium opacity-75"
                                            title="Prosent av alle som startet i trakten"
                                        >
                                            ({totalConversionPercent}%)
                                        </span>
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

                                    {/* Params Display */}
                                    {item.params && item.params.length > 0 && (
                                        <div className="mt-1 flex flex-col items-center gap-1 max-w-full shrink-0">
                                            {item.params.map((p, i) => (
                                                <div key={i} className="bg-white/20 px-1.5 py-0.5 rounded text-[10px] font-medium text-white/90 whitespace-nowrap max-w-full truncate" title={`${p.key} = ${p.value}`}>
                                                    {p.key} = {p.value}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
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

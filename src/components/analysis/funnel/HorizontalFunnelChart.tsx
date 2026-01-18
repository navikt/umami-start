import React, { useState } from 'react';
import { ExternalLink } from 'lucide-react';
import AnalysisActionModal from '../AnalysisActionModal';

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

const HorizontalFunnelChart: React.FC<FunnelChartProps> = ({ data, loading, websiteId, period }) => {
    const [selectedUrl, setSelectedUrl] = useState<string | null>(null);

    if (loading) {
        return <div className="animate-pulse h-64 bg-[var(--ax-bg-neutral-soft)] rounded-lg"></div>;
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

    const maxCount = Math.max(...data.map(d => d.count));

    return (
        <>
            <div className="w-full overflow-x-auto py-8 px-4 text-center">
                <div className="inline-flex flex-row items-start justify-center min-w-max mx-auto space-x-0">
                    {data.map((item, index) => {
                        const prevItem = index > 0 ? data[index - 1] : null;
                        const percentageOfPrev = prevItem && prevItem.count > 0 ? Math.round((item.count / prevItem.count) * 100) : 100;

                        const dropoffCount = prevItem ? prevItem.count - item.count : 0;
                        const dropoffPercentage = prevItem ? 100 - percentageOfPrev : 0;

                        // Calculate total conversion (% of users from first step)
                        const firstStepCount = data[0]?.count || 1;
                        const totalConversionPercent = Math.round((item.count / firstStepCount) * 100);

                        return (
                            <div key={item.step} className="flex flex-row items-start">
                                {/* Connector and Drop-off visualization */}
                                {index > 0 && (
                                    <div className="flex flex-col items-center justify-start w-28 pt-16 relative mx-1">
                                        {/* Horizontal Flow Line */}
                                        <div className="h-2 w-full bg-gray-200 absolute top-[4.5rem] left-0 right-0 -z-10 rounded-full">
                                            <div
                                                className="h-full bg-green-400 rounded-full"
                                                style={{ width: `${percentageOfPrev}%` }}
                                            ></div>
                                        </div>

                                        {/* Conversion Stats (Gikk videre) */}
                                        <div className="bg-green-50 border border-green-200 rounded-lg px-2 py-1.5 z-10 mb-2 flex flex-col items-center shadow-sm min-w-[90px]">
                                            <span className="text-base font-bold text-green-700">{percentageOfPrev}%</span>
                                            <span className="text-[11px] font-medium text-green-700">gikk videre</span>
                                        </div>

                                        {/* Drop-off Branch */}
                                        {dropoffCount > 0 && (
                                            <div className="flex flex-col items-center animate-in fade-in slide-in-from-top-4 duration-500">
                                                {/* Vertical line down */}
                                                <div className="h-6 w-0.5 bg-red-200 mb-1"></div>

                                                {/* Drop-off Stats - Percentage first, consistent with vertical */}
                                                <div className="bg-red-50 border border-red-200 rounded-md px-2 py-1.5 flex flex-col items-center shadow-sm min-w-[90px]">
                                                    <span className="text-base font-bold text-red-700">{dropoffPercentage}%</span>
                                                    <span className="text-[11px] font-medium text-red-700">falt fra (-{dropoffCount.toLocaleString('nb-NO')})</span>
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
                                        width: `${Math.max(160, 220 * (item.count / maxCount))}px`,
                                        minHeight: '140px'
                                    }}
                                >
                                    {(() => {
                                        const labelCandidate = item.params?.find(p => ['lenketekst', 'tekst', 'label', 'tittel'].includes(p.key.toLowerCase()))?.value;
                                        const destCandidate = item.params?.find(p => p.key === 'destinasjon' || p.key === 'url')?.value;
                                        const isClickable = websiteId && item.url && item.url.startsWith('/');

                                        return (
                                            <div className="flex flex-col items-center gap-1 w-full px-1">
                                                <div className="text-[11px] font-bold opacity-80 uppercase tracking-wider mb-1">
                                                    Steg {item.step + 1}
                                                </div>

                                                <div className="flex items-baseline gap-2 mb-2">
                                                    <span className="text-xl font-bold">
                                                        {item.count.toLocaleString('nb-NO')}
                                                    </span>
                                                    <span className="text-xs font-medium opacity-75">
                                                        ({totalConversionPercent}%)
                                                    </span>
                                                </div>

                                                {labelCandidate && (
                                                    <div className="text-[11px] font-bold text-white mb-0.5 px-2 text-center line-clamp-2 leading-tight">
                                                        {labelCandidate}
                                                    </div>
                                                )}

                                                <div
                                                    className={`text-[10px] bg-[var(--ax-bg-default)]/10 border border-white/20 rounded px-1.5 py-0.5 opacity-90 max-w-full font-medium break-words text-center flex items-center justify-center gap-1 ${isClickable ? 'cursor-pointer hover:bg-[var(--ax-bg-default)]/20 hover:opacity-100 transition-colors' : ''}`}
                                                    title={item.url}
                                                    onClick={(e) => isClickable && item.url ? handleUrlClick(e, item.url) : undefined}
                                                >
                                                    <span className="truncate max-w-[120px]">{destCandidate || item.url}</span>
                                                    {isClickable && <ExternalLink size={10} className="inline-block flex-shrink-0" />}
                                                </div>
                                            </div>
                                        );
                                    })()}
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

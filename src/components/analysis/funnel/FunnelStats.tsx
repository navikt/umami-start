import React from 'react';

interface FunnelStatsProps {
    data: any[];
}

const FunnelStats: React.FC<FunnelStatsProps> = ({ data }) => {
    if (!data || data.length === 0) return null;

    const totalStarted = data[0].count;
    const totalCompleted = data[data.length - 1].count;
    const dropoffCount = totalStarted - totalCompleted;

    const completionRate = totalStarted > 0 ? Math.round((totalCompleted / totalStarted) * 100) : 0;
    const dropoffRate = totalStarted > 0 ? 100 - completionRate : 0;

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-[var(--ax-bg-default)] p-4 rounded-lg border border-[var(--ax-border-neutral-subtle)] shadow-sm">
                <div className="text-sm text-[var(--ax-text-default)] font-medium mb-1">Totalt startet</div>
                <div className="text-2xl font-bold text-[var(--ax-text-default)]">
                    {totalStarted.toLocaleString('nb-NO')}
                </div>
            </div>
            <div className="bg-[var(--ax-bg-default)] p-4 rounded-lg border border-[var(--ax-border-neutral-subtle)] shadow-sm">
                <div className="text-sm text-[var(--ax-text-default)] font-medium mb-1">Fullførte</div>
                <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-green-600">
                        {totalCompleted.toLocaleString('nb-NO')}
                    </span>
                    <span className="text-sm font-medium text-green-600">
                        ({completionRate}%)
                    </span>
                </div>
            </div>
            <div className="bg-[var(--ax-bg-default)] p-4 rounded-lg border border-[var(--ax-border-neutral-subtle)] shadow-sm">
                <div className="text-sm text-[var(--ax-text-default)] font-medium mb-1">Falt fra</div>
                <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-red-600">
                        {dropoffCount.toLocaleString('nb-NO')}
                    </span>
                    <span className="text-sm font-medium text-red-600">
                        ({dropoffRate}%)
                    </span>
                </div>
            </div>
        </div>
    );
};

export default FunnelStats;

import { Button } from '@navikt/ds-react';
import { Download } from 'lucide-react';
import type { SeriesPoint, QueryStats } from '../model/types.ts';

interface EventSeriesTrendTableProps {
    seriesData: SeriesPoint[];
    selectedEvent: string;
    queryStats: QueryStats | null;
}

const EventSeriesTrendTable = ({ seriesData, selectedEvent, queryStats }: EventSeriesTrendTableProps) => {
    const handleDownloadCsv = () => {
        const headers = ['Dato', 'Antall'];
        const csvRows = [
            headers.join(','),
            ...seriesData.map((item) => {
                return [
                    new Date(item.time).toLocaleDateString('nb-NO'),
                    item.count
                ].join(',');
            })
        ];
        const csvContent = csvRows.join('\n');
        const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `${selectedEvent}_${new Date().toISOString().slice(0, 10)}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    return (
        <div className="border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-[var(--ax-border-neutral-subtle)]">
                    <thead className="bg-[var(--ax-bg-neutral-soft)]">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-[var(--ax-text-default)] uppercase tracking-wider">Dato</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-[var(--ax-text-default)] uppercase tracking-wider">Antall</th>
                        </tr>
                    </thead>
                    <tbody className="bg-[var(--ax-bg-default)] divide-y divide-[var(--ax-border-neutral-subtle)]">
                        {seriesData.map((item, index) => (
                            <tr key={index} className="hover:bg-[var(--ax-bg-neutral-soft]">
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-[var(--ax-text-default)]">
                                    {new Date(item.time).toLocaleDateString('nb-NO')}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--ax-text-default)]">
                                    {item.count.toLocaleString('nb-NO')}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <div className="flex gap-2 p-3 bg-[var(--ax-bg-neutral-soft)] border-t justify-between items-center">
                <div className="flex gap-2">
                    <Button
                        size="small"
                        variant="secondary"
                        onClick={handleDownloadCsv}
                        icon={<Download size={16} />}
                    >
                        Last ned CSV
                    </Button>
                </div>
                {queryStats && (
                    <span className="text-sm text-[var(--ax-text-subtle)]">
                        Data prosessert: {queryStats.totalBytesProcessedGB} GB
                    </span>
                )}
            </div>
        </div>
    );
};

export default EventSeriesTrendTable;


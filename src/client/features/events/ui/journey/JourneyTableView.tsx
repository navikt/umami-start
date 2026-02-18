import { parseJourneyStep } from '../../utils/parsers.ts';

interface JourneyTableViewProps {
    journeys: { path: string[]; count: number }[];
    totalSessions: number;
}

const JourneyTableView = ({ journeys, totalSessions }: JourneyTableViewProps) => (
    <div className="border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-[var(--ax-border-neutral-subtle)]">
                <thead className="bg-[var(--ax-bg-neutral-soft)]">
                    <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-[var(--ax-text-default)] uppercase">Antall</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-[var(--ax-text-default)] uppercase">Andel</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-[var(--ax-text-default)] uppercase">Sti</th>
                    </tr>
                </thead>
                <tbody className="bg-[var(--ax-bg-default)] divide-y divide-[var(--ax-border-neutral-subtle)]">
                    {journeys.map((journey, idx) => (
                        <tr key={idx} className="hover:bg-[var(--ax-bg-neutral-soft)]">
                            <td className="px-4 py-2 text-sm text-[var(--ax-text-default)]">{journey.count}</td>
                            <td className="px-4 py-2 text-sm text-[var(--ax-text-default)]">{((journey.count / totalSessions) * 100).toFixed(1)}%</td>
                            <td className="px-4 py-2 text-sm text-[var(--ax-text-default)] break-words">
                                {journey.path.map((step) => parseJourneyStep(step).eventName).join(' → ')}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    </div>
);

export default JourneyTableView;


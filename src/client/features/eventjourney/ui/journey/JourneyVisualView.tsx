import { useState } from 'react';
import { Button } from '@navikt/ds-react';
import { ArrowRight } from 'lucide-react';
import { parseJourneyStep } from '../../utils/parsers.ts';
import { formatNumber } from '../../utils/formatters.ts';

interface JourneyVisualViewProps {
    journeys: { path: string[]; count: number }[];
    totalSessions: number;
}

const JourneyVisualView = ({ journeys, totalSessions }: JourneyVisualViewProps) => {
    const [expandedDetails, setExpandedDetails] = useState<Record<string, boolean>>({});

    const toggleDetailsExpansion = (stepKey: string) => {
        setExpandedDetails((current) => ({
            ...current,
            [stepKey]: !current[stepKey],
        }));
    };

    if (journeys.length === 0) {
        return (
            <div className="text-center text-gray-500 py-8">
                Ingen reiser matcher søket ditt.
            </div>
        );
    }

    return (
        <div className="bg-[var(--ax-bg-default)]">
            <div className="space-y-4">
                {journeys.map((journey, idx) => (
                    <div key={idx} className="rounded-xl border border-[var(--ax-border-neutral-subtle)] bg-[var(--ax-bg-default)] p-4">
                        <div className="flex items-center gap-2 text-sm text-[var(--ax-text-subtle)] mb-3">
                            <span className="font-semibold text-[var(--ax-text-default)]">{formatNumber(journey.count)} sesjoner</span>
                            <span>({((journey.count / totalSessions) * 100).toFixed(1)}% av totalt)</span>
                        </div>

                        <div className="overflow-x-auto pb-1">
                            <div className="flex min-w-max items-stretch gap-2">
                                {journey.path.map((step, stepIndex) => {
                                    const parsedStep = parseJourneyStep(step);
                                    const stepKey = `${idx}-${stepIndex}`;
                                    const isExpanded = expandedDetails[stepKey] === true;
                                    const detailsToRender = isExpanded ? parsedStep.details : parsedStep.details.slice(0, 4);
                                    const hiddenDetailsCount = parsedStep.details.length - detailsToRender.length;

                                    return (
                                        <div key={`${step}-${stepIndex}`} className="flex items-center gap-2">
                                            <div className="w-[320px] min-h-[120px] rounded-lg border border-[var(--ax-border-neutral-subtle)] bg-[var(--ax-bg-neutral-soft)] p-3">
                                                <div className="text-xs font-medium text-[var(--ax-text-subtle)] mb-1">
                                                    Steg {stepIndex + 1}
                                                </div>
                                                <div className="text-sm font-semibold text-[var(--ax-text-default)] break-words">
                                                    {parsedStep.eventName}
                                                </div>
                                                {detailsToRender.length > 0 && (
                                                    <div className="mt-2 space-y-1">
                                                        {detailsToRender.map((detail, detailIndex) => (
                                                            <div key={`${detail.key}-${detail.value}-${detailIndex}`} className="text-sm leading-5">
                                                                <span className="font-bold text-[var(--ax-text-default)]">{detail.key}:</span>{' '}
                                                                <span className="text-[var(--ax-text-default)] break-words">{detail.value}</span>
                                                            </div>
                                                        ))}
                                                        {parsedStep.details.length > 4 && (
                                                            <Button
                                                                type="button"
                                                                size="xsmall"
                                                                variant="secondary"
                                                                data-color="neutral"
                                                                onClick={() => toggleDetailsExpansion(stepKey)}
                                                                className="mt-1 w-fit"
                                                            >
                                                                {isExpanded ? 'Vis færre felter' : `Vis alle felter (+${hiddenDetailsCount})`}
                                                            </Button>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                            {stepIndex < journey.path.length - 1 && (
                                                <ArrowRight size={16} className="text-[var(--ax-text-subtle)] flex-shrink-0" />
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default JourneyVisualView;


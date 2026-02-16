import type { ComponentType } from 'react';
import { Button, Heading, Loader } from '@navikt/ds-react';
import { ArrowRight } from 'lucide-react';
import type { Website } from '../../../types/chart';

type EntranceRow = {
    name: string;
    count: number;
    type: 'external' | 'internal';
    isDomainInternal?: boolean;
};

type SummaryRow = {
    name: string;
    count: number;
};

type CombinedEntrancesTableProps = {
    title: string;
    data: EntranceRow[];
    onRowClick?: (name: string) => void;
    selectedWebsite: Website | null;
    metricLabel: string;
};

type ExternalTrafficTableProps = {
    title: string;
    data: SummaryRow[];
    metricLabel: string;
    websiteDomain?: string;
};

type TrafficTableProps = {
    title: string;
    data: { name: string; count: number; previousCount?: number; deltaCount?: number }[];
    onRowClick?: (name: string) => void;
    selectedWebsite: Website | null;
    metricLabel: string;
    showCompare?: boolean;
};

type InnOgUtgangerTabContentProps = {
    hasAttemptedFetch: boolean;
    isLoadingExternalReferrers: boolean;
    hasFetchedExternalReferrers: boolean;
    isLoadingBreakdown: boolean;
    hasFetchedBreakdown: boolean;
    combinedEntrances: EntranceRow[];
    entranceSummaryWithUnknown: SummaryRow[];
    exits: { name: string; count: number }[];
    selectedWebsite: Website | null;
    metricLabel: string;
    onSelectInternalUrl: (name: string) => void;
    onNavigateToJourney: () => void;
    CombinedEntrancesTableComponent: ComponentType<CombinedEntrancesTableProps>;
    ExternalTrafficTableComponent: ComponentType<ExternalTrafficTableProps>;
    TrafficTableComponent: ComponentType<TrafficTableProps>;
};

const InnOgUtgangerTabContent = ({
    hasAttemptedFetch,
    isLoadingExternalReferrers,
    hasFetchedExternalReferrers,
    isLoadingBreakdown,
    hasFetchedBreakdown,
    combinedEntrances,
    entranceSummaryWithUnknown,
    exits,
    selectedWebsite,
    metricLabel,
    onSelectInternalUrl,
    onNavigateToJourney,
    CombinedEntrancesTableComponent,
    ExternalTrafficTableComponent,
    TrafficTableComponent,
}: InnOgUtgangerTabContentProps) => {
    if (hasAttemptedFetch && ((isLoadingExternalReferrers || !hasFetchedExternalReferrers) || (isLoadingBreakdown || !hasFetchedBreakdown))) {
        return (
            <div className="flex justify-center items-center h-full py-16">
                <Loader size="xlarge" title="Henter data..." />
            </div>
        );
    }

    return (
        <div className="flex flex-col md:flex-row gap-8">
            <div className="w-full md:flex-1 md:basis-0 min-w-0 flex flex-col gap-8">
                <CombinedEntrancesTableComponent
                    title="Innganger"
                    data={combinedEntrances}
                    onRowClick={onSelectInternalUrl}
                    selectedWebsite={selectedWebsite}
                    metricLabel={metricLabel}
                />
                <ExternalTrafficTableComponent
                    title="Innganger oppsummert"
                    data={entranceSummaryWithUnknown}
                    metricLabel={metricLabel}
                    websiteDomain={selectedWebsite?.domain}
                />
            </div>
            <div className="w-full md:flex-1 md:basis-0 min-w-0 flex flex-col gap-8">
                <TrafficTableComponent
                    title="Utganger"
                    data={exits}
                    onRowClick={onSelectInternalUrl}
                    selectedWebsite={selectedWebsite}
                    metricLabel={metricLabel}
                />
                <div className="border border-[var(--ax-border-neutral-subtle)] rounded-lg p-6 bg-[var(--ax-bg-neutral-soft)]">
                    <Heading level="3" size="small" className="mb-2">Vil du se hele brukerreisen?</Heading>
                    <p className="text-[var(--ax-text-subtle)] mb-4 mt-3">
                        Siden du er på nå viser hvor besøk starter og slutter. I navigasjonsflyt ser du hele reisen gjennom nettstedet.
                    </p>
                    <Button
                        variant="secondary"
                        size="small"
                        icon={<ArrowRight size={16} />}
                        iconPosition="right"
                        onClick={onNavigateToJourney}
                        disabled={!selectedWebsite}
                    >
                        Gå til navigasjonsflyt
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default InnOgUtgangerTabContent;

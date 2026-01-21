
import React from 'react';
import { Heading, BodyShort, Page } from '@navikt/ds-react';
import { KontaktSeksjon } from '../theme/Kontakt/KontaktSeksjon';

interface DashboardLayoutProps {
    title: string;
    subtitle?: string; // e.g. Domain or ID
    description?: string;
    filters?: React.ReactNode;
    children: React.ReactNode;
}

const DashboardLayout: React.FC<DashboardLayoutProps> = ({
    title,
    subtitle,
    description,
    filters,
    children
}) => {
    return (
        <>
            <div style={{
                width: "100%",
                backgroundColor: "var(--ax-bg-accent-soft)",
                color: "var(--ax-text-default)",
                paddingTop: "32px",
                paddingBottom: "32px",
                marginBottom: "24px"
            }}>
                <Page.Block width="xl" gutters>
                    <div className="flex flex-col gap-1">
                        <Heading level="1" size="xlarge">
                            {title}
                        </Heading>
                        {subtitle && (
                            <Heading level="2" size="medium" className="text-[var(--ax-text-neutral-subtle)] font-normal">
                                {subtitle}
                            </Heading>
                        )}
                    </div>
                    {description && (
                        <BodyShort size="medium" className="mt-2 text-[var(--ax-text-neutral-subtle)] max-w-3xl">
                            {description}
                        </BodyShort>
                    )}
                </Page.Block>
            </div>

            <Page.Block width="xl" gutters className="pb-16">
                {filters && (
                    <div className="flex flex-wrap items-end gap-4 p-4 mb-8 bg-[var(--ax-bg-accent-soft)] rounded-lg border border-[var(--ax-border-neutral-subtle)] shadow-sm transition-all">
                        {filters}
                    </div>
                )}

                <div className="min-h-[400px] w-full">
                    {children}
                </div>
            </Page.Block>
            <KontaktSeksjon showMarginBottom={true} />
        </>
    );
};

export default DashboardLayout;

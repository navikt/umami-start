
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
            <Page.Block width="xl" gutters className="py-8">
                <div className={description ? 'mb-8' : 'mb-4'}>
                    <div className="flex flex-col gap-1">
                        <Heading level="1" size="xlarge" spacing>
                            {title}
                        </Heading>
                        {subtitle && (
                            <Heading level="2" size="medium" className="text-[var(--ax-text-subtle)] font-normal">
                                {subtitle}
                            </Heading>
                        )}
                    </div>
                    {description && (
                        <BodyShort size="medium" className="mt-4 text-[var(--ax-text-subtle)] max-w-3xl">
                            {description}
                        </BodyShort>
                    )}
                </div>

                {filters && (
                    <div className="flex flex-wrap items-end gap-4 p-4 mb-8 bg-[var(--ax-bg-neutral-soft)] rounded-lg border border-[var(--ax-border-neutral-subtle)] shadow-sm transition-all">
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

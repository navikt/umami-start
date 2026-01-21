
import React from 'react';
import { Page } from '@navikt/ds-react';
import { KontaktSeksjon } from '../theme/Kontakt/KontaktSeksjon';
import { PageHeader } from '../theme/PageHeader/PageHeader';

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
            <PageHeader
                title={title}
                subtitle={subtitle}
                description={description}
            />

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

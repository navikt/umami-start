
import React from 'react';
import { Heading, BodyShort } from '@navikt/ds-react';

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
        <div className="py-8 max-w-[76.5rem] mx-auto px-4 w-full">
            <div className="mb-8">
                <div className="flex flex-col gap-1">
                    <Heading level="1" size="xlarge">
                        {title}
                    </Heading>
                    {subtitle && (
                        <Heading level="2" size="medium" className="text-gray-600 font-normal">
                            {subtitle}
                        </Heading>
                    )}
                </div>
                {description && (
                    <BodyShort size="medium" className="mt-4 text-gray-700 max-w-3xl">
                        {description}
                    </BodyShort>
                )}
            </div>

            {filters && (
                <div className="flex flex-wrap items-end gap-4 p-4 mb-8 bg-[#fafafa] rounded-lg border border-gray-200 shadow-sm transition-all">
                    {filters}
                </div>
            )}

            <div className="min-h-[400px] w-full">
                {children}
            </div>
        </div>
    );
};

export default DashboardLayout;

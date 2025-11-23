import React from 'react';
import { Heading, BodyShort } from '@navikt/ds-react';
import AnalyticsNavigation, { AnalyticsPage } from './AnalyticsNavigation';

interface ChartLayoutProps {
    title: string;
    description: string;
    filters: React.ReactNode;
    children: React.ReactNode;
    currentPage?: string;
}

const ChartLayout: React.FC<ChartLayoutProps> = ({
    title,
    description,
    filters,
    children,
    currentPage
}) => {
    return (
        <div className="py-8 max-w-[1600px] mx-auto">
            <div className="mb-8">
                <Heading level="1" size="xlarge" className="mb-2">
                    {title}
                </Heading>
                <BodyShort className="text-gray-700">
                    {description}
                </BodyShort>
            </div>

            <div className="rounded-lg shadow-sm border border-gray-200 mb-8 bg-white">
                <div className="flex flex-col md:flex-row min-h-[600px]">
                    <div className="bg-[#fafafa] w-full md:w-1/3 p-6 border-b border-gray-200 md:border-0 md:shadow-[inset_-1px_0_0_#e5e7eb]">
                        <div className="space-y-6">
                            {filters}
                        </div>
                    </div>
                    <div className="w-full md:w-2/3 p-6">
                        {children}
                    </div>
                </div>
            </div>

            {currentPage && <AnalyticsNavigation currentPage={currentPage} />}
        </div>
    );
};

export default ChartLayout;

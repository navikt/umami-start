import React, { useState, useEffect } from 'react';
import { Heading, BodyShort } from '@navikt/ds-react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import AnalyticsNavigation, { type AnalyticsPage } from './AnalyticsNavigation';

interface ChartLayoutProps {
    title: string;
    description: string;
    filters: React.ReactNode;
    children: React.ReactNode;
    currentPage?: AnalyticsPage;
}

const ChartLayout: React.FC<ChartLayoutProps> = ({
    title,
    description,
    filters,
    children,
    currentPage
}) => {
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);

    // Trigger window resize event when sidebar toggles to help charts resize
    useEffect(() => {
        // Small delay to ensure DOM has updated
        const timer = setTimeout(() => {
            window.dispatchEvent(new Event('resize'));
        }, 100);
        return () => clearTimeout(timer);
    }, [isSidebarOpen]);

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
                <div className="flex flex-col md:flex-row min-h-[600px] relative">
                    {isSidebarOpen && (
                        <>
                            <div className="bg-[#fafafa] w-full md:w-1/3 p-6 border-b border-gray-200 md:border-0 md:shadow-[inset_-1px_0_0_#e5e7eb]">
                                <div className="space-y-6">
                                    {filters}
                                </div>
                            </div>
                            {/* Collapse button on divider - hidden on mobile */}
                            <button
                                onClick={() => setIsSidebarOpen(false)}
                                className="hidden md:flex absolute top-1/2 left-1/3 -translate-x-1/2 -translate-y-1/2 items-center justify-center w-6 h-12 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-100 hover:border-blue-300 transition-colors z-10"
                                title="Minimer filter"
                                aria-label="Minimer filter"
                            >
                                <ChevronLeft size={16} className="text-blue-700" aria-hidden />
                            </button>
                        </>
                    )}
                    {!isSidebarOpen && (
                        /* Expand button on left edge - hidden on mobile */
                        <button
                            onClick={() => setIsSidebarOpen(true)}
                            className="hidden md:flex absolute top-1/2 left-0 -translate-x-1/2 -translate-y-1/2 items-center justify-center w-6 h-12 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-100 hover:border-blue-300 transition-colors z-10"
                            title="Vis filter"
                            aria-label="Vis filter"
                        >
                            <ChevronRight size={16} className="text-blue-700" aria-hidden />
                        </button>
                    )}
                    <div className={`w-full ${isSidebarOpen ? 'md:w-2/3' : ''} p-6`}>
                        {children}
                    </div>
                </div>
            </div>

            {currentPage && currentPage !== 'grafbygger' && <AnalyticsNavigation currentPage={currentPage} />}
        </div>
    );
};

export default ChartLayout;

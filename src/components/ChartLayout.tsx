import React, { useState, useEffect } from 'react';
import { Heading, BodyShort, Select } from '@navikt/ds-react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { type AnalyticsPage, analyticsPages } from './AnalyticsNavigation';
import Kontaktboks from './kontaktboks';

interface ChartLayoutProps {
    title: string;
    description: string;
    filters: React.ReactNode;
    children: React.ReactNode;
    currentPage?: AnalyticsPage;
    wideSidebar?: boolean;
}

const chartGroups = [
    {
        title: "Trafikk & hendelser",
        ids: ['trafikkanalyse', 'markedsanalyse', 'event-explorer']
    },
    {
        title: "Brukerreiser",
        ids: ['brukerreiser', 'hendelsesreiser', 'trakt']
    },
    {
        title: "Brukere & lojalitet",
        ids: ['brukerprofiler', 'brukerlojalitet', 'brukersammensetning']
    }
];

const ChartLayout: React.FC<ChartLayoutProps> = ({
    title,
    description,
    filters,
    children,
    currentPage,
    wideSidebar = false
}) => {
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const navigate = useNavigate();

    const handleChartChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
        const selectedId = event.target.value;
        const page = analyticsPages.find(p => p.id === selectedId);
        if (page) {
            navigate(page.href);
        }
    };

    // Trigger window resize event when sidebar toggles to help charts resize
    useEffect(() => {
        // Small delay to ensure DOM has updated
        const timer = setTimeout(() => {
            window.dispatchEvent(new Event('resize'));
        }, 100);
        return () => clearTimeout(timer);
    }, [isSidebarOpen]);

    // Define width classes based on wideSidebar prop
    const sidebarWidth = wideSidebar ? 'md:w-1/2' : 'md:w-1/3';
    const contentWidth = wideSidebar ? 'md:w-1/2' : 'md:w-2/3';
    const buttonPosition = wideSidebar ? 'left-1/2' : 'left-1/3';

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
                            <div className={`bg-[#fafafa] w-full ${sidebarWidth} p-6 border-b border-gray-200 md:border-0 md:shadow-[inset_-1px_0_0_#e5e7eb]`}>
                                <div className="space-y-4">
                                    <div className="pb-2">
                                        <Select
                                            label="Type analyse"
                                            value={currentPage || ''}
                                            onChange={handleChartChange}
                                            size="medium"
                                        >
                                            <option value="" disabled>Velg...</option>
                                            {chartGroups.map((group) => (
                                                <optgroup label={group.title} key={group.title}>
                                                    {group.ids.map(id => {
                                                        const page = analyticsPages.find(p => p.id === id);
                                                        if (!page) return null;
                                                        return (
                                                            <option key={page.id} value={page.id}>
                                                                {page.label}
                                                            </option>
                                                        );
                                                    })}
                                                </optgroup>
                                            ))}
                                            <optgroup label="Tilpasset & datasjekk">
                                                {analyticsPages
                                                    .filter(page => !chartGroups.some(g => g.ids.includes(page.id)))
                                                    .map(page => (
                                                        <option key={page.id} value={page.id}>
                                                            {page.label}
                                                        </option>
                                                    ))
                                                }
                                            </optgroup>
                                        </Select>
                                    </div>
                                    {filters}
                                </div>
                            </div>
                            {/* Collapse button on divider - hidden on mobile */}
                            <button
                                onClick={() => setIsSidebarOpen(false)}
                                className={`hidden md:flex absolute top-3 ${buttonPosition} -translate-x-1/2 items-center justify-center w-6 h-12 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-100 hover:border-blue-300 transition-colors z-10`}
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
                            className="hidden md:flex absolute top-3 left-0 -translate-x-1/2 items-center justify-center w-6 h-12 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-100 hover:border-blue-300 transition-colors z-10"
                            title="Vis filter"
                            aria-label="Vis filter"
                        >
                            <ChevronRight size={16} className="text-blue-700" aria-hidden />
                        </button>
                    )}
                    <div className={`w-full ${isSidebarOpen ? contentWidth : ''} p-6`}>
                        {children}
                    </div>
                </div>
            </div>

            {/* {currentPage && <AnalyticsNavigation currentPage={currentPage} />} */}

            <div className="mt-12">
                <Kontaktboks />
            </div>

        </div>
    );
};

export default ChartLayout;

import React, { useState, useEffect } from 'react';
import { Select, Page } from "@navikt/ds-react";
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { type AnalyticsPage, analyticsPages } from './AnalyticsNavigation';
import { KontaktSeksjon } from '../theme/Kontakt/KontaktSeksjon';
import { PageHeader } from '../theme/PageHeader/PageHeader';

interface ChartLayoutProps {
    title: string;
    description: string;
    filters?: React.ReactNode;
    children: React.ReactNode;
    currentPage?: AnalyticsPage;
    wideSidebar?: boolean;
    hideSidebar?: boolean;
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
    },
    {
        title: "Innholdskvalitet",
        ids: ['odelagte-lenker', 'stavekontroll']
    }
];

// These URL params are shared across analysis pages and should be preserved when navigating
const SHARED_PARAMS = ['urlPath', 'pagePath', 'period', 'startDate', 'endDate'];

const ChartLayout: React.FC<ChartLayoutProps> = ({
    title,
    description,
    filters,
    children,
    currentPage,
    wideSidebar = false,
    hideSidebar = false
}) => {
    const [isSidebarOpen, setIsSidebarOpen] = useState(!hideSidebar);
    const navigate = useNavigate();

    const handleChartChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
        const selectedId = event.target.value;
        const page = analyticsPages.find(p => p.id === selectedId);
        if (page) {
            // Read current URL params directly from window.location
            // (pages use window.history.replaceState which doesn't sync with React Router's useSearchParams)
            const currentParams = new URLSearchParams(window.location.search);
            const preservedParams = new URLSearchParams();

            SHARED_PARAMS.forEach(param => {
                const value = currentParams.get(param);
                if (value) {
                    preservedParams.set(param, value);
                }
            });

            const queryString = preservedParams.toString();
            const targetUrl = queryString ? `${page.href}?${queryString}` : page.href;
            navigate(targetUrl);
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
        <>
            <PageHeader
                title={title}
                description={description}
            />

            <Page.Block width="xl" gutters className="pb-16">


                <div className={hideSidebar ? 'mb-8' : 'rounded-lg shadow-sm border border-[var(--ax-border-neutral-subtle)] mb-8 bg-[var(--ax-bg-default)]'}>
                    <div className={hideSidebar ? '' : 'flex flex-col md:flex-row min-h-[600px] relative'}>
                        {isSidebarOpen && (
                            <>
                                <div className={`bg-[var(--ax-bg-accent-soft)] w-full ${sidebarWidth} p-6 border-b border-[var(--ax-border-neutral-subtle)] md:border-0 md:shadow-[inset_-1px_0_0_var(--ax-border-neutral-subtle)]`}>
                                    <div className="space-y-6">
                                        <div className="pb-2">
                                            <Select
                                                size="small"
                                                label="Type analyse"
                                                value={currentPage || ''}
                                                onChange={handleChartChange}
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
                                    className={`hidden md:flex absolute top-3 ${buttonPosition} -translate-x-1/2 items-center justify-center w-6 h-12 bg-[var(--ax-bg-default)] border border-[var(--ax-border-neutral-strong)] rounded-md shadow-sm hover:bg-[var(--ax-bg-neutral-soft)] hover:border-[var(--ax-border-accent)] transition-colors z-10`}
                                    title="Minimer filter"
                                    aria-label="Minimer filter"
                                >
                                    <ChevronLeft size={16} className="text-[var(--ax-text-accent)]" aria-hidden />
                                </button>
                            </>
                        )}
                        {!isSidebarOpen && !hideSidebar && (
                            /* Expand button on left edge - hidden on mobile */
                            <button
                                onClick={() => setIsSidebarOpen(true)}
                                className="hidden md:flex absolute top-3 left-0 -translate-x-1/2 items-center justify-center w-6 h-12 bg-[var(--ax-bg-default)] border border-[var(--ax-border-neutral-strong)] rounded-md shadow-sm hover:bg-[var(--ax-bg-neutral-soft)] transition-colors z-10"
                                title="Vis filter"
                                aria-label="Vis filter"
                            >
                                <ChevronRight size={16} className="text-[var(--ax-text-accent)]" aria-hidden />
                            </button>
                        )}
                        <div className={`w-full ${isSidebarOpen ? contentWidth : ''} ${hideSidebar ? '' : 'p-6'}`}>
                            {children}
                        </div>
                    </div>
                </div>

                {/* {currentPage && <AnalyticsNavigation currentPage={currentPage} />} */}

            </Page.Block>
            <KontaktSeksjon showMarginBottom={true} />
        </>
    );
};

export default ChartLayout;

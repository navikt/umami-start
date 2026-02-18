import React, { useEffect, useMemo, useCallback } from 'react';
import { Page, Accordion } from "@navikt/ds-react";
import { BarChart2, Users, FileSearch, Activity } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { type AnalyticsPage, analyticsPages } from './AnalyticsNavigation.tsx';
import { KontaktSeksjon } from '../../shared/ui/theme/Kontakt/KontaktSeksjon.tsx';
import { PageHeader } from '../../shared/ui/theme/PageHeader/PageHeader.tsx';
import { hasSiteimproveSupport } from '../../hooks/useSiteimproveSupport.ts';

interface ChartLayoutProps {
    title: string;
    description: string;
    filters?: React.ReactNode;
    children: React.ReactNode;
    currentPage?: AnalyticsPage;
    wideSidebar?: boolean; // Deprecated but kept for compatibility
    hideSidebar?: boolean; // Now hides the top filter bar
    hideAnalysisSelector?: boolean;
    sidebarContent?: React.ReactNode;
    websiteDomain?: string; // Domain for feature support checks
    websiteName?: string;   // Website name for dev environment detection
}

const chartGroups = [
    {
        title: "Trafikk",
        icon: <BarChart2 size={18} />,
        ids: ['trafikkanalyse', 'brukerreiser', 'trakt']
    },
    {
        title: "Hendelser",
        icon: <Activity size={18} />,
        ids: ['event-explorer', 'hendelsesreiser']
    },
    {
        title: "Brukere",
        icon: <Users size={18} />,
        ids: ['brukersammensetning', 'enkeltbrukere', 'brukerlojalitet']
    },
    {
        title: "Innholdskvalitet",
        icon: <FileSearch size={18} />,
        ids: ['odelagte-lenker', 'stavekontroll']
    }
];

const SHARED_PARAMS = ['urlPath', 'pagePath', 'period', 'startDate', 'endDate', 'from', 'to', 'websiteId', 'domain', 'pathOperator'];

interface SidebarNavigationContentProps {
    filteredChartGroups: typeof chartGroups;
    currentPage?: AnalyticsPage;
    onNavigate: (e: React.MouseEvent, href: string) => void;
}

const SidebarNavigationContent: React.FC<SidebarNavigationContentProps> = ({
    filteredChartGroups,
    currentPage,
    onNavigate
}) => (
    <>
        {filteredChartGroups.map((group) => (
            <div key={group.title}>
                <div className="flex items-center gap-2 px-3 mb-2 text-sm font-semibold text-[var(--ax-text-subtle)] tracking-wide mt-4">
                    {group.icon}
                    <span>{group.title}</span>
                </div>
                <ul className="space-y-0.5">
                    {group.ids.map(id => {
                        const page = analyticsPages.find(p => p.id === id);
                        if (!page) return null;
                        const isActive = currentPage === page.id;
                        return (
                            <li key={page.id}>
                                <a
                                    href={page.href}
                                    onClick={(e) => onNavigate(e, page.href)}
                                    className={`block px-3 py-2 text-base font-medium rounded-md transition-all duration-200 truncate ${isActive
                                        ? 'bg-[var(--ax-bg-accent-strong)] text-white shadow-sm'
                                        : 'text-[var(--ax-text-default)] hover:bg-[var(--ax-bg-neutral-moderate)] hover:text-[var(--ax-text-strong)]'
                                        }`}
                                    title={page.label}
                                >
                                    {page.label}
                                </a>
                            </li>
                        );
                    })}
                </ul>
            </div>
        ))}
    </>
);

const ChartLayout: React.FC<ChartLayoutProps> = ({
    title,
    description,
    filters,
    children,
    currentPage,
    hideSidebar = false,
    hideAnalysisSelector = false,
    sidebarContent,
    websiteDomain
}) => {
    // State for Sidebars
    const isNavOpen = !hideAnalysisSelector;

    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    // Get domain from prop or URL params and check feature support
    const domain = websiteDomain || searchParams.get('domain');
    const showSiteimproveSection = useMemo(() => hasSiteimproveSupport(domain), [domain]);

    // Filter chart groups based on feature support
    const filteredChartGroups = useMemo(() => {
        let groups = chartGroups;

        // Filter out Innholdskvalitet if Siteimprove not supported
        if (!showSiteimproveSection) {
            groups = groups.filter(group => group.title !== "Innholdskvalitet");
        }

        return groups;
    }, [showSiteimproveSection]);

    const getTargetUrl = useCallback((href: string) => {
        const currentParams = new URLSearchParams(window.location.search);
        const preservedParams = new URLSearchParams();

        SHARED_PARAMS.forEach(param => {
            const value = currentParams.get(param);
            if (value) {
                preservedParams.set(param, value);
            }
        });

        const queryString = preservedParams.toString();
        return queryString ? `${href}?${queryString}` : href;
    }, []);

    const handleNavigation = useCallback((e: React.MouseEvent, href: string) => {
        e.preventDefault();
        const targetUrl = getTargetUrl(href);
        void navigate(targetUrl);
    }, [getTargetUrl, navigate]);

    // Trigger resize for charts when sidebar widths change
    useEffect(() => {
        const timer = setTimeout(() => {
            window.dispatchEvent(new Event('resize'));
        }, 100);
        return () => clearTimeout(timer);
    }, [isNavOpen]);

    return (
        <>
            <PageHeader
                title={title}
                description={description}
                width="2xl"
            />

            <Page.Block width="2xl" gutters className="pb-16">
                <div className="rounded-lg shadow-sm border border-[var(--ax-border-neutral-subtle)] mb-8 bg-[var(--ax-bg-default)] overflow-hidden">

                    {/* Unified Top Bar */}
                    {(sidebarContent || (!hideSidebar && filters)) && (
                    <div className="border-b border-[var(--ax-border-neutral-subtle)] bg-[var(--ax-bg-neutral-subtle)] flex flex-col md:flex-row md:min-h-[80px]">
                        
                        {/* Left Column Header (Sidebar Content) */}
                        {!hideAnalysisSelector && (
                        <div className="w-full md:w-[250px] flex-shrink-0 border-b md:border-b-0 p-4 flex flex-col justify-end transition-all duration-300">
                            {sidebarContent}
                        </div>
                        )}

                        {/* Right Column Header (Filters) */}
                        <div className="w-full md:flex-1 p-4 flex flex-wrap items-end gap-4 border-b md:border-b-0 border-[var(--ax-border-neutral-subtle)] md:border-none">
                        {!hideSidebar && filters}
                        </div>

                    </div>
                    )}

                    <div className="flex flex-col md:flex-row min-h-[800px] relative transition-all duration-300">

                        {/* ================= COL 1: NAVIGATION ================= */}
                        {!hideAnalysisSelector && (
                            <div className="md:w-[250px] bg-[var(--ax-bg-neutral-soft)] md:border-b-0 flex-shrink-0">


                                {/* Mobile: Accordion View */}
                                <div className="md:hidden">
                                    <Accordion size="small" headingSize="xsmall" className="border-b border-[var(--ax-border-neutral-subtle)] md:border-none">
                                        <Accordion.Item>
                                            <Accordion.Header>Velg analyse</Accordion.Header>
                                            <Accordion.Content className="p-0 border-t border-[var(--ax-border-neutral-subtle)]">
                                                <div className="p-4 bg-[var(--ax-bg-neutral-soft)]">
                                                    <SidebarNavigationContent
                                                        filteredChartGroups={filteredChartGroups}
                                                        currentPage={currentPage}
                                                        onNavigate={handleNavigation}
                                                    />
                                                </div>
                                            </Accordion.Content>
                                        </Accordion.Item>
                                    </Accordion>
                                </div>

                                {/* Desktop: Standard View */}
                                <div className="hidden md:flex flex-col h-full overflow-y-auto overflow-x-hidden min-w-[250px] p-4 space-y-6">
                                    <SidebarNavigationContent
                                        filteredChartGroups={filteredChartGroups}
                                        currentPage={currentPage}
                                        onNavigate={handleNavigation}
                                    />
                                </div>
                            </div>
                        )}

                        {/* ================= COL 2: CONTENT ================= */}
                        <div className="flex-1 min-w-0 bg-[var(--ax-bg-default)] flex flex-col z-0 relative">
                            <div className="p-6 md:p-8 flex-1 overflow-x-auto">
                                {children}
                            </div>
                        </div>

                    </div>
                </div>
            </Page.Block>
            <KontaktSeksjon showMarginBottom={true} />
        </>
    );
};

export default ChartLayout;

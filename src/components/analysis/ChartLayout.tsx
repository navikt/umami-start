import React, { useEffect } from 'react';
import { Page, Accordion } from "@navikt/ds-react";
import { BarChart2, Users, FileSearch, Activity, Layout } from 'lucide-react';
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
    wideSidebar?: boolean; // Deprecated but kept for compatibility
    hideSidebar?: boolean; // Now hides the top filter bar
    hideAnalysisSelector?: boolean;
    sidebarContent?: React.ReactNode;
}

const chartGroups = [
    {
        title: "Trafikk & hendelser",
        icon: <Activity size={18} />,
        ids: ['trafikkanalyse', 'markedsanalyse', 'event-explorer']
    },
    {
        title: "Brukere",
        icon: <Users size={18} />,
        ids: ['brukersammensetning', 'brukerprofiler', 'brukerlojalitet']
    },
    {
        title: "Brukerreiser",
        icon: <BarChart2 size={18} />,
        ids: ['brukerreiser', 'hendelsesreiser', 'trakt']
    },
    {
        title: "Innholdskvalitet",
        icon: <FileSearch size={18} />,
        ids: ['odelagte-lenker', 'stavekontroll']
    },
    {
        title: "Datasjekk",
        icon: <Layout size={18} />,
        ids: ['diagnose', 'personvern']
    }
];

// Pages to exclude from the automatic list (SqlEditor and Chartbuilder)
const EXCLUDED_PAGES = ['sql', 'grafbygger'];

const SHARED_PARAMS = ['urlPath', 'pagePath', 'period', 'startDate', 'endDate', 'from', 'to', 'websiteId', 'domain'];



const ChartLayout: React.FC<ChartLayoutProps> = ({
    title,
    description,
    filters,
    children,
    currentPage,
    hideSidebar = false,
    hideAnalysisSelector = false,
    sidebarContent
}) => {
    // State for Sidebars
    const isNavOpen = !hideAnalysisSelector;

    const navigate = useNavigate();

    const getTargetUrl = (href: string) => {
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
    };

    const handleNavigation = (e: React.MouseEvent, href: string) => {
        e.preventDefault();
        const targetUrl = getTargetUrl(href);
        navigate(targetUrl);
    };

    // Trigger resize for charts when sidebar widths change
    useEffect(() => {
        const timer = setTimeout(() => {
            window.dispatchEvent(new Event('resize'));
        }, 100);
        return () => clearTimeout(timer);
    }, [isNavOpen]);

    // Calculate closed/open states for showing the "Expand" buttons on the left edge

    const SidebarNavigationContent = () => (
        <>
            {chartGroups.map((group) => (
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
                                        onClick={(e) => handleNavigation(e, page.href)}
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
                        <div className="border-b border-[var(--ax-border-neutral-subtle)] bg-[var(--ax-bg-accent-soft)] flex flex-col md:flex-row min-h-[0px] md:min-h-[80px]">
                            {/* Left Column Header (Sidebar Content) */}
                            {!hideAnalysisSelector && (
                                <div
                                    className="w-full md:w-[250px] flex-shrink-0 border-b md:border-b-0 p-4 flex flex-col justify-end transition-all duration-300"
                                >
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
                            <div className="md:w-[250px] bg-[var(--ax-bg-neutral-soft)] border-b md:border-b-0 md:border-r border-[var(--ax-border-neutral-subtle)] flex-shrink-0">

                                {/* Mobile: Accordion View */}
                                <div className="md:hidden">
                                    <Accordion size="small" headingSize="xsmall" className="border-b border-[var(--ax-border-neutral-subtle)] md:border-none">
                                        <Accordion.Item>
                                            <Accordion.Header>Velg analyse</Accordion.Header>
                                            <Accordion.Content className="p-0 border-t border-[var(--ax-border-neutral-subtle)]">
                                                <div className="p-4 bg-[var(--ax-bg-neutral-soft)]">
                                                    <SidebarNavigationContent />
                                                </div>
                                            </Accordion.Content>
                                        </Accordion.Item>
                                    </Accordion>
                                </div>

                                {/* Desktop: Standard View */}
                                <div className="hidden md:flex flex-col h-full overflow-y-auto overflow-x-hidden min-w-[250px] p-4 space-y-6">
                                    <SidebarNavigationContent />
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

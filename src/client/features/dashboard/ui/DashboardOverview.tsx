import { Heading, LinkPanel, Page } from "@navikt/ds-react";
import { Link as RouterLink } from "react-router-dom";
import { dashboards } from "../../../../data/dashboard";
import { BarChartIcon, Buildings3Icon, ExternalLinkIcon, WheelchairIcon } from "@navikt/aksel-icons";
import { UrlSearchForm } from "..";
import { KontaktSeksjon } from "../../../shared/ui/theme/Kontakt/KontaktSeksjon.tsx";

// Map dashboard IDs to metadata (icons and custom titles)
const dashboardMeta: Record<string, { icon: React.ReactNode; title?: string }> = {
    'standard': {
        icon: <BarChartIcon className="w-8 h-8 text-[var(--ax-text-accent)]" aria-hidden />,
        title: 'Webstatistikk (generelt)'
    },
    'fylkeskontor': {
        icon: <Buildings3Icon className="w-8 h-8 text-[var(--ax-text-accent)]" aria-hidden />,
        title: 'Nav fylkeskontor'
    },
    'hjelpemiddelsentral': {
        icon: <WheelchairIcon className="w-8 h-8 text-[var(--ax-text-accent)]" aria-hidden />,
        title: 'Hjelpemiddelsentralene'
    }
};

const DashboardOverview = () => {
    const dashboardEntries = Object.entries(dashboards);

    return (
        <>
            <div style={{
                width: "100%",
                backgroundColor: "var(--ax-bg-accent-soft)",
                color: "var(--ax-text-default)",
                paddingTop: "70px",
                paddingBottom: "70px",
            }}>
                <Page.Block width="xl" gutters>
                    <Heading spacing={true} as="h2" size="large">Nav webstatistikk</Heading>
                    <UrlSearchForm>
                        <div style={{ marginTop: '16px', display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                            <RouterLink
                                to="/dashboard?visning=fylkeskontor"
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    padding: '6px 12px',
                                    borderRadius: '999px',
                                    backgroundColor: 'var(--ax-bg-default)',
                                    border: '1px solid var(--ax-border-neutral-subtle)',
                                    color: 'var(--ax-text-default)',
                                    textDecoration: 'none',
                                    fontSize: '14px'
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor = 'var(--ax-bg-neutral-soft)';
                                    e.currentTarget.style.textDecoration = 'underline';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = 'var(--ax-bg-default)';
                                    e.currentTarget.style.textDecoration = 'none';
                                }}
                            >
                                <Buildings3Icon aria-hidden />
                                Nav fylkeskontor
                            </RouterLink>
                            <RouterLink
                                to="/dashboard?visning=hjelpemiddelsentral"
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    padding: '6px 12px',
                                    borderRadius: '999px',
                                    backgroundColor: 'var(--ax-bg-default)',
                                    border: '1px solid var(--ax-border-neutral-subtle)',
                                    color: 'var(--ax-text-default)',
                                    textDecoration: 'none',
                                    fontSize: '14px'
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor = 'var(--ax-bg-neutral-soft)';
                                    e.currentTarget.style.textDecoration = 'underline';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = 'var(--ax-bg-default)';
                                    e.currentTarget.style.textDecoration = 'none';
                                }}
                            >
                                <WheelchairIcon aria-hidden />
                                Hjelpemiddelsentralene
                            </RouterLink>
                        </div>
                    </UrlSearchForm>
                </Page.Block>
            </div>

            <Page.Block width="xl" gutters>
                <div className="pt-12 pb-16">
                    <section>
                        <div className="mb-8">
                            <Heading size="medium" level="2">
                                Umami-dashbord
                            </Heading>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {dashboardEntries.map(([id, config]) => {
                                const meta = dashboardMeta[id] || {
                                    icon: <BarChartIcon className="w-8 h-8 text-[var(--ax-text-accent)]" aria-hidden />
                                };

                                return (
                                    <LinkPanel
                                        as={RouterLink}
                                        key={id}
                                        to={`/dashboard?visning=${id}`}
                                        border
                                        className="hover:shadow-md transition-shadow group"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="flex-shrink-0 p-2 bg-[var(--ax-bg-accent-soft)] rounded-lg group-hover:bg-[var(--ax-bg-accent-soft-hover)] transition-colors">
                                                {meta.icon}
                                            </div>
                                            <div>
                                                <div className="text-base font-semibold text-[var(--ax-text-default)]">
                                                    {meta.title || config.title}
                                                </div>
                                            </div>
                                        </div>
                                    </LinkPanel>
                                );
                            })}
                        </div>
                    </section>

                    <section className="mt-20">
                        <div className="mb-8">
                            <Heading size="medium" level="2">
                                Metabase-dashbord
                            </Heading>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            <LinkPanel
                                as="a"
                                href="https://metabase.ansatt.nav.no/"
                                target="_blank"
                                border
                                className="hover:shadow-md transition-shadow group"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="flex-shrink-0 p-2 bg-[var(--ax-bg-accent-soft)] rounded-lg group-hover:bg-[var(--ax-bg-accent-soft-hover)] transition-colors">
                                        <ExternalLinkIcon className="w-8 h-8 text-[var(--ax-text-accent)]" aria-hidden />
                                    </div>
                                    <div>
                                        <div className="text-base font-semibold text-[var(--ax-text-default)]">
                                            Gå til Metabase
                                        </div>
                                    </div>
                                </div>
                            </LinkPanel>
                        </div>
                    </section>
                </div>
            </Page.Block>
            <KontaktSeksjon showMarginBottom={true} />
        </>
    );
};

export default DashboardOverview;

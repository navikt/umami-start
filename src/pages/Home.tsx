import { Heading, Link, Page } from "@navikt/ds-react";
import UrlSearchForm from "../components/dashboard/UrlSearchForm";
import { analyticsPages } from "../components/analysis/AnalyticsNavigation";
import { KontaktSeksjon } from "../components/theme/Kontakt/KontaktSeksjon";
import WebsitePicker, { Website } from "../components/analysis/WebsitePicker";
import { useState, useMemo } from "react";
import { useSiteimproveSupport, useMarketingSupport } from "../hooks/useSiteimproveSupport";

// Section configuration for the 3-column layout
const sections = [
    {
        title: "Trafikk & hendelser",
        description: "Forstå hva som påvirker trafikken",
        bgColor: "var(--ax-bg-default)",
        accentColor: "var(--ax-bg-accent-strong)",
        ids: ['trafikkanalyse', 'markedsanalyse', 'event-explorer']
    },
    {
        title: "Brukerreiser",
        description: "Se hvordan besøkende navigerer",
        bgColor: "var(--ax-bg-default)",
        accentColor: "var(--ax-bg-accent-strong)",
        ids: ['brukerreiser', 'hendelsesreiser', 'trakt']
    },
    {
        title: "Brukere & lojalitet",
        description: "Forstå hvem de besøkende er",
        bgColor: "var(--ax-bg-default)",
        accentColor: "var(--ax-bg-accent-strong)",
        ids: ['brukerprofiler', 'brukerlojalitet', 'brukersammensetning']
    }
];

// Content quality section
const contentQualitySection = {
    title: "Innholdskvalitet",
    description: "Sjekk kvaliteten på innholdet",
    bgColor: "var(--ax-bg-default)",
    accentColor: "var(--ax-bg-accent-strong)",
    ids: ['odelagte-lenker', 'stavekontroll']
};

function Home() {
    const [selectedWebsite, setSelectedWebsite] = useState<Website | null>(null);
    const hasSiteimprove = useSiteimproveSupport(selectedWebsite?.domain);
    const hasMarketing = useMarketingSupport(selectedWebsite?.domain);

    // Filter sections based on feature support
    const filteredSections = useMemo(() => {
        return sections.map(section => {
            if (section.title === "Trafikk & hendelser" && !hasMarketing) {
                return {
                    ...section,
                    ids: section.ids.filter(id => id !== 'markedsanalyse')
                };
            }
            return section;
        });
    }, [hasMarketing]);

    return (
        <>
            {/* Hero section */}
            {/* Hero section */}
            <div style={{
                width: "100%",
                backgroundColor: "var(--ax-bg-accent-soft)",
                color: "var(--ax-text-default)",
                paddingTop: "70px",
                paddingBottom: "70px",
            }}>
                <Page.Block width="xl" gutters>
                    <Heading spacing={true} as="h2" size="large">Mål brukeradferd med Umami</Heading>
                    <UrlSearchForm>
                        {/* Shortcuts temporarily disabled
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
                        */}
                    </UrlSearchForm>
                </Page.Block>
            </div>

            <Page.Block width="xl" gutters>
                <div style={{ marginTop: "38px", marginBottom: "32px" }}>
                    <Heading as="h3" size="medium">Hva ønsker du å analysere?</Heading>
                    <div style={{ marginTop: '16px', maxWidth: '400px' }}>
                        <WebsitePicker
                            selectedWebsite={selectedWebsite}
                            onWebsiteChange={setSelectedWebsite}
                            variant="minimal"
                        />
                    </div>
                </div>

                {/* 3-Column Analysis Cards */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                    gap: '24px',
                    marginBottom: '25px'
                }}>
                    {filteredSections.map((section) => (
                        <div
                            key={section.title}
                            style={{
                                backgroundColor: section.bgColor,
                                padding: '32px',
                                borderRadius: '12px',
                                display: 'flex',
                                flexDirection: 'column',
                                border: `1px solid var(--ax-border-neutral-subtle)`,
                            }}
                        >
                            <div style={{
                                borderLeft: `4px solid ${section.accentColor}`,
                                paddingLeft: '16px',
                                marginBottom: '24px'
                            }}>
                                <Heading as="h3" size="small" style={{ color: 'var(--ax-text-default)', marginBottom: '4px' }}>
                                    {section.title}
                                </Heading>
                                <p style={{ fontSize: '16px', color: 'var(--ax-text-subtle)', margin: 0 }}>{section.description}</p>
                            </div>

                            <nav style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {analyticsPages
                                    .filter(page => section.ids.includes(page.id))
                                    .map(page => (
                                        <Link
                                            key={page.id}
                                            href={page.href}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                padding: '16px 20px',
                                                backgroundColor: 'var(--ax-bg-default)',
                                                borderRadius: '8px',
                                                textDecoration: 'none',
                                                color: 'var(--ax-text-default)',
                                                border: '1px solid var(--ax-border-neutral-subtle)', // Border for buttons
                                                transition: 'all 0.2s ease',
                                                fontWeight: 500
                                            }}
                                            onMouseEnter={(e) => {
                                                e.currentTarget.style.borderColor = 'var(--ax-border-neutral-strong)';
                                                e.currentTarget.style.backgroundColor = 'var(--ax-bg-neutral-soft)';
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.borderColor = 'var(--ax-border-neutral-subtle)';
                                                e.currentTarget.style.backgroundColor = 'var(--ax-bg-default)';
                                            }}
                                        >
                                            <span>{page.label}</span>
                                            <span style={{ color: section.accentColor, fontSize: '18px' }}>→</span>
                                        </Link>
                                    ))}
                            </nav>
                        </div>
                    ))}
                </div>

                {/* Bottom section: Innholdskvalitet + Grafbygger */}
                <div
                    className="bottom-grid"
                    style={{
                        display: 'grid',
                        gap: '24px',
                        marginTop: '25px',
                        marginBottom: '40px'
                    }}>
                    {/* Innholdskvalitet Card - Only show if Siteimprove is supported */}
                    {hasSiteimprove && (
                        <div
                            style={{
                                backgroundColor: contentQualitySection.bgColor,
                                padding: '32px',
                                borderRadius: '12px',
                                display: 'flex',
                                flexDirection: 'column',
                                border: `1px solid var(--ax-border-neutral-subtle)`,
                            }}
                        >
                            <div style={{
                                borderLeft: `4px solid ${contentQualitySection.accentColor}`,
                                paddingLeft: '16px',
                                marginBottom: '24px'
                            }}>
                                <Heading as="h3" size="small" style={{ color: 'var(--ax-text-default)', marginBottom: '4px' }}>
                                    {contentQualitySection.title}
                                </Heading>
                                <p style={{ fontSize: '16px', color: 'var(--ax-text-subtle)', margin: 0 }}>{contentQualitySection.description}</p>
                            </div>

                            <nav style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {analyticsPages
                                    .filter(page => contentQualitySection.ids.includes(page.id))
                                    .map(page => (
                                        <Link
                                            key={page.id}
                                            href={page.href}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                padding: '16px 20px',
                                                backgroundColor: 'var(--ax-bg-default)',
                                                borderRadius: '8px',
                                                textDecoration: 'none',
                                                color: 'var(--ax-text-default)',
                                                border: '1px solid var(--ax-border-neutral-subtle)',
                                                transition: 'all 0.2s ease',
                                                fontWeight: 500
                                            }}
                                            onMouseEnter={(e) => {
                                                e.currentTarget.style.borderColor = 'var(--ax-border-neutral-strong)';
                                                e.currentTarget.style.backgroundColor = 'var(--ax-bg-neutral-soft)';
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.borderColor = 'var(--ax-border-neutral-subtle)';
                                                e.currentTarget.style.backgroundColor = 'var(--ax-bg-default)';
                                            }}
                                        >
                                            <span>{page.label}</span>
                                            <span style={{ color: contentQualitySection.accentColor, fontSize: '18px' }}>→</span>
                                        </Link>
                                    ))}
                            </nav>
                        </div>
                    )}

                    {/* Grafbygger section */}
                    <div style={{
                        border: '1px solid var(--ax-border-neutral-subtle)',
                        padding: '40px',
                        backgroundColor: 'var(--ax-bg-default)',
                        borderRadius: '16px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'flex-start',
                        justifyContent: 'center',
                        gap: '24px'
                    }}>
                        <div>
                            <Heading as="h3" size="small" style={{ marginBottom: '12px' }}>
                                Lag tilpassede grafer og tabeller
                            </Heading>
                            <p style={{ margin: 0, color: 'var(--ax-text-subtle)', maxWidth: '700px', fontSize: '18px', lineHeight: '1.5' }}>
                                Grafbyggeren lar deg skreddersy grafer og tabeller, som kan deles og legges til i Metabase.
                            </p>
                        </div>
                        <Link
                            href="/grafbygger"
                            className="primary-button"
                        >
                            Gå til Grafbyggeren
                        </Link>
                    </div>
                </div>
            </Page.Block>

            {/* Full-width contact section - Home page only */}
            <KontaktSeksjon showMarginBottom={true} />
        </>
    )
}

export default Home
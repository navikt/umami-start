import { BodyShort, Heading, Link, Page } from "@navikt/ds-react";
import TeamWebsites from "../../components/settings/TeamWebsites";
import { KontaktSeksjon } from "../../components/theme/Kontakt/KontaktSeksjon";
import { developerTools } from "../../components/analysis/DeveloperToolsNavigation";

function Oppsett() {
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
                    <Heading spacing level="1" size="large">
                        Oppsett av Umami
                    </Heading>

                    <BodyShort size="large" className="mt-4">
                        Her finner du guider, utviklerverktøy og <Link href="#sporingskoder">sporingskoder</Link> for Umami.
                    </BodyShort>
                </Page.Block>
            </div>

            <Page.Block width="xl" gutters className="pb-16 px-4">
                {/* Kom i gang CTA */}
                <div style={{
                    marginTop: '48px',
                    border: '1px solid var(--ax-border-subtle)',
                    marginBottom: '48px',
                    padding: '40px',
                    backgroundColor: 'var(--ax-bg-accent-soft)',
                    borderRadius: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    gap: '24px'
                }}>
                    <div>
                        <Heading as="h3" size="small" style={{ marginBottom: '12px', color: 'var(--ax-text-accent)' }}>
                            Kom i gang med Umami
                        </Heading>
                        <p style={{ margin: 0, color: 'var(--ax-text-subtle)', maxWidth: '700px', fontSize: '18px', lineHeight: '1.5' }}>
                            Følg kom-i-gang-guiden for å lære hvordan du setter opp Umami for din nettside eller app.
                        </p>
                    </div>
                    <Link
                        href="/komigang"
                        style={{
                            display: 'inline-block',
                            padding: '14px 32px',
                            backgroundColor: 'var(--ax-bg-accent-strong)',
                            color: 'var(--ax-text-contrast)',
                            borderRadius: '50px',
                            textDecoration: 'none',
                            fontWeight: 600,
                            fontSize: '16px',
                            transition: 'all 0.2s',
                            boxShadow: '0 2px 4px rgba(0, 103, 197, 0.2)'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = 'var(--ax-bg-accent-strong-hover)';
                            e.currentTarget.style.transform = 'translateY(-1px)';
                            e.currentTarget.style.boxShadow = '0 4px 6px rgba(0, 103, 197, 0.3)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'var(--ax-bg-accent-strong)';
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.boxShadow = '0 2px 4px rgba(0, 103, 197, 0.2)';
                        }}
                    >
                        Gå til kom-i-gang-guiden
                    </Link>
                </div>

                <Heading spacing as="h2" size="medium" className="mt-12 mb-6">
                    Utviklerverktøy
                </Heading>

                {/* 3-Column Analysis Cards */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                    gap: '24px',
                    marginBottom: '48px'
                }}>
                    {[
                        {
                            title: "Grafbygging",
                            description: "Sett opp avanserte dashboards og kjør direkte SQL-spørringer mot dataene.",
                            ids: ['grafbygger', 'sql']
                        },
                        {
                            title: "Datasjekk",
                            description: "Verktøy for å validere oppsettet og sikre at personvern ivaretas.",
                            ids: ['personvern', 'diagnose']
                        },
                        {
                            title: "Aktiviteter",
                            description: "Gå i dybden på enkelthendelser og forstå enkeltbrukeres reiser.",
                            ids: ['event-explorer', 'brukerprofiler']
                        }
                    ].map((section) => (
                        <div
                            key={section.title}
                            style={{
                                backgroundColor: 'var(--ax-bg-default)',
                                padding: '32px',
                                borderRadius: '12px',
                                display: 'flex',
                                flexDirection: 'column',
                                border: `1px solid var(--ax-border-subtle)`,
                            }}
                        >
                            <div style={{
                                borderLeft: `4px solid var(--ax-bg-accent-strong)`,
                                paddingLeft: '16px',
                                marginBottom: '24px'
                            }}>
                                <Heading as="h3" size="small" style={{ color: 'var(--ax-text-default)', marginBottom: '4px' }}>
                                    {section.title}
                                </Heading>
                            </div>

                            <nav style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {developerTools
                                    .filter(tool => section.ids.includes(tool.id))
                                    .map(tool => (
                                        <Link
                                            key={tool.id}
                                            href={tool.href}
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
                                            <span>{tool.label}</span>
                                            <span style={{ color: 'var(--ax-text-accent)', fontSize: '18px' }}>→</span>
                                        </Link>
                                    ))}
                            </nav>
                        </div>
                    ))}
                </div>

                <Heading spacing as="h2" size="medium" className="mt-12 mb-3" id="sporingskoder">
                    Sporingskoder
                </Heading>
                <BodyShort className="mb-8">
                    Kontakt <Link target="_blank" href="https://nav-it.slack.com/archives/C02UGFS2J4B">#ResearchOps på Slack</Link> for å få sporingskode til nettsiden eller appen din.
                </BodyShort>

                <TeamWebsites />

                <BodyShort style={{ marginTop: "40px", marginBottom: "60px" }}>
                    For teknisk dokumentasjon, <Link target="_blank" href="https://umami.is/docs/tracker-configuration">se Umami sin dokumentasjonsside</Link>.
                </BodyShort>
            </Page.Block>
            <KontaktSeksjon showMarginBottom={true} />
        </>
    );
}

export default Oppsett;

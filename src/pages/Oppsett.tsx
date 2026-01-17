import { BodyShort, Heading, Link } from "@navikt/ds-react";
import TeamWebsites from "../components/teamwebsites.tsx";
import Kontaktboks from "../components/kontaktboks.tsx";
import { developerTools } from "../components/DeveloperToolsNavigation.tsx";

function Oppsett() {
    return (
        <div className="w-full mx-auto">
            <Heading spacing level="1" size="large" className="pt-24">
                Oppsett av Umami
            </Heading>

            <BodyShort size="large" className="mb-8 max-w-[800px]">
                Her finner du guider, utviklerverktøy og <Link href="#sporingskoder">sporingskoder</Link> for Umami.
            </BodyShort>

            {/* Kom i gang CTA */}
            <div style={{
                border: '1px solid #ddd',
                marginBottom: '48px',
                padding: '40px',
                backgroundColor: 'rgb(230, 242, 255)',
                borderRadius: '16px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                gap: '24px'
            }}>
                <div>
                    <Heading as="h3" size="small" style={{ marginBottom: '12px', color: '#00347d' }}>
                        Kom i gang med Umami
                    </Heading>
                    <p style={{ margin: 0, color: '#444', maxWidth: '700px', fontSize: '18px', lineHeight: '1.5' }}>
                        Følg kom-i-gang-guiden for å lære hvordan du setter opp Umami for din nettside eller app.
                    </p>
                </div>
                <Link
                    href="/komigang"
                    style={{
                        display: 'inline-block',
                        padding: '14px 32px',
                        backgroundColor: '#0067C5',
                        color: 'white',
                        borderRadius: '50px',
                        textDecoration: 'none',
                        fontWeight: 600,
                        fontSize: '16px',
                        transition: 'all 0.2s',
                        boxShadow: '0 2px 4px rgba(0, 103, 197, 0.2)'
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#0056b4';
                        e.currentTarget.style.transform = 'translateY(-1px)';
                        e.currentTarget.style.boxShadow = '0 4px 6px rgba(0, 103, 197, 0.3)';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = '#0067C5';
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = '0 2px 4px rgba(0, 103, 197, 0.2)';
                    }}
                >
                    Gå til kom-i-gang-guiden
                </Link>
            </div>

            <Heading spacing as="h2" size="medium" className="mt-12 mb-3">
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
                            backgroundColor: '#fff',
                            padding: '32px',
                            borderRadius: '12px',
                            display: 'flex',
                            flexDirection: 'column',
                            border: `1px solid #ccc`,
                        }}
                    >
                        <div style={{
                            borderLeft: `4px solid #0067C5`,
                            paddingLeft: '16px',
                            marginBottom: '24px'
                        }}>
                            <Heading as="h3" size="small" style={{ color: '#1a1a1a', marginBottom: '4px' }}>
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
                                            backgroundColor: 'white',
                                            borderRadius: '8px',
                                            textDecoration: 'none',
                                            color: '#262626',
                                            border: '1px solid #ddd',
                                            transition: 'all 0.2s ease',
                                            fontWeight: 500
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.borderColor = '#999';
                                            e.currentTarget.style.backgroundColor = '#f8f8f8';
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.borderColor = '#ddd';
                                            e.currentTarget.style.backgroundColor = 'white';
                                        }}
                                    >
                                        <span>{tool.label}</span>
                                        <span style={{ color: '#0067C5', fontSize: '18px' }}>→</span>
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

            <div className="mt-8 mb-8">
                <Kontaktboks />
            </div>
        </div>
    );
}

export default Oppsett;

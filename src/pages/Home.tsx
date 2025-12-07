import { Heading, Link, Page } from "@navikt/ds-react";
import Metadashboard from "../components/metadashboard.tsx";
import Kontaktboks from "../components/kontaktboks.tsx";
import { analyticsPages } from "../components/AnalyticsNavigation.tsx";

// Section configuration for the 3-column layout
const sections = [
    {
        title: "Trafikk & hendelser",
        description: "Se trafikk og hendelser",
        bgColor: "#fff",
        accentColor: "#0067C5",
        ids: ['trafikkanalyse', 'markedsanalyse', 'event-explorer']
    },
    {
        title: "Brukerreiser",
        description: "Se hvordan besøkende navigerer",
        bgColor: "#fff",
        accentColor: "#0067C5",
        ids: ['brukerreiser', 'hendelsesreiser', 'trakt']
    },
    {
        title: "Brukere & lojalitet",
        description: "Forstå hvem de besøkende er",
        bgColor: "#fff",
        accentColor: "#0067C5",
        ids: ['brukerprofiler', 'brukerlojalitet', 'brukersammensetning']
    }
];

function Home() {
    return (
        <>
            {/* Hero section */}
            <div style={{
                width: "100%",
                backgroundColor: "rgb(230, 242, 255)",
                color: "rgb(19, 17, 54)",
                paddingTop: "80px",
                paddingBottom: "80px",
            }}>
                <Page.Block width="xl" gutters>
                    <Heading spacing={true} as="h2" size="large">Mål brukeradferd med Umami</Heading>
                    <Metadashboard />
                </Page.Block>
            </div>

            <Page.Block width="xl" gutters>
                <div style={{ marginTop: "48px", marginBottom: "32px" }}>
                    <Heading as="h3" size="medium">Hva ønsker du å analysere?</Heading>
                </div>

                {/* 3-Column Analysis Cards */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                    gap: '24px',
                    marginBottom: '48px'
                }}>
                    {sections.map((section) => (
                        <div
                            key={section.title}
                            style={{
                                backgroundColor: section.bgColor,
                                padding: '32px',
                                borderRadius: '12px',
                                display: 'flex',
                                flexDirection: 'column',
                                border: `1px solid #ccc`, // Stronger border for visibility
                            }}
                        >
                            <div style={{
                                borderLeft: `4px solid ${section.accentColor}`,
                                paddingLeft: '16px',
                                marginBottom: '24px'
                            }}>
                                <Heading as="h3" size="small" style={{ color: '#1a1a1a', marginBottom: '4px' }}>
                                    {section.title}
                                </Heading>
                                <p style={{ fontSize: '16px', color: '#444', margin: 0 }}>{section.description}</p>
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
                                                backgroundColor: 'white',
                                                borderRadius: '8px',
                                                textDecoration: 'none',
                                                color: '#262626',
                                                border: '1px solid #ddd', // Border for buttons
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
                                            <span>{page.label}</span>
                                            <span style={{ color: section.accentColor, fontSize: '18px' }}>→</span>
                                        </Link>
                                    ))}
                            </nav>
                        </div>
                    ))}
                </div>

                {/* Grafbygger section */}
                <div style={{
                    marginBottom: '60px',
                    padding: '40px',
                    backgroundColor: 'rgb(230, 242, 255)',  // Same light blue as hero
                    borderRadius: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start', // Left align
                    gap: '24px'
                }}>
                    <div>
                        <Heading as="h3" size="small" style={{ marginBottom: '12px', color: '#00347d' }}>
                            Lag grafer og tabeller for Metabase
                        </Heading>
                        <p style={{ margin: 0, color: '#444', maxWidth: '700px', fontSize: '18px', lineHeight: '1.5' }}>
                            Grafbyggeren lar deg skreddersy grafer og tabeller, som kan deles og legges til i Metabase.
                        </p>
                    </div>
                    <Link
                        href="/grafbygger"
                        style={{
                            display: 'inline-block',
                            padding: '14px 32px',
                            backgroundColor: '#0067C5', // Primary blue
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
                        Åpne Grafbyggeren
                    </Link>
                </div>

                <div style={{ marginTop: '0px', marginBottom: '80px' }}>
                    <Kontaktboks />
                </div>
            </Page.Block>
        </>
    )
}

export default Home
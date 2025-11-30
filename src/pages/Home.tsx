import { Heading, Link, LinkCard, Page } from "@navikt/ds-react";
import Metadashboard from "../components/metadashboard.tsx";
import Kontaktboks from "../components/kontaktboks.tsx";
import { analyticsPages } from "../components/AnalyticsNavigation.tsx";

function Home() {


    return (
        <>
            <div style={{
                width: "100%",
                backgroundColor: "rgb(230, 242, 255)",
                color: "rgb(19, 17, 54)",
                paddingTop: "80px",
                paddingBottom: "60px",
                marginBottom: "40px"
            }}>
                <Page.Block width="xl" gutters>
                    <Heading spacing={true} as="h2" size="large">Mål brukeradferd med
                        Umami</Heading>
                    <Metadashboard />
                </Page.Block>
            </div>

            <Page.Block width="xl" gutters>
                <Heading spacing={true} as="h3" size="medium" style={{ marginTop: "40px", marginBottom: "24px" }}>Hva ønsker du å analysere?</Heading>
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                    gap: '16px',
                    marginBottom: '80px'
                }}>
                    {analyticsPages.filter(page => page.id !== 'grafbygger').map(page => (
                        <LinkCard key={page.id}>
                            <LinkCard.Title>
                                <LinkCard.Anchor href={page.href}>{page.label}</LinkCard.Anchor>
                            </LinkCard.Title>
                            <LinkCard.Description>{page.description}</LinkCard.Description>
                        </LinkCard>
                    ))}
                </div>

                <div className="mb-20">
                    <Heading spacing={true} as="h3" size="medium" className="pb-1">Lag grafer og tabeller for Metabase</Heading>
                    <p className="text-xl leading-relaxed max-w-prose">
                        <Link href="/grafbygger">Grafbyggeren</Link> hjelper deg med å stille spørsmål og gir deg svarene i form av grafer og tabeller – som kan deles og legges til i Metabase.
                    </p>
                </div>

                <div style={{ marginTop: '80px' }}>
                    <Kontaktboks />
                </div>
            </Page.Block>
        </>
    )
}

export default Home
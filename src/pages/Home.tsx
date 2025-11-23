import { Heading, LinkPanel, Page } from "@navikt/ds-react";
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
                    {analyticsPages.map(page => (
                        <LinkPanel key={page.id} href={page.href} border>
                            <LinkPanel.Title>{page.label}</LinkPanel.Title>
                            <LinkPanel.Description>{page.description}</LinkPanel.Description>
                        </LinkPanel>
                    ))}
                </div>

                <Kontaktboks />
            </Page.Block>
        </>
    )
}

export default Home
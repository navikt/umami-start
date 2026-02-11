import { Heading, Page } from "@navikt/ds-react";
import UrlSearchForm from "../components/dashboard/UrlSearchForm";
import { KontaktSeksjon } from "../components/theme/Kontakt/KontaktSeksjon";

function Home() {
    return (
        <div style={{
            width: "100%",
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            backgroundColor: "var(--ax-bg-accent-soft)",
        }}>
            <section style={{
                width: "100%",
                color: "var(--ax-text-default)",
                flex: 1,
                display: "flex",
                alignItems: "center",
                paddingTop: "32px",
                paddingBottom: "32px",
            }}>
                <Page.Block width="xl" gutters>
                    <div style={{ maxWidth: "760px", margin: "0 auto" }}>
                        <Heading spacing={true} as="h1" size="xlarge">Mål brukeradferd med Umami</Heading>
                        <UrlSearchForm />
                    </div>
                </Page.Block>
            </section>

            <KontaktSeksjon showMarginBottom={true} />
        </div>
    )
}

export default Home

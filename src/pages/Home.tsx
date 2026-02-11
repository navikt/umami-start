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
                flex: "1 0 auto",
                minHeight: "clamp(440px, 62vh, 760px)",
                display: "grid",
                placeItems: "center",
                paddingTop: "24px",
                paddingBottom: "24px",
            }}>
                <Page.Block width="2xl" gutters style={{ width: "100%" }}>
                    <div style={{ width: "100%", maxWidth: "680px", margin: "0 auto" }}>
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

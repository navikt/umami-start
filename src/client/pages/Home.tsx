import { Heading, Page } from "@navikt/ds-react";
import UrlSearchForm from "../components/dashboard/UrlSearchForm.tsx";
import { KontaktSeksjon } from "../components/theme/Kontakt/KontaktSeksjon.tsx";

function Home() {
    return (
        <div style={{
            width: "100%",
            minHeight: "90vh",
            display: "flex",
            flexDirection: "column",
            backgroundColor: "var(--ax-bg-default)",
            backgroundImage: "linear-gradient(180deg, var(--ax-bg-accent-soft) 0%, var(--ax-bg-default) 68%)",
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
                        <Heading spacing={true} as="h1" size="xlarge">Nav Webstatistikk</Heading>
                        <UrlSearchForm />
                    </div>
                </Page.Block>
            </section>

            <KontaktSeksjon showMarginBottom={true} />
        </div>
    )
}

export default Home

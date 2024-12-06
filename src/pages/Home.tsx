import {BodyShort, Heading, Link} from "@navikt/ds-react";
import TeamWebsites from "../components/teamwebsites.tsx";
import Dashboard from "../components/dashboard.tsx";

function Home() {
    return (
        <>
            <Heading spacing={true} as="h2" size="large" style={{marginTop: "80px"}}>Mål brukeradferd med
                Umami</Heading>
            <Dashboard/>

            <Heading size={"medium"} style={{marginTop: "83px"}}>Et enklere analyseverktøy — med avanserte muligheter</Heading>
            <BodyShort size="medium" style={{ marginTop: "20px", marginBottom: "20px", maxWidth: "600px" }}>
                For å måle brukeradferd effektivt, trenger du verktøy som gir innsikt uten å gå på bekostning av brukervennlighet, datasikkerhet eller personvern.
            </BodyShort>
            <BodyShort size="medium" style={{ marginBottom: "60px", maxWidth: "600px" }}>
                Derfor tilbyr vi Umami – en løsning som kombinerer ferdige dashboards med muligheten til å utføre produktanalyser i verktøy som Metabase og Grafana.
            </BodyShort>

            <Heading spacing={true} as="h3" size="medium" style={{ marginTop: "83px"}}>Klar for å sette i gang?</Heading>
            <BodyShort size="large" style={{ marginBottom: "30px" }}>
                Få sporingskode til nettsiden/appen din ved å følge <Link href="/komigang">kom-i-gang-guiden</Link>.
            </BodyShort>
            <TeamWebsites />

            <Heading spacing={true} as="h3" size="medium" style={{ marginTop: "83px"}}>Du har nådd bunnen!</Heading>
            <BodyShort size="large" style={{ marginBottom: "83px" }}>
                Team ResearchOps hjelper deg gjerne opp igjen – kontakt oss på Slack i <Link href="https://nav-it.slack.com/archives/C02UGFS2J4B">#researchops</Link>.
            </BodyShort>
        </>
    )
}

export default Home
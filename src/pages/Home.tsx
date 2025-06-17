import {BodyShort, Heading, Link, List} from "@navikt/ds-react";
import TeamWebsites from "../components/teamwebsites.tsx";

function Home() {
    return (
        <>
            <Heading as="h2" size={"large"} style={{marginTop: "60px"}}>Brukeradferd gjort forståelig – med Umami</Heading>
            <BodyShort size="medium" style={{ marginTop: "20px", marginBottom: "20px", maxWidth: "600px" }}>
                For å måle brukeradferd effektivt, trenger du verktøy som gir innsikt uten å gå på bekostning av brukervennlighet, datasikkerhet eller personvern.
            </BodyShort>
            <BodyShort size="medium" style={{ marginBottom: "60px", maxWidth: "600px" }}>
                Derfor tilbyr Team ResearchOps Umami – en løsning som kombinerer ferdigbygde dashboards, med mulighet for dypere produktanalyser i verktøy som Metabase, Grafana og Jupyter Notebook.
            </BodyShort>

            <Heading spacing={true} as="h3" size="medium" style={{ marginTop: "83px"}}>Klar for å sette i gang?</Heading>
            <BodyShort size="large" style={{ marginBottom: "30px" }}>
                Få sporingskode til nettsiden / appen din ved å følge <Link href="/komigang">kom-i-gang-guiden</Link>.
            </BodyShort>
            <TeamWebsites />
            <BodyShort style={{ marginTop: "30px"}}>
                For teknisk dokumentasjon, <Link target="_blank" href={`https://umami.is/docs/tracker-configuration`}>se Umami sin offisielle dokumentasjonsside</Link>.
            </BodyShort>

{/*            <Heading spacing={true} as="h3" size="medium" style={{ marginTop: "83px"}}>Du har nådd bunnen! 🎉</Heading>
            <BodyShort size="large" style={{ marginBottom: "83px" }}>
                Team ResearchOps hjelper deg gjerne opp igjen – kontakt oss på Slack i <Link href="https://nav-it.slack.com/archives/C02UGFS2J4B">#researchops</Link>.
            </BodyShort>*/}

            <Heading spacing={true} as="h3" size="medium" style={{ marginTop: "83px"}}>Du har nådd bunnen! 🎉</Heading>
            <BodyShort size="large">
                Team ResearchOps hjelper deg gjerne opp igjen:
            </BodyShort>

            <List as="ul">
                <List.Item>
                    <strong>Slack:</strong> Bli med i kanalen <Link href={"https://nav-it.slack.com/archives/C070BPKR830"}>#produktanalyse</Link> og <Link href={"https://nav-it.slack.com/archives/C02UGFS2J4B"}>#researchops</Link> for å få hjelp og dele erfaringer.
                </List.Item>
                <List.Item>
                    <strong>Samtale:</strong> <Link href={"https://outlook.office365.com/owa/calendar/TeamResearchOps@nav.no/bookings/"}>Book en prat 1:1 eller workshop</Link> for å lære mer om Umami og produktanalyse.
                </List.Item>
            </List>
        </>
    )
}

export default Home
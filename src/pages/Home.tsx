import {BodyShort, Heading, Link} from "@navikt/ds-react";
import TeamWebsites from "../components/teamwebsites.tsx";
import Dashboard from "../components/dashboard.tsx";

function Home() {
    return (
        <>
            <Heading spacing={true} as="h2" size="large" style={{marginTop: "80px"}}>Mål brukeradferd med
                Umami</Heading>
            <Dashboard/>

            <Heading spacing={true} as="h3" size="medium" style={{ marginTop: "83px"}}>Hvem bruker Umami?</Heading>
                <BodyShort size="medium" style={{ marginBottom: "30px" }}>
                    Kontakt <Link target="_blank" href={`https://teamkatalog.nav.no/team/26dba481-fd96-40a8-b47d-b1ad0002bc74`}>Team ResearchOps</Link> for å få sporingskode til din nettside / app.
                </BodyShort>
            <TeamWebsites />
        </>
    )
}

export default Home
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
                Få sporingskode til nettsiden/appen din ved å følge <Link href="/komigang">kom-i-gang-veiledningen</Link>.
            </BodyShort>
            <TeamWebsites />
        </>
    )
}

export default Home
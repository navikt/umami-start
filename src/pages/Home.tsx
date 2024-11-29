import {BodyShort, Heading, Link} from "@navikt/ds-react";
import TeamWebsites from "../components/teamwebsites.tsx";

function Home() {
    return (
        <>
                <Heading spacing={true} as="h2" size="large" style={{ marginTop: "60px" }}>Nettsider</Heading>
                <BodyShort size="medium" style={{ marginBottom: "60px" }}>
                    Kontakt <Link target="_blank" href={`https://teamkatalog.nav.no/team/26dba481-fd96-40a8-b47d-b1ad0002bc74`}>Team ResearchOps</Link> for å få sporingskode til din nettside.
                </BodyShort>

                <TeamWebsites/>
        </>
    )
}

export default Home
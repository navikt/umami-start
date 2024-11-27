import TeamWebsites from "./components/teamwebsites.tsx";
import {Page, InternalHeader, Heading, BodyShort, Link} from "@navikt/ds-react";

function App() {

  return (
    <>
        <Page>
            <InternalHeader>
                <InternalHeader.Title as="h1">Start Umami</InternalHeader.Title>
            </InternalHeader>
            <Page.Block as="main" width="xl" gutters>
                <Heading spacing={true} as="h2" size="large" style={{ marginTop: "60px" }}>Nettsider</Heading>
                <BodyShort size="medium" style={{ marginBottom: "60px" }}>
                    Kontakt <Link target="_blank" href={`https://teamkatalog.nav.no/team/26dba481-fd96-40a8-b47d-b1ad0002bc74`}>Team ResearchOps</Link> for å få sporingskode til din nettside.
                </BodyShort>

                <TeamWebsites/>
            </Page.Block>
        </Page>
    </>
  )
}

export default App

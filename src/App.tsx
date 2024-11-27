import TeamWebsites from "./components/teamwebsites.tsx";
import {Page, InternalHeader, Heading} from "@navikt/ds-react";

function App() {

  return (
    <>
        <Page>
            <InternalHeader>
                <InternalHeader.Title as="h1">Start Umami</InternalHeader.Title>
            </InternalHeader>
            <Page.Block as="main" width="xl" gutters>
                <Heading spacing={true} size="large" style={{ marginTop: "60px" }}>Nettsider</Heading>
                <TeamWebsites/>
            </Page.Block>
        </Page>
    </>
  )
}

export default App

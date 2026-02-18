import { BodyShort, Link, Page } from "@navikt/ds-react";
import TeamWebsites from "../../components/settings/TeamWebsites.tsx";
import { KontaktSeksjon } from "../../components/theme/Kontakt/KontaktSeksjon.tsx";
import { PageHeader } from "../../components/theme/PageHeader/PageHeader.tsx";

function Sporingskoder() {
  return (
    <>
      <PageHeader
        title="Sporingskoder"
        description={
          <>
            Kontakt{" "}
            <Link
              target="_blank"
              href="https://nav-it.slack.com/archives/C02UGFS2J4B"
            >
              #ResearchOps på Slack
            </Link>{" "}
            for å få sporingskode til nettsiden eller appen din.
          </>
        }
      />

      <Page.Block width="xl" gutters className="pb-16 px-4">

        <TeamWebsites />

        <BodyShort style={{ marginTop: "40px", marginBottom: "40px" }}>
          For teknisk dokumentasjon,{" "}
          <Link
            target="_blank"
            href="https://umami.is/docs/tracker-configuration"
          >
            se Umami sin dokumentasjonsside
          </Link>
          .
        </BodyShort>
      </Page.Block>

      <KontaktSeksjon showMarginBottom={true} />
    </>
  );
}

export default Sporingskoder;

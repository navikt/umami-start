import { BodyShort, Link, Page } from "@navikt/ds-react";
import TeamWebsites from "../../components/settings/TeamWebsites";
import { KontaktSeksjon } from "../../components/theme/Kontakt/KontaktSeksjon";
import { PageHeader } from "../../components/theme/PageHeader/PageHeader";

function Sporingskoder() {
    return (
        <>
            <PageHeader
                title="Sporingskoder"
                description={<>Her finner du sporingskoder for alle nettsider og apper som bruker Umami.</>}
            />

            <Page.Block width="xl" gutters className="pb-16 px-4">
                <BodyShort className="mb-8">
                    Kontakt <Link target="_blank" href="https://nav-it.slack.com/archives/C02UGFS2J4B">#ResearchOps på Slack</Link> for å få sporingskode til nettsiden eller appen din.
                </BodyShort>

                <TeamWebsites />

                <BodyShort style={{ marginTop: "40px", marginBottom: "40px" }}>
                    For teknisk dokumentasjon, <Link target="_blank" href="https://umami.is/docs/tracker-configuration">se Umami sin dokumentasjonsside</Link>.
                </BodyShort>
            </Page.Block>
            <KontaktSeksjon showMarginBottom={true} />
        </>
    );
}

export default Sporingskoder;

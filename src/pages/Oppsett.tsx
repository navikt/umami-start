import { BodyShort, Heading, Link, Alert } from "@navikt/ds-react";
import TeamWebsites from "../components/teamwebsites.tsx";
import Kontaktboks from "../components/kontaktboks.tsx";

function Oppsett() {
    return (
        <div className="w-full mx-auto">
            <Heading spacing level="1" size="large" className="pt-24">
                Oppsett og konfigurasjon
            </Heading>

            <BodyShort size="large" className="mb-8 max-w-[800px]">
                Her finner du oversikt over alle Navs nettsider og apper som bruker Umami, og kan hente ut sporingskode for ditt prosjekt.
            </BodyShort>

            <Alert variant="info" className="mb-8 max-w-[800px]">
                <Heading spacing size="small" level="2">
                    Kom i gang
                </Heading>
                <BodyShort>
                    Følg <Link href="/komigang">kom-i-gang-guiden</Link> for å lære hvordan du setter opp Umami for din nettside eller app.
                </BodyShort>
            </Alert>

            <Heading spacing as="h2" size="medium" className="mt-12 mb-6">
                Alle nettsider og apper med Umami
            </Heading>

            <TeamWebsites />

            <BodyShort style={{ marginTop: "40px", marginBottom: "60px" }}>
                For teknisk dokumentasjon, <Link target="_blank" href="https://umami.is/docs/tracker-configuration">se Umami sin dokumentasjonsside</Link>.
            </BodyShort>

            <div className="mt-8 mb-8">
                <Kontaktboks />
            </div>
        </div>
    );
}

export default Oppsett;

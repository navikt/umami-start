import { BodyShort, Heading, Link, InfoCard, LinkCard } from "@navikt/ds-react";
import TeamWebsites from "../components/teamwebsites.tsx";
import Kontaktboks from "../components/kontaktboks.tsx";
import { developerTools } from "../components/DeveloperToolsNavigation.tsx";

function Oppsett() {
    return (
        <div className="w-full mx-auto">
            <Heading spacing level="1" size="large" className="pt-24">
                Oppsett og konfigurasjon
            </Heading>

            <BodyShort size="large" className="mb-8 max-w-[800px]">
                Her finner du oversikt over alle Navs nettsider og apper som bruker Umami, og kan hente ut sporingskode for ditt prosjekt.
            </BodyShort>

            <InfoCard data-color="info" className="mb-8 max-w-[800px]">
                <InfoCard.Header>
                    <InfoCard.Title>Kom i gang</InfoCard.Title>
                </InfoCard.Header>
                <InfoCard.Content>
                    <BodyShort spacing>
                        Følg <Link href="/komigang">kom-i-gang-guiden</Link> for å lære hvordan du setter opp Umami for din nettside eller app.
                    </BodyShort>
                    <BodyShort>
                        Kontakt <Link target="_blank" href="https://nav-it.slack.com/archives/C02UGFS2J4B">#ResearchOps på Slack</Link> for å få sporingskode til nettsiden eller appen din.
                    </BodyShort>
                </InfoCard.Content>
            </InfoCard>

            <Heading spacing as="h2" size="medium" className="mt-12 mb-3">
                Utviklerverktøy
            </Heading>

            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                gap: '16px',
                marginBottom: '60px'
            }}>
                {developerTools.map(tool => (
                    <LinkCard key={tool.id}>
                        <LinkCard.Title>
                            <LinkCard.Anchor href={tool.href}>{tool.label}</LinkCard.Anchor>
                        </LinkCard.Title>
                        <LinkCard.Description>{tool.description}</LinkCard.Description>
                    </LinkCard>
                ))}
            </div>

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

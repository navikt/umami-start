import {BodyShort, Heading, Link, List} from "@navikt/ds-react";

function Komigang() {
    return (
        <>
            <Heading spacing={true} as="h2" size="large" style={{ marginTop: "60px", marginBottom: "30px" }}>Kom i gang: Mål brukeradferd med Umami</Heading>

            <Heading spacing={true} as="h3" size="medium" style={{ marginTop: "60px", marginBottom: "30px" }}>Klarsignal</Heading>
                <List as="ol" title="Slik får du tommel opp fra juristen">
                    <List.Item>
                        <strong>Etterlevelse:</strong> <Link href={"https://etterlevelse.ansatt.nav.no/dokumentasjon/e3757864-9720-4569-9e8e-50841950fcd6"}>Fyll ut gjenbrukbar Umami etterlevelsesdokument.</Link>
                    </List.Item>
                    <List.Item>
                        <strong>Behandlingskatalogen:</strong> <Link href="https://behandlingskatalog.ansatt.nav.no/system/UMAMI">Nevn at dere bruker Umami i katalogen.</Link>
                    </List.Item>
                    <List.Item>
                        <strong>PVK vurdering:</strong> <Link href={"https://navno.sharepoint.com/sites/intranett-personvern/SitePages/PVK.aspx"}>Vurder om det er behov for å gjennomføre PVK.</Link>
                    </List.Item>
                </List>
            <BodyShort>
                For mer informasjon, <Link href={"https://navno.sharepoint.com/sites/intranett-utvikling/SitePages/Rutine-for-bruk-av-Umami.aspx"}>se retningslinjene for bruk av Umami.</Link>
            </BodyShort>

            <Heading spacing={true} as="h3" size="medium" style={{ marginTop: "60px", marginBottom: "30px" }}>Måle</Heading>
            <List as="ol" title="Mål det som betyr noe">
                <List.Item>
                    <strong>Måleplan:</strong> Start med hvorfor, og lag deretter en plan for hva og hvordan dere skal måle.
                </List.Item>
                <List.Item>
                    <strong>Sporingskode:</strong> Kontakt <Link target="_blank" href={`https://nav-it.slack.com/archives/C02UGFS2J4B`}>Team ResearchOps</Link> for å få sporingskode til nettsiden eller appen din.
                    .
                </List.Item>
                <List.Item>
                    <strong>Målesjekk:</strong> Sjekk at dataene blir samlet inn riktig. Gjør en målesjekk på nettsiden eller appen din.
                </List.Item>
            </List>
{/*            <BodyShort size="medium" style={{ marginBottom: "30px" }}>
                    Kontakt <Link target="_blank" href={`https://teamkatalog.nav.no/team/26dba481-fd96-40a8-b47d-b1ad0002bc74`}>Team ResearchOps</Link> for å få sporingskode til din nettside / app.
                </BodyShort>*/}

            <Heading spacing={true} as="h3" size="medium" style={{ marginTop: "60px", marginBottom: "30px" }}>Analysere</Heading>
            <List as="ul" title="Her finner du data:">
                <List.Item>
                    <strong><Link href={"./"}>Umami Dashboard:</Link></strong> Grunnleggende dashboard med data fra Umami.
                </List.Item>
                <List.Item>
                    <strong><Link href={"https://data.ansatt.nav.no/dataproduct/236d4d8f-7904-47c0-ac2f-9a3e8d06f1ee/Umami"}>Datamarkedsplassen:</Link></strong> Mulighet for å analysere i Metabase, Grafana, Jupyter Notebook og lignende verktøy.
                </List.Item>
                <List.Item>
                    <strong><Link href={"https://github.com/navikt/reops-proxy"}>Umami API:</Link></strong> Mulighet for å få data i JSON format, og bruke dem i egne apper.
                </List.Item>
            </List>

            {/*<Heading spacing={true} as="h3" size="medium" style={{ marginTop: "60px", marginBottom: "30px" }}>Dele</Heading>*/}

        </>
    )
}

export default Komigang
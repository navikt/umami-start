import { BodyShort, Heading, Link, List } from "@navikt/ds-react";

function Komigang() {
    return (
        <div className="w-full max-w-[800px] mx-auto">
            <Heading spacing level="1" size="large" className="pt-24">
                Kom i gang: Mål brukeradferd med Umami
            </Heading>

            <p className="text-gray-600 mb-6 text-xl leading-relaxed">
                En guide for å komme i gang med måling av brukeratferd i Nav.
            </p>


            <Heading spacing={true} as="h3" size="medium"
                style={{ marginTop: "60px", marginBottom: "30px" }}>Start med å teste Umami i dev-miljø</Heading>
            <BodyShort style={{ marginTop: "20px" }}>
                Bruker appen din dekoratøren på nav.no? Da kan det være dere allerede sporer data.

                <List as="ul">
                    <List.Item>
                        <Link
                            href={"https://github.com/navikt/nav-dekoratoren-moduler/blob/main/README.md#getanalyticsinstance"}>Dokumentasjon for sporing til dekoratøren</Link>
                    </List.Item>
                    <List.Item>
                        Kontakt <Link target="_blank" href={"https://nav-it.slack.com/archives/C02UGFS2J4B"}>#ResearchOps på Slack</Link> for å få sporingskode til nettsiden eller appen din.
                    </List.Item>
                </List>

            </BodyShort>
            <BodyShort className="pt-0">
                For teknisk dokumentasjon, <Link target="_blank" href={`https://umami.is/docs/tracker-configuration`}>se
                    Umami dokumentasjonssiden (engelsk)</Link>.
            </BodyShort>


            <Heading spacing={true} as="h3" size="medium"
                style={{ marginTop: "60px", marginBottom: "30px" }}>Få klarsignal for Umami i produksjon</Heading>

            <BodyShort>
                <strong>Etterlevelse:</strong> <Link
                    href={"https://etterlevelse.ansatt.nav.no/dokumentasjon/e3757864-9720-4569-9e8e-50841950fcd6"}>Fyll ut
                    gjenbrukbar Umami etterlevelsesdokument.</Link>
            </BodyShort>

            {/*                <List as="ul" title="Slik får du tommel opp fra juristen">
                    <List.Item>
                        <strong>Etterlevelse:</strong> <Link href={"https://etterlevelse.ansatt.nav.no/dokumentasjon/e3757864-9720-4569-9e8e-50841950fcd6"}>Fyll ut gjenbrukbar Umami etterlevelsesdokument.</Link>
                    </List.Item>
                    <List.Item>
                        <strong>Behandlingskatalogen:</strong> <Link href="https://behandlingskatalog.ansatt.nav.no/system/UMAMI">Nevn at dere bruker Umami i katalogen.</Link>
                    </List.Item>
                    <List.Item>
                        <strong>PVK vurdering:</strong> <Link href={"https://navno.sharepoint.com/sites/intranett-personvern/SitePages/PVK.aspx"}>Vurder om det er behov for å gjennomføre PVK.</Link>
                    </List.Item>
                </List>*/}
            <BodyShort style={{ marginTop: "20px" }}>
                For mer informasjon, <Link
                    href={"https://navno.sharepoint.com/sites/intranett-utvikling/SitePages/Rutine-for-bruk-av-Umami.aspx"}>se
                    retningslinjene for bruk av Umami.</Link>
            </BodyShort>

            <Heading spacing={true} as="h3" size="medium"
                style={{ marginTop: "60px", marginBottom: "30px" }}>Måle</Heading>
            <List as="ol" title="Mål det som betyr noe">
                <List.Item>
                    <strong>Måleplan:</strong> Start med hvorfor, og lag deretter en plan for hva og hvordan dere skal
                    måle.
                </List.Item>
                <List.Item>
                    <strong>Sporingskode:</strong> <Link target="_blank"
                        href={`https://nav-it.slack.com/archives/C02UGFS2J4B`}>Kontakt
                        #ResearchOps på Slack</Link> for å få sporingskode til nettsiden eller appen din.
                </List.Item>
                <List.Item>
                    <strong>Taksonomi:</strong> <Link target="_blank"
                        href={`/taksonomi`}>Bruk Navs taksnomi
                    </Link> for å få forslag til hva man kan kalle hendelser og detaljer.
                </List.Item>
                <List.Item>
                    <strong>Målesjekk:</strong> Sjekk at dataene blir samlet inn riktig. Gjør en målesjekk på nettsiden
                    eller appen din.
                </List.Item>
            </List>

            <Heading spacing={true} as="h3" size="medium"
                style={{ marginTop: "60px", marginBottom: "30px" }}>Analysere</Heading>
            <List as="ul" title="Her finner du Umami-data">
                <List.Item>
                    <strong><Link href={"./"}>Umami Dashboard:</Link></strong> Grunnleggende dashboard med data fra
                    Umami.
                </List.Item>
                <List.Item>
                    <strong><Link
                        href={"https://data.ansatt.nav.no/dataproduct/236d4d8f-7904-47c0-ac2f-9a3e8d06f1ee/Umami"}>Datamarkedsplassen:</Link></strong> Mulighet
                    for å analysere i Metabase, Grafana, Knast og lignende verktøy.
                </List.Item>
                <List.Item>
                    <strong><Link href={"https://github.com/navikt/reops-proxy"}>Umami API:</Link></strong> Mulighet for
                    å få data i JSON format, og bruke dem i egne apper.
                </List.Item>
            </List>

            <List as="ul" title="Lykkes med Umami i Metabase" className="pt-4">
                <List.Item>
                    <strong><Link
                        href={"/grafbygger"}>Grafbyggeren:</Link></strong> Lag grafer og tabeller.
                </List.Item>
                <List.Item>
                    <strong><Link
                        href={"/metabase"}>Metabase dashboard guide:</Link></strong> Slik lager du dashboards i Metabase.
                </List.Item>
                <List.Item>
                    <strong><Link href={"https://metabase.ansatt.nav.no/"}>Snarvei til Metabase</Link></strong>
                </List.Item>
            </List>

            <Heading spacing={true} as="h3" size="medium" style={{ marginTop: "60px", marginBottom: "30px" }}>Dele og
                lære</Heading>
            <List as="ul" title="Bli med på kaffeprat? ☕">
                <List.Item>
                    <strong>Slack:</strong> Bli med i kanalen <Link
                        href={"https://nav-it.slack.com/archives/C070BPKR830"}>#produktanalyse</Link> og <Link
                            href={"https://nav-it.slack.com/archives/C02UGFS2J4B"}>#researchops</Link> for å få hjelp og dele
                    erfaringer.
                </List.Item>
                <List.Item>
                    <strong>Samtale:</strong> <Link
                        href={"https://outlook.office365.com/owa/calendar/TeamResearchOps@nav.no/bookings/"}>Book en prat
                        1:1 eller workshop</Link> for å lære mer om Umami og produktanalyse.
                </List.Item>
            </List>

            {/*<Heading spacing={true} as="h3" size="medium" style={{ marginTop: "60px", marginBottom: "30px" }}>Dele</Heading>*/}

        </div>
    )
}

export default Komigang
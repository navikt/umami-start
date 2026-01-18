import { BodyShort, Heading, Link, List } from "@navikt/ds-react";

function Komigang() {
    return (
        <div className="w-full max-w-[800px] mx-auto">
            <Heading spacing level="1" size="large" className="pt-24">
                Kom i gang: Mål brukeradferd med Umami
            </Heading>

            <p className="text-[var(--ax-text-subtle)] mb-6 text-xl leading-relaxed">
                En guide for å komme i gang med måling av brukeratferd i Nav.
            </p>


            <Heading spacing={true} as="h3" size="medium"
                style={{ marginTop: "60px", marginBottom: "30px" }}>Start med å teste Umami i dev-miljø</Heading>

            <div className="flex flex-col gap-8">
                <div>
                    <Heading size="xsmall" level="4" spacing>
                        Bruker du dekoratøren?
                    </Heading>
                    <BodyShort spacing>
                        Da kan det være dere allerede sporer data. Dekoratøren initialiserer Umami-script automatisk til "Nav.no - prod" og "Nav.no - dev".
                    </BodyShort>
                    <List as="ul" size="small">
                        <List.Item>
                            <strong>Cookie-samtykke:</strong> Håndteres automatisk av dekoratøren.
                        </List.Item>
                        <List.Item>
                            <strong>Hva spores:</strong> Dekoratøren sporer grunnleggende sidenavigasjon og metadata. <Link href="https://navno.sharepoint.com/sites/intranett-utvikling/SitePages/Rutine-for-bruk-av-Umami.aspx#hva-sporer-umami">Se hva Umami sporer</Link>.
                        </List.Item>
                        <List.Item>
                            <Link href={"https://github.com/navikt/nav-dekoratoren-moduler/blob/main/README.md#getanalyticsinstance"}>
                                Se dokumentasjon for sporing til dekoratøren
                            </Link>
                        </List.Item>
                    </List>
                </div>

                <div>
                    <Heading size="xsmall" level="4" spacing>
                        Bruker du ikke dekoratøren?
                    </Heading>
                    <BodyShort spacing>
                        Kontakt <Link target="_blank" href={"https://nav-it.slack.com/archives/C02UGFS2J4B"}>#ResearchOps på Slack</Link> for å få sporingskode til nettsiden eller appen din. Du kan også se <Link href={"/oppsett"}>eksisterende sporingskoder nederst på oppsett-siden</Link>.
                    </BodyShort>
                </div>
            </div>
            <BodyShort spacing className="mt-8">
                For teknisk dokumentasjon, <Link target="_blank" href={`https://umami.is/docs/tracker-configuration`}>se
                    Umami dokumentasjonssiden (engelsk)</Link>.
            </BodyShort>


            <Heading spacing={true} as="h3" size="medium"
                style={{ marginTop: "60px", marginBottom: "30px" }}>Få klarsignal for Umami i produksjon</Heading>

            <BodyShort spacing>
                Før du tar Umami i bruk i produksjon må du sørge for at personvernet ivaretas. Personopplysninger skal ikke spores tilsiktet i Umami.
            </BodyShort>

            <List as="ul">
                <List.Item>
                    <strong>Etterlevelse:</strong> <Link
                        href={"https://etterlevelse.ansatt.nav.no/dokumentasjon/e3757864-9720-4569-9e8e-50841950fcd6"}>Fyll ut
                        gjenbrukbar Umami etterlevelsesdokument</Link>. Du må også opplyse om bruk av Umami via personvernsidene på nettsiden/appen.
                </List.Item>
                <List.Item>
                    <strong>Personvern:</strong> Umami-proxyen vasker automatisk vekk personopplysninger som fødselsnummer, e-post, telefonnummer m.m. <Link href="https://navno.sharepoint.com/sites/intranett-utvikling/SitePages/Rutine-for-bruk-av-Umami.aspx#hva-vasker-vi-vekk-fra-umami">Se hva som vaskes vekk</Link>.
                </List.Item>
            </List>

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
            <Heading size="xsmall" level="3" spacing>Mål det som betyr noe</Heading>
            <List as="ol">
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
                    eller appen din. Husk at teamet har ansvar for dataene som samles inn.
                </List.Item>
            </List>

            <BodyShort spacing className="mt-4">
                <strong>Viktig:</strong> Ikke spor innhold fra fritekstfelt eller søkefelt, da dette kan inneholde personopplysninger. Unntak krever egne vurderinger av personvernkonsekvenser (PVK) og ekstra tiltak. Vær oppmerksom på risikoen for avvik. <Link href="https://navno.sharepoint.com/sites/intranett-utvikling/SitePages/Rutine-for-bruk-av-Umami.aspx#hva-skal-ikke-spores-i-umami">Les mer om hva som ikke skal spores</Link>.
            </BodyShort>

            <Heading spacing={true} as="h3" size="medium"
                style={{ marginTop: "60px", marginBottom: "30px" }}>Analysere</Heading>
            <Heading size="xsmall" level="3" spacing>Her finner du Umami-data</Heading>
            <List as="ul">
                <List.Item>
                    <strong><Link href={"./"}>Umami Dashboard:</Link></strong> Grunnleggende analyser og dashboard med data fra
                    Umami.
                </List.Item>
                <List.Item>
                    <strong><Link
                        href={"https://data.ansatt.nav.no/dataproduct/236d4d8f-7904-47c0-ac2f-9a3e8d06f1ee/Umami"}>Datamarkedsplassen:</Link></strong> Mulighet
                    for å analysere i Metabase, Grafana, Knast og lignende verktøy.
                </List.Item>
            </List>

            <Heading size="xsmall" level="3" spacing className="pt-4">Lykkes med Umami i Metabase</Heading>
            <List as="ul">
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
            <Heading size="xsmall" level="3" spacing>Bli med på kaffeprat? ☕</Heading>
            <List as="ul">
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
import { Heading, Link, VStack, Box } from "@navikt/ds-react";
import Kontaktboks from '../components/kontaktboks';

function Personvern() {
    return (
        <div className="w-full max-w-[800px] mx-auto">
            <Heading spacing level="1" size="large" className="pt-24 pb-4">
                Personvern
            </Heading>

            <p className="text-gray-600 mb-8 text-xl leading-relaxed">
                Slik håndterer vi personvern og sikkerhet på startumami.ansatt.nav.no
            </p>

            <div className="prose max-w-full prose-lg">
                <VStack gap="12">
                    <section>
                        <Heading level="2" size="medium" spacing>
                            Personvern og sikkerhet
                        </Heading>
                        <p className="mb-4 leading-normal">
                            Innblikk er en nettside NAV Arbeids- og velferdsdirektoratet. Denne personvernerklæringen er knyttet til behandlingen av personopplysninger på dette nettstedet. For utfyllende informasjon om hvordan NAV behandler personopplysninger, kan du lese mer i <Link href="https://www.nav.no/no/nav-og-samfunn/om-nav/personvern-i-arbeids-og-velferdsetaten" className="text-deepblue-500 underline hover:no-underline">NAVs generelle personvernerklæring.</Link>
                        </p>
                    </section>

                    <section>
                        <Heading level="2" size="medium" spacing>
                            Audit logging
                        </Heading>
                        <p className="mb-4 leading-normal">
                            Start Umami sender din Nav-ident sammen med alle spørringer som kjøres. Dette gjør at vi kan logge hvem som har kjørt hvilke spørringer, og er en del av vår sikkerhetsrutine for å beskytte data og oppfylle etterlevelseskrav.
                        </p>
                        <p className="leading-normal">
                            Loggene brukes kun til statistikk og sikkerhetsformål.
                        </p>
                    </section>

                    <section>
                        <Heading level="2" size="medium" spacing>
                            Bruk av informasjonskapsler (cookies)
                        </Heading>
                        <p className="mb-4 leading-normal">Når du besøker nettsiden bruker vi informasjonskapsler (cookies).</p>

                        <Box padding="6" borderWidth="1" borderColor="border-subtle" borderRadius="medium" className="my-4">
                            <p className="mb-4 leading-normal">Informasjonskapsler er små tekstfiler som plasseres på din datamaskin når du laster ned en nettside. Noen av informasjonskapslene er nødvendige for at ulike tjenester på nettsiden vår skal fungere slik vi ønsker.</p>
                            <p className="mb-4 leading-normal">Vi bruker informasjonskapsler til å forbedre brukeropplevelsen og innholdet. Når du besøker aksel.nav.no, sender nettleseren din opplysninger til NAVs analyseverktøy.</p>
                        </Box>

                        <section>
                            <Heading level="3" size="small" spacing>
                                skyra*
                            </Heading>
                            <p className="mb-4 leading-normal">
                                Brukes av verktøyet Skyra for å lagre svarene du gir på en undersøkelse. Avhengig av oppsett på undersøkelsen er dette enten en sesjonskapsel eller en kapsel som slettes etter få timer. Kapselen slettes når en undersøkelse fullføres eller lukkes.
                            </p>
                        </section>

                        <section>
                            <Heading level="3" size="small" spacing>
                                skyra.state
                            </Heading>
                            <p className="mb-4 leading-normal">
                                Brukes av verktøyet Skyra for å huske brukeren og hvorvidt undersøkelser er åpnet, lukket eller fullført.
                            </p>
                        </section>

                        <section>
                            <Heading level="3" size="small" spacing>
                                Umami
                            </Heading>
                            <p className="mb-4 leading-normal">
                                Umami brukes til statistikk og analyse av hvordan nav.no brukes. Unami bruker ikke informasjonskapsler, men henter inn opplysninger om nettleseren din for å lage en unik ID. Denne ID-en brukes for å skille deg fra andre brukere. For å hindre identifisering, bruker vi en egenutviklet proxy som vasker bort deler av IP-adressen din før dataene sendes til verktøyet.
                            </p>
                        </section>

                    </section>

                    <section>
                        <Heading level="2" size="medium" spacing>
                            Feil, mangler og forbedringsforslag
                        </Heading>
                        <p className="leading-normal">Hvis du opplever problemer eller har forslag til forbedringer hører vi veldig gjerne fra deg! Feil og mangler kan rapporteres til <a className="underline" href="mailto:eilif.johansen@nav.no">eilif.johansen@nav.no</a>, eller <a className="underline" href="https://nav-it.slack.com/archives/C02UGFS2J4B">#researchops</a> på Slack.</p>
                    </section>

                    <Kontaktboks />
                </VStack>
            </div>
        </div>
    )
}

export default Personvern
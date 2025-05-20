import {Heading, VStack} from "@navikt/ds-react";
import Kontaktboks from '../components/kontaktboks';

function Accessibility() {
    return (
        <div className="w-full max-w-[800px] mx-auto">
            <Heading spacing level="1" size="large" className="pt-24 pb-4">
                Tilgjengelighetserklæring
            </Heading>

            <p className="text-gray-600 mb-8 text-xl leading-relaxed">
                Start Umami skal være tilgjengelig for alle.
            </p>

            <div className="prose max-w-full prose-lg">
                <VStack gap="12">
                    <section>
                        <p className="mb-4 leading-normal">Start Umami skal være tilgjengelig for alle. Det betyr at vi har som mål å følge lovpålagte krav til universell utforming. Vår ambisjon er i tillegg at du skal ha en god brukeropplevelse enten du bruker hjelpeteknologi (for eksempel skjermleser) eller ikke.</p>
                        <p className="mb-4 leading-normal">Alle virksomheter i offentlig sektor skal ha en tilgjengelighetserklæring. WCAG 2.1 på nivå AA er lovpålagt i Norge. Erklæringen beskriver hvert suksesskriterium i WCAG, og om nettstedet imøtekommer disse kravene.</p>
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

export default Accessibility
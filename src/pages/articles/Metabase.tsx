import { 
  Heading, 
  VStack, 
  Box, 
  List
} from '@navikt/ds-react';
import Kontaktboks from '../../components/theme/Kontaktboks/Kontaktboks';

const Metabase = () => {
  return (
    <div className="w-full max-w-[800px] mx-auto">
      <Heading spacing level="1" size="large" className="pt-24 pb-4">
        Slik lager du dashboards i Metabase
      </Heading>
      
      <p className="text-gray-600 mb-8 text-xl leading-relaxed">
        En steg-for-steg guide for å lage dashboard med Umami-data i Metabase.
      </p>

      {/* Introduction box */}
      <Box padding="6" borderWidth="1" borderColor="border-subtle" borderRadius="medium" className="mb-8 bg-blue-50">
        <Heading size="small" level="2" spacing>
          Tre steg for å lage dashboard i Metabase
        </Heading>
        <List as="ol" className="ml-4 mt-2 text-gray-800 space-y-2">
          <List.Item>Opprett nytt dashboard i Metabase</List.Item>
          <List.Item>Lag grafer med Umami Grafbyggeren</List.Item>
          <List.Item>Legg til grafer i Matabase-dashboardet</List.Item>
        </List>
      </Box>

      <div className="prose max-w-full prose-lg">
        <VStack gap="12">

          {/* STEG 1 */}
          <section id="steg1-metabase">
            <Heading level="2" size="medium" spacing className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-blue-600 text-white text-base font-semibold">1</span>
              Opprett nytt dashboard i Metabase
            </Heading>
            <ol className="mt-4 space-y-2  text-gray-800 list-none">
              <li className="flex items-start gap-3">
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-700 font-semibold text-base mt-1">a</span>
                <span>
                Gå til <a href="https://metabase.ansatt.nav.no/dashboard/484" target='_new' className="text-blue-500 underline">Metabase</a>.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-700 font-semibold text-base mt-1">b</span>
                <span>
                  Klikk på <b>+ Ny</b> i hovedmenyen og velg <b>Infotavle / Dashboard</b>.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-700 font-semibold text-base mt-1">c</span>
                <span>
                  Gi dashboardet et navn, beskrivelse og velg plassering.
                  </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-700 font-semibold text-base mt-1">d</span>
                <span>
                  Trykk <b>Lag / Create</b> for å opprette dashboardet.
                </span>
              </li>
            </ol>
          </section>

          {/* STEG 2 */}
          <section id="steg2-grafbygger">
            <Heading level="2" size="medium" spacing className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-blue-600 text-white text-base font-semibold">2</span>
              Lag grafer med Umami Grafbyggeren
            </Heading>

            <Heading level="3" size="xsmall" spacing className="mt-4 ml-8">
              Start i Umami Grafbyggeren
            </Heading>
            <ol className="mt-2 space-y-2 text-gray-800 list-none">
              <li className="flex items-start gap-3">
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-700 font-semibold text-base mt-1">a</span>
                <span>
                  Gå til <a href="/grafbygger" target='_new' className="text-blue-500 underline">Umami Grafbygger</a>.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-700 font-semibold text-base mt-1">b</span>
                <span>
                  Velg nettside eller app, og hvilke data du vil vise i grafen.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-700 font-semibold text-base mt-1">c</span>
                <span>
                  Velg "interaktiv" dersom du ønsker filreringsvalg i dashboardet.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-700 font-semibold text-base mt-1">d</span>
                <span>
                  Når du er fornøyd, trykk kopiere og fortsett i Metabase.
                </span>
              </li>
            </ol>

            <Heading level="3" size="xsmall" spacing className="mt-4 ml-8">
              Ferdigstill og lagre grafen i Metabase
            </Heading>
            <ol className="mt-2 space-y-2 text-gray-800 list-none">
              <li className="flex items-start gap-3">
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-700 font-semibold text-base mt-1">e</span>
                <span>
                  Lim inn grafen i <a href="https://metabase.ansatt.nav.no/question#eyJkYXRhc2V0X3F1ZXJ5Ijp7ImRhdGFiYXNlIjo3MzEsInR5cGUiOiJuYXRpdmUiLCJuYXRpdmUiOnsicXVlcnkiOiIiLCJ0ZW1wbGF0ZS10YWdzIjp7fX19LCJkaXNwbGF5IjoidGFibGUiLCJ2aXN1YWxpemF0aW9uX3NldHRpbmdzIjp7fSwidHlwZSI6InF1ZXN0aW9uIn0=" target='_new' className="text-blue-500 underline">Metabase</a>.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-700 font-semibold text-base mt-1">f</span>
                <span>
                  Trykk på ▶️ "vis resultater"-knappen.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-700 font-semibold text-base mt-1">g</span>
                <span>
                  Trykk "visualisering" for å bytte fra tabell til graf.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-700 font-semibold text-base mt-1">h</span>
                <span>
                  Trykk på "lagre"-knappen. Gi grafen et navn og velg plassering.
                </span>
              </li>
            </ol>
          </section>

          {/* STEG 3 */}
          <section id="steg3-legge-til">
            <Heading level="2" size="medium" spacing className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-blue-600 text-white text-base font-semibold">3</span>
              Legg til grafer i Matabase-dashboardet
            </Heading>
            <ol className="mt-4 space-y-2  text-gray-800 list-none">
              <li className="flex items-start gap-3">
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-700 font-semibold text-base mt-1">a</span>
                <span>
                  Åpne dashboardet ditt i redigeringsmodus ved å trykke på blyant-ikonet.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-700 font-semibold text-base mt-1">b</span>
                <span>
                  Trykk på <b>+</b> (pluss tegnet) i menyen, og velg hvilken graf du vil legge til.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-700 font-semibold text-base mt-1">c</span>
                <span>
                  Plasser grafen der du vil ha den i dashboardet.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-700 font-semibold text-base mt-1">d</span>
                <span>
                  Trykk <b>Lagre</b> når du er ferdig.
                </span>
              </li>
            </ol>
          </section>

          <Kontaktboks />
        </VStack>
      </div>
    </div>
  );
};

export default Metabase;

import { 
  Heading, 
  VStack, 
  Table, 
  Box, 
  Alert, 
  ReadMore,
} from '@navikt/ds-react';
import Kontaktboks from '../components/kontaktboks';
import AkselComponentEvents from '../components/AkselComponentEvents';

const TaksonomiPage = () => {
  return (
    <div className="w-full max-w-[800px] mx-auto">
      <Heading spacing level="1" size="large" className="pt-24 pb-4">
        Navs taksonomi for produktanalyser
      </Heading>
      
      <p className="text-gray-600 mb-8 text-xl leading-relaxed">
        En guide til hvordan du navngir hendelser i Umami for å sikre gode analyser.
      </p>

      {/* Add quick links */}
      <Box padding="4" borderWidth="1" borderColor="border-subtle" borderRadius="medium" className="mb-8">
        <Heading size="xsmall" level="2" className="mb-3">Snarvei</Heading>
        <a href="#aksel-komponenter" className="text-blue-500 hover:text-blue-700 underline flex items-center gap-1">
        Anbefalte hendelsesnavn og detaljer for Aksel-komponenter 
          </a>
      </Box>

      <div className="prose max-w-full prose-lg">
        <VStack gap="12">
          {/* Motivation Section */}
          <section>
            <Heading level="2" size="medium" spacing>
              Hvorfor bruke taksonomi?
            </Heading>
            <p>
              Med en felles taksonomi blir det lettere å samle inn, analysere og sammenligne 
              data på tvers av team og løsninger. Dette gir oss bedre innsikt i hvordan 
              tjenestene våre brukes.
            </p>
            
            <Box className='px-8'
              borderWidth="1" 
              borderRadius="medium" 
              borderColor="border-info" 
              background="surface-info-subtle"
            >
              <Heading size="small" level="3">
                Dette får du med taksonomien
              </Heading>
              En standard for navngivning av hendelser på tvers av team, som gjør det:
              <ul className="mb-10">
                <li>Enklere å sammenlikne data fra forskjellige løsninger</li>
                <li>Lettere å forstå hva hendelsene betyr</li>
                <li>Mulig å gjenbruke kode på tvers av team</li>
              </ul>
            </Box>
          </section>

          {/* Event Naming Standards */}
          <section>
            <Heading level="2" size="medium" spacing>
              Slik navngir du hendelser
            </Heading>
            <p>
              Når du sporer hendelser i Umami, bruk naturlig språk som beskriver hva 
              brukeren gjør. Tenk på hendelsesnavnet som en kort setning.
            </p>
            
            <Box padding="6" borderWidth="1" borderColor="border-subtle" borderRadius="medium" className="my-4">
              <p className="font-medium">Enkelt prinsipp:</p>
              <p className="italic">Bruk vanlig norsk som alle kan forstå.</p>
            </Box>
            
            <p>Eksempler på hendelsesnavn:</p>
            <ul className="space-y-2">
              <li><strong>skjema fullført</strong></li>
              <li><strong>knapp klikket</strong></li>
              <li><strong>lenke klikket</strong></li>
              <li><strong>søk gjennomført</strong></li>
              <li><strong>filter valgt</strong></li>
              <li><strong>utvidbart panel åpnet</strong></li>
            </ul>
            
            <ReadMore header="Se flere hendelsesnavn du kan bruke" className="prose-lg">
              <Table size="medium">
                <Table.Header>
                  <Table.Row>
                    <Table.HeaderCell>Hendelsesnavn</Table.HeaderCell>
                    <Table.HeaderCell>Når bruker du det?</Table.HeaderCell>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  <Table.Row>
                    <Table.DataCell>utvidbart panel åpnet</Table.DataCell>
                    <Table.DataCell>Bruker klikker for å vise innhold i et utvidbart panel</Table.DataCell>
                  </Table.Row>
                  <Table.Row>
                    <Table.DataCell>utvidbart panel lukket</Table.DataCell>
                    <Table.DataCell>Bruker klikker for å skjule innhold</Table.DataCell>
                  </Table.Row>
                  <Table.Row>
                    <Table.DataCell>dialogboks åpnet</Table.DataCell>
                    <Table.DataCell>En dialogboks dukker opp</Table.DataCell>
                  </Table.Row>
                  <Table.Row>
                    <Table.DataCell>dialogboks lukket</Table.DataCell>
                    <Table.DataCell>Dialogboksen lukkes</Table.DataCell>
                  </Table.Row>
                  <Table.Row>
                    <Table.DataCell>skjema åpnet</Table.DataCell>
                    <Table.DataCell>Brukeren starter et skjema</Table.DataCell>
                  </Table.Row>
                  <Table.Row>
                    <Table.DataCell>skjema fullført</Table.DataCell>
                    <Table.DataCell>Skjemaet sendes inn</Table.DataCell>
                  </Table.Row>
                  <Table.Row>
                    <Table.DataCell>skjemavalidering feilet</Table.DataCell>
                    <Table.DataCell>Skjemaet har valideringsfeil</Table.DataCell>
                  </Table.Row>
                  <Table.Row>
                    <Table.DataCell>navigasjon klikket</Table.DataCell>
                    <Table.DataCell>Bruker klikker på navigasjonselement</Table.DataCell>
                  </Table.Row>
                </Table.Body>
              </Table>
            </ReadMore>
          </section>

          {/* Parameters Section */}
          <section>
            <Heading level="2" size="medium" spacing>
              Slik navngir du hendelsesdetaljer
            </Heading>
            <p>
              For å gi mer kontekst til hendelsene kan du legge til ekstra informasjon. 
              Dette gjør det lettere å forstå nøyaktig hva som skjedde og analysere dataene senere.
            </p>

            <Box padding="6" borderWidth="1" borderColor="border-subtle" borderRadius="medium" className="my-4">
              <p className="font-medium">Navnestruktur:</p>
              <p className="italic">Bruk to eller flere ord der første ordet starter med liten bokstav og de neste med stor.</p>
              <p className="mt-2">For eksempel: <code>appNavn</code>, <code>skjemaType</code>, <code>tekst</code></p>
            </Box>
            
            <p>Vanlige eksempler:</p>
            <ul className="space-y-2">
              <li><code>appNavn: "dagpengesoknad"</code> - hvilken løsning hendelsen kommer fra</li>
              <li><code>skjemaType: "foreldrepenger"</code> - hvilket skjema det gjelder</li>
              <li><code>tekst: "Send søknad"</code> - teksten på knappen som ble klikket</li>
              <li><code>valgtSvar: "Ja"</code> - hva brukeren svarte</li>
            </ul>

            <Alert variant="success">
              Ta bare med informasjon som gir verdi når du skal analysere dataene senere.
              Tenk gjennom hvilke spørsmål du vil kunne svare på med dataene.
            </Alert>
            
            <ReadMore header="Se flere hendelsesdetaljer du kan bruke" className="mt-6 prose-lg">
              <Table size="medium">
                <Table.Header>
                  <Table.Row>
                    <Table.HeaderCell>Navn</Table.HeaderCell>
                    <Table.HeaderCell>Forklaring</Table.HeaderCell>
                    <Table.HeaderCell>Eksempel</Table.HeaderCell>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  <Table.Row>
                    <Table.DataCell>appNavn</Table.DataCell>
                    <Table.DataCell>Navn på løsningen</Table.DataCell>
                    <Table.DataCell>"dagpengesoknad"</Table.DataCell>
                  </Table.Row>
                  <Table.Row>
                    <Table.DataCell>skjemaType</Table.DataCell>
                    <Table.DataCell>Type skjema</Table.DataCell>
                    <Table.DataCell>"foreldrepenger"</Table.DataCell>
                  </Table.Row>
                  <Table.Row>
                    <Table.DataCell>skjemaSteg</Table.DataCell>
                    <Table.DataCell>Steg i et skjema</Table.DataCell>
                    <Table.DataCell>"3"</Table.DataCell>
                  </Table.Row>
                  <Table.Row>
                    <Table.DataCell>menyValg</Table.DataCell>
                    <Table.DataCell>Valgt element i menyen</Table.DataCell>
                    <Table.DataCell>"hovedmeny"</Table.DataCell>
                  </Table.Row>
                  <Table.Row>
                    <Table.DataCell>tekst</Table.DataCell>
                    <Table.DataCell>F.eks. tekst på knappen</Table.DataCell>
                    <Table.DataCell>"Send inn søknad"</Table.DataCell>
                  </Table.Row>
                  <Table.Row>
                    <Table.DataCell>feilType</Table.DataCell>
                    <Table.DataCell>Type feil som oppsto</Table.DataCell>
                    <Table.DataCell>"mangler-fodselsnummer"</Table.DataCell>
                  </Table.Row>
                  <Table.Row>
                    <Table.DataCell>sidenavn</Table.DataCell>
                    <Table.DataCell>Navn på siden</Table.DataCell>
                    <Table.DataCell>"personopplysninger"</Table.DataCell>
                  </Table.Row>
                  <Table.Row>
                    <Table.DataCell>valgtSvar</Table.DataCell>
                    <Table.DataCell>Svaret som ble valgt</Table.DataCell>
                    <Table.DataCell>"deltid"</Table.DataCell>
                  </Table.Row>
                </Table.Body>
              </Table>
            </ReadMore>
          </section>

          {/* Aksel Components Section - now imported from the separate file */}
          <AkselComponentEvents />

          {/* Implementation in Umami */}
          <section>
            <Heading level="2" size="medium" spacing>
              Implementer i koden
            </Heading>
            <p>
              For å implementere Umami trenger du en sporingskode. Denne finner du via <a href="/" className="text-blue-500 hover:text-blue-700 underline">Start Umami forsiden</a>. 
              Her er et eksempel på hvordan du kan spore hendelser i tråd med taksonomien:
            </p>

            <Box padding="8" borderWidth="1" borderColor="border-subtle" borderRadius="medium" className="my-4 bg-gray-50">
              <pre className="text-base whitespace-pre-wrap">
{`// Når en bruker klikker på en knapp
function handleKnappKlikk() {
  umami.track('knapp klikket', {
    appNavn: 'dagpengesoknad',
    komponentNavn: 'soknadsskjema',
    tekst: 'Send inn søknad'
  });
}

// Når en bruker fullfører et skjema
function handleSkjemaSendt() {
  umami.track('skjema fullført', {
    appNavn: 'dagpengesoknad',
    komponentNavn: 'soknadsskjema',
    skjemaId: 'dagpenger',
    skjemaSteg: '4'
  });
}`}
              </pre>
            </Box>

            <Alert variant="info">
              Start enkelt med få hendelser som gir verdi. Bruk norske navn som alle kan 
              forstå, og se Umamis dokumentasjon for tekniske detaljer.
            </Alert>
          </section>

          {/* Verification section */}
          <section>
            <Heading level="2" size="medium" spacing>
              Test og verifiser
            </Heading>
            <p>
              Sjekk alltid at hendelsene blir registrert riktig i Umami.
            </p>
            
            <ol className="space-y-3 list-disc pl-5">
              <li>
                <strong><a href="/grafbygger" className="text-blue-500 hover:text-blue-700 underline">Bruk Grafbygger</a></strong> til å sjekke at du kan lage de rapportene du trenger
              </li>
              <li>
                <strong>Del med teamet</strong> for å sikre at alle forstår hva som spores og hvorfor
              </li>
            </ol>
          </section>

          <Kontaktboks />
        </VStack>
      </div>
    </div>
  );
};

export default TaksonomiPage;

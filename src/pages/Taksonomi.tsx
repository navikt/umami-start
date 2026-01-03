import {
  Heading,
  VStack,
  Table,
  Box,
  Alert,
  ReadMore,
  BodyLong,
  List,
  Link,
} from '@navikt/ds-react';
import Kontaktboks from '../components/kontaktboks';
import AkselComponentEvents from '../components/AkselComponentEvents';

const TaksonomiPage = () => {
  return (
    <div className="w-full max-w-[800px] mx-auto">
      <Heading spacing level="1" size="large" className="pt-24 pb-4">
        Navs taksonomi for produktanalyser
      </Heading>

      <BodyLong size="large" className="mb-8 text-gray-600">
        En guide til hvordan du navngir hendelser i Umami for å sikre gode analyser.
      </BodyLong>

      {/* Add quick links */}
      <Box padding="4" borderWidth="1" borderColor="border-subtle" borderRadius="medium" className="mb-8">
        <Heading size="xsmall" level="2" className="mb-3">Snarvei</Heading>
        <Link href="#aksel-komponenter">
          Anbefalte hendelsesnavn og detaljer for Aksel-komponenter
        </Link>
      </Box>

      <div>
        <VStack gap="12">
          {/* Motivation Section */}
          <section>
            <Heading level="2" size="medium" spacing>
              Hvorfor bruke taksonomi?
            </Heading>
            <BodyLong spacing>
              Med en felles taksonomi blir det lettere å samle inn, analysere og sammenligne
              data på tvers av team og løsninger. Dette gir oss bedre innsikt i hvordan
              tjenestene våre brukes.
            </BodyLong>

            <Box
              className="p-6 pb-3"
              borderWidth="1"
              borderRadius="medium"
              borderColor="border-info"
              background="surface-info-subtle"
            >
              <Heading size="small" level="3">
                Dette får du med taksonomien
              </Heading>
              <BodyLong spacing>
                En standard for navngivning av hendelser på tvers av team, som gjør det:
              </BodyLong>
              <List as="ul" className="mb-0">
                <List.Item>Enklere å sammenlikne data fra forskjellige løsninger</List.Item>
                <List.Item>Lettere å forstå hva hendelsene betyr</List.Item>
                <List.Item>Mulig å gjenbruke kode på tvers av team</List.Item>
              </List>
            </Box>
          </section>

          {/* Event Naming Standards */}
          <section>
            <Heading level="2" size="medium" spacing>
              Slik navngir du hendelser
            </Heading>
            <BodyLong spacing>
              Når du sporer hendelser i Umami, bruk naturlig språk som beskriver hva
              brukeren gjør. Tenk på hendelsesnavnet som en kort setning.
            </BodyLong>

            <Box padding="6" borderWidth="1" borderColor="border-subtle" borderRadius="medium" className="my-4">
              <BodyLong className="font-medium">Enkelt prinsipp:</BodyLong>
              <BodyLong className="italic">Bruk vanlig norsk som alle kan forstå.</BodyLong>
            </Box>

            <BodyLong spacing>Eksempler på hendelsesnavn:</BodyLong>
            <List as="ul" className="mb-6">
              <List.Item><strong>skjema fullført</strong></List.Item>
              <List.Item><strong>knapp klikket</strong></List.Item>
              <List.Item><strong>lenke klikket</strong></List.Item>
              <List.Item><strong>søk gjennomført</strong></List.Item>
              <List.Item><strong>filter valgt</strong></List.Item>
              <List.Item><strong>utvidbart panel åpnet</strong></List.Item>
            </List>

            <ReadMore header="Se flere hendelsesnavn du kan bruke">
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
            <BodyLong spacing>
              For å gi mer kontekst til hendelsene kan du legge til ekstra informasjon.
              Dette gjør det lettere å forstå nøyaktig hva som skjedde og analysere dataene senere.
            </BodyLong>

            <Box padding="6" borderWidth="1" borderColor="border-subtle" borderRadius="medium" className="my-4">
              <BodyLong className="font-medium">Navnestruktur:</BodyLong>
              <BodyLong className="italic">Bruk to eller flere ord der første ordet starter med liten bokstav og de neste med stor.</BodyLong>
              <BodyLong className="mt-2">For eksempel: <code>appNavn</code>, <code>skjemaType</code>, <code>tekst</code></BodyLong>
            </Box>

            <BodyLong spacing>Vanlige eksempler:</BodyLong>
            <List as="ul" className="mb-6">
              <List.Item><code>appNavn: "dagpengesoknad"</code> - hvilken løsning hendelsen kommer fra</List.Item>
              <List.Item><code>skjemaType: "foreldrepenger"</code> - hvilket skjema det gjelder</List.Item>
              <List.Item><code>tekst: "Send søknad"</code> - teksten på knappen som ble klikket</List.Item>
              <List.Item><code>valgtSvar: "Ja"</code> - hva brukeren svarte</List.Item>
            </List>

            <Alert variant="success" className="mb-6">
              Ta bare med informasjon som gir verdi når du skal analysere dataene senere.
              Tenk gjennom hvilke spørsmål du vil kunne svare på med dataene.
            </Alert>

            <ReadMore header="Se flere hendelsesdetaljer du kan bruke">
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
            <BodyLong spacing>
              For å implementere Umami trenger du en sporingskode. Denne finner du via <Link href="/">Start Umami forsiden</Link>.
              Her er et eksempel på hvordan du kan spore hendelser i tråd med taksonomien:
            </BodyLong>

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
            <BodyLong spacing>
              Sjekk alltid at hendelsene blir registrert riktig i Umami.
            </BodyLong>

            <List as="ol">
              <List.Item>
                <strong><Link href="/grafbygger">Bruk Grafbygger</Link></strong> til å sjekke at du kan lage de rapportene du trenger
              </List.Item>
              <List.Item>
                <strong>Del med teamet</strong> for å sikre at alle forstår hva som spores og hvorfor
              </List.Item>
            </List>
          </section>

          <Kontaktboks />
        </VStack>
      </div>
    </div>
  );
};

export default TaksonomiPage;

import {
  Heading,
  VStack,
  Table,
  Box,
  ReadMore,
  BodyLong,
  List,
  Link,
  CopyButton,
} from '@navikt/ds-react';
import Kontaktboks from '../../components/theme/Kontaktboks/Kontaktboks';

const TaksonomiPage = () => {
  return (
    <div className="w-full max-w-[800px] mx-auto">
      <Heading spacing level="1" size="large" className="pt-24 pb-4">
        Navs taksonomi for produktanalyse
      </Heading>

      <BodyLong size="large" className="mb-8 text-gray-600">
        En guide til hvordan du navngir hendelser i Umami for å sikre gode analyser.
      </BodyLong>

      {/* Add quick links */}
      <Box padding="4" borderWidth="1" borderColor="border-subtle" borderRadius="medium" className="mb-8">
        <Heading size="xsmall" level="2" className="mb-3">Snarvei</Heading>
        <Link href="#analytics-types">
          Type-definisjoner for analytics-hendelser (@navikt/analytics-types)
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
              <List.Item><strong>navigere</strong> - når bruker klikker på lenker</List.Item>
              <List.Item><strong>besøk</strong> - når bruker besøker en side</List.Item>
              <List.Item><strong>filtervalg</strong> - når bruker velger et filter</List.Item>
              <List.Item><strong>skjema startet</strong> - når bruker starter et skjema</List.Item>
              <List.Item><strong>skjema fullført</strong> - når bruker fullfører et skjema</List.Item>
              <List.Item><strong>last ned</strong> - når bruker laster ned en fil</List.Item>
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
                    <Table.DataCell>navigere</Table.DataCell>
                    <Table.DataCell>Bruker klikker på en lenke</Table.DataCell>
                  </Table.Row>
                  <Table.Row>
                    <Table.DataCell>besøk</Table.DataCell>
                    <Table.DataCell>Bruker besøker en side</Table.DataCell>
                  </Table.Row>
                  <Table.Row>
                    <Table.DataCell>filtervalg</Table.DataCell>
                    <Table.DataCell>Bruker velger et filter</Table.DataCell>
                  </Table.Row>
                  <Table.Row>
                    <Table.DataCell>last ned</Table.DataCell>
                    <Table.DataCell>Bruker laster ned en fil</Table.DataCell>
                  </Table.Row>
                  <Table.Row>
                    <Table.DataCell>accordion åpnet</Table.DataCell>
                    <Table.DataCell>Bruker åpner et accordion-element</Table.DataCell>
                  </Table.Row>
                  <Table.Row>
                    <Table.DataCell>accordion lukket</Table.DataCell>
                    <Table.DataCell>Bruker lukker et accordion-element</Table.DataCell>
                  </Table.Row>
                  <Table.Row>
                    <Table.DataCell>modal åpnet</Table.DataCell>
                    <Table.DataCell>En modal-dialog åpnes</Table.DataCell>
                  </Table.Row>
                  <Table.Row>
                    <Table.DataCell>modal lukket</Table.DataCell>
                    <Table.DataCell>Modal-dialogen lukkes</Table.DataCell>
                  </Table.Row>
                  <Table.Row>
                    <Table.DataCell>skjema åpnet</Table.DataCell>
                    <Table.DataCell>Brukeren åpner et skjema</Table.DataCell>
                  </Table.Row>
                  <Table.Row>
                    <Table.DataCell>skjema startet</Table.DataCell>
                    <Table.DataCell>Brukeren begynner å fylle ut skjema</Table.DataCell>
                  </Table.Row>
                  <Table.Row>
                    <Table.DataCell>skjema fullført</Table.DataCell>
                    <Table.DataCell>Skjemaet sendes inn</Table.DataCell>
                  </Table.Row>
                  <Table.Row>
                    <Table.DataCell>skjema validering feilet</Table.DataCell>
                    <Table.DataCell>Skjemaet har valideringsfeil</Table.DataCell>
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
              <List.Item><code>lenketekst: "Les mer"</code> - teksten på lenken som ble klikket</List.Item>
              <List.Item><code>destinasjon: "/side/info"</code> - hvor lenken fører hen</List.Item>
              <List.Item><code>skjemanavn: "dagpengesoknad"</code> - hvilket skjema det gjelder</List.Item>
              <List.Item><code>komponentId: "hovedmeny"</code> - unik ID for komponenten</List.Item>
            </List>



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
                    <Table.DataCell>lenketekst</Table.DataCell>
                    <Table.DataCell>Teksten på lenken</Table.DataCell>
                    <Table.DataCell>"Les mer om dagpenger"</Table.DataCell>
                  </Table.Row>
                  <Table.Row>
                    <Table.DataCell>destinasjon</Table.DataCell>
                    <Table.DataCell>URL lenken fører til</Table.DataCell>
                    <Table.DataCell>"/dagpenger/soknad"</Table.DataCell>
                  </Table.Row>
                  <Table.Row>
                    <Table.DataCell>skjemanavn</Table.DataCell>
                    <Table.DataCell>Navn på skjemaet</Table.DataCell>
                    <Table.DataCell>"foreldrepenger"</Table.DataCell>
                  </Table.Row>
                  <Table.Row>
                    <Table.DataCell>komponentId</Table.DataCell>
                    <Table.DataCell>Unik ID for komponenten</Table.DataCell>
                    <Table.DataCell>"hovedmeny"</Table.DataCell>
                  </Table.Row>
                  <Table.Row>
                    <Table.DataCell>tekst</Table.DataCell>
                    <Table.DataCell>Generisk tekst (f.eks. på knapp)</Table.DataCell>
                    <Table.DataCell>"Send inn søknad"</Table.DataCell>
                  </Table.Row>
                  <Table.Row>
                    <Table.DataCell>kategori</Table.DataCell>
                    <Table.DataCell>Kategori for filter</Table.DataCell>
                    <Table.DataCell>"ytelse"</Table.DataCell>
                  </Table.Row>
                  <Table.Row>
                    <Table.DataCell>filter</Table.DataCell>
                    <Table.DataCell>Navn på filteret</Table.DataCell>
                    <Table.DataCell>"dagpenger"</Table.DataCell>
                  </Table.Row>
                  <Table.Row>
                    <Table.DataCell>kontekst</Table.DataCell>
                    <Table.DataCell>Ekstra kontekst om hendelsen</Table.DataCell>
                    <Table.DataCell>"søknadsskjema"</Table.DataCell>
                  </Table.Row>
                </Table.Body>
              </Table>
            </ReadMore>
          </section>

          {/* Analytics Types Package Section */}
          <section id="analytics-types">
            <Heading level="2" size="medium" spacing>
              Type-definisjoner for analytics-hendelser
            </Heading>
            <BodyLong spacing>
              En npm-pakke basert på Navs felles taksonomi som sikrer enhetlig sporing på tvers av team.
            </BodyLong>

            <Box
              className="p-6"
              borderWidth="1"
              borderRadius="medium"
              borderColor="border-info"
              background="surface-info-subtle"
            >
              <Heading size="small" level="3" spacing>
                <Link href="https://github.com/navikt/analytics-types" target="_blank" className="text-text-default hover:underline">
                  @navikt/analytics-types
                </Link>
              </Heading>
              <BodyLong className="mb-3">
                Pakken gir:
              </BodyLong>
              <List as="ul" className="mb-4">
                <List.Item><strong>Standardiserte hendelsenavn</strong> - Følger naturlige språkkonvensjoner (f.eks. "skjema åpnet")</List.Item>
                <List.Item><strong>Type-sikkerhet</strong> - Forhindrer skrivefeil og sikrer korrekte properties</List.Item>
                <List.Item><strong>Gjenbrukbarhet</strong> - Team kan dele hendelsesdefinisjoner på tvers av tjenester</List.Item>
                <List.Item><strong>Personvernoverensstemmelse</strong> - Kun godkjente, ikke-sensitive properties</List.Item>
              </List>
              <BodyLong className="mb-6">
                Navngivningen følger <Link href="https://aksel.nav.no/" target="_blank">Aksel</Link>, Navs designsystem, for å spore komponentbruk.
              </BodyLong>
              <BodyLong className="mb-2">
                <strong>Installer pakken:</strong>
              </BodyLong>
              <Box padding="3" borderWidth="1" borderColor="border-subtle" borderRadius="medium" className="bg-gray-50 flex items-center justify-between">
                <code className="text-sm">npm install @navikt/analytics-types</code>
                <CopyButton copyText="npm install @navikt/analytics-types" size="small" />
              </Box>
            </Box>

            <Box padding="6" borderWidth="1" borderColor="border-subtle" borderRadius="medium" className="my-6">
              <Heading size="xsmall" level="3" spacing>
                Eksempel på bruk
              </Heading>
              <pre className="text-sm whitespace-pre-wrap">
                {`import { Events, type NavigereProperties } from '@navikt/analytics-types';
import { getAnalyticsInstance } from '@navikt/nav-dekoratoren-moduler';

const analytics = getAnalyticsInstance('mitt-app-navn');

const properties: NavigereProperties = {
  lenketekst: 'Les mer',
  destinasjon: '/side/info'
};

analytics(Events.NAVIGERE, properties);`}
              </pre>
            </Box>

            <BodyLong spacing>
              Se <Link href="https://github.com/navikt/analytics-types" target="_blank">GitHub-repoet</Link> for
              komplett dokumentasjon over alle støttede events og attributter, og <Link href="https://github.com/navikt/analytics-types/blob/main/CONTRIBUTING.md" target="_blank">bidragsguiden</Link> hvis
              du vil legge til nye hendelser.
            </BodyLong>
          </section>

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
                {`// Når en bruker klikker på en lenke
function handleLenkeKlikk() {
  umami.track('navigere', {
    lenketekst: 'Les mer om dagpenger',
    destinasjon: '/dagpenger/soknad',
    kontekst: 'forsiden'
  });
}

// Når en bruker fullfører et skjema
function handleSkjemaSendt() {
  umami.track('skjema fullført', {
    skjemanavn: 'dagpengesoknad',
    kontekst: 'søknadsskjema'
  });
}`}
              </pre>
            </Box>
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

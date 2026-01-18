import { useState, useEffect } from 'react';
import {
  Button,
  Heading,
  CopyButton,
  Link,
  UNSAFE_Combobox,
  Textarea,
  Alert,
} from '@navikt/ds-react';
import Kontaktboks from '../../components/theme/Kontaktboks/Kontaktboks';
import { Copy } from 'lucide-react';

interface Website {
  id: string;
  name: string;
  domain: string;
  teamId: string;
}

const CopilotPage = () => {
  const [selectedWebsite, setSelectedWebsite] = useState<Website | null>(null);
  const [websites, setWebsites] = useState<Website[]>([]);
  const [eventNames, setEventNames] = useState<string>('');
  const [parameters, setParameters] = useState<string>('');
  const [copySuccess, setCopySuccess] = useState(false);

  const columnGroups = {
    eventBasics: {
      label: 'Basisdetaljer',
      columns: {
        event_id: true,
        created_at: true,
        event_type: true,
        event_name: true,
        website_id: true,
        website_domain: true,
        website_name: true,
      }
    },
    pageDetails: {
      label: 'Hendelsesdetaljer',
      columns: {
        page_title: true,
        url_path: true,
        url_query: true,
        url_fullpath: true,
        url_fullurl: true,
        referrer_domain: true,
        referrer_path: true,
        referrer_query: true,
        referrer_fullpath: true,
        referrer_fullurl: true,
      }
    },
    visitorDetails: {
      label: 'Brukerdetaljer',
      columns: {
        visit_id: true,
        session_id: true,
        browser: true,
        os: true,
        device: true,
        screen: true,
        language: true,
        country: true,
        subdivision1: true,
        city: true,
      }
    }
  };

  // Fetch websites (same as in Explore.tsx and Modellbygger.tsx)
  useEffect(() => {
    const baseUrl = window.location.hostname === 'localhost'
      ? 'https://reops-proxy.intern.nav.no'
      : 'https://reops-proxy.ansatt.nav.no';

    Promise.all([
      fetch(`${baseUrl}/umami/api/teams/aa113c34-e213-4ed6-a4f0-0aea8a503e6b/websites`, {
        credentials: window.location.hostname === 'localhost' ? 'omit' : 'include'
      }).then(response => response.json()),
      fetch(`${baseUrl}/umami/api/teams/bceb3300-a2fb-4f73-8cec-7e3673072b30/websites`, {
        credentials: window.location.hostname === 'localhost' ? 'omit' : 'include'
      }).then(response => response.json())
    ])
      .then(([data1, data2]) => {
        const combinedData = [...data1.data, ...data2.data];
        combinedData.sort((a, b) => {
          if (a.teamId === b.teamId) {
            return a.name.localeCompare(b.name);
          }
          return a.teamId === 'aa113c34-e213-4ed6-a4f0-0aea8a503e6b' ? -1 : 1;
        });
        setWebsites(combinedData);
      })
      .catch(error => console.error("Error fetching websites:", error));
  }, []);

  const generatePrompt = (): string => {
    if (!selectedWebsite || !eventNames || !parameters) return '';

    return `⚠️ CRITICAL - READ FIRST: SQL Field Names & Variables ⚠️

Table Structure:
1. Event Data (\`team-researchops-prod-01d6.umami.public_website_event\`):
   - event_type = 1 for pageviews
   - event_type = 2 for custom events
   - timestamp in created_at column
2. Parameters (\`team-researchops-prod-01d6.umami.public_event_data\`):
   - Use data_key (not 'key')
   - Use string_value (not 'value')
   - Joins: website_event_id = event_id
3. Session Data (\`team-researchops-prod-01d6.umami.public_session\`):
   - Joins on session_id
   - Contains browser, device, location info

Variables in Metabase:
✅ Use exactly two braces: {{variable}}
✅ No quotes: WHERE url_path = {{path}}
✅ Dates: created_at >= TIMESTAMP({{date}})

Website Context:
- ID: ${selectedWebsite.id}
- Name: ${selectedWebsite.name}
- Domain: ${selectedWebsite.domain}

Available Events:
${eventNames.split(',').map(e => `- ${e.trim()}`).join('\n')}

Available Parameters:
${parameters.split(',').map(p => `- ${p.trim()}`).join('\n')}

Available Base Columns:
${Object.values(columnGroups)
        .map(group => `${group.label}:\n${Object.keys(group.columns).map(col => `- ${col}`).join('\n')}`)
        .join('\n\n')}

SQL Requirements:
1. Use BigQuery syntax (TIMESTAMP_DIFF, FORMAT_TIMESTAMP)
2. Use backticks for table names
3. Avoid Norwegian characters in aliases (use 'besok' not 'besøk')
4. Include GROUP BY when using aggregations
5. Handle NULL values appropriately

Example Query:
\`\`\`sql
SELECT 
  FORMAT_TIMESTAMP('%Y-%m-%d', we.created_at) AS date,
  COUNT(*) as page_views
FROM \`team-researchops-prod-01d6.umami.public_website_event\` we
WHERE 
  we.website_id = '${selectedWebsite.id}'
  AND we.event_type = 1
  AND we.created_at >= TIMESTAMP({{date}})
GROUP BY date
ORDER BY date;
\`\`\`

Return only working SQL queries without explanations unless asked.`;
  };

  const handleCopyPrompt = async () => {
    if (!generatePrompt()) return;

    try {
      await navigator.clipboard.writeText(generatePrompt());
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error('Failed to copy prompt:', err);
    }
  };

  const getEventsSQL = (): string => {
    if (!selectedWebsite) return '';

    return `-- Finn alle tilgjengelige events
SELECT STRING_AGG(DISTINCT
  CASE 
    WHEN event_type = 1 THEN 'pageview'
    ELSE event_name 
  END, ',') as events
FROM \`team-researchops-prod-01d6.umami.public_website_event\`
WHERE website_id = '${selectedWebsite.id}';`;
  };

  const getParametersSQL = (): string => {
    if (!selectedWebsite) return '';

    return `-- Finn alle tilgjengelige parametere
SELECT STRING_AGG(DISTINCT data_key, ',') as parameters
FROM \`team-researchops-prod-01d6.umami.public_event_data\` ed
JOIN \`team-researchops-prod-01d6.umami.public_website_event\` e
  ON ed.website_event_id = e.event_id
WHERE e.website_id = '${selectedWebsite.id}';`;
  };

  return (
    <div className="w-full max-w-2xl">
      <Heading spacing level="1" size="medium" className="pt-12 pb-6">
        Få hjelp av AI til å lage Metabase-spørringer
      </Heading>

      <p className="text-gray-600 mb-10">
        Bruk denne siden til å generere en AI-prompt som hjelper deg med å lage spørringer for Metabase.
        Prompten vil guide AI-assistenten til å generere SQL-kode som fungerer med din Umami-modell.
      </p>

      <div className="space-y-8">
        <UNSAFE_Combobox
          label="Velg nettside / app"
          options={websites.map(website => ({
            label: website.name,
            value: website.name,
            website: website
          }))}
          selectedOptions={selectedWebsite ? [selectedWebsite.name] : []}
          onToggleSelected={(option, isSelected) => {
            if (isSelected) {
              const website = websites.find(w => w.name === option);
              setSelectedWebsite(website || null);
            } else {
              setSelectedWebsite(null);
            }
          }}
          clearButton
        />

        <div className="space-y-6">
          {/* Events Section */}
          <div className="border rounded-lg p-4 bg-gray-50">
            <Heading level="2" size="small" spacing>
              Steg 1: Finn tilgjengelige events
            </Heading>

            <ol className="list-decimal list-inside text-sm text-gray-600 mb-4">
              <li><Link href="https://metabase.ansatt.nav.no/dashboard/484" target="_blank">Åpne Metabase</Link> i en ny fane</li>
              <li>Kjør denne spørringen for å se alle events:</li>
            </ol>

            <div className="bg-white p-4 rounded border mb-4">
              <div className="relative">
                <pre className="overflow-x-auto">
                  {getEventsSQL()}
                </pre>
                <div className="absolute top-2 right-2">
                  <CopyButton
                    copyText={getEventsSQL()}
                    text="Kopier SQL"
                    activeText="Kopiert!"
                    size="small"
                  />
                </div>
              </div>
            </div>

            <Textarea
              label="Lim inn events"
              description="Kopier resultatet fra events-kolonnen i Metabase og lim inn her"
              value={eventNames}
              onChange={(e) => setEventNames(e.target.value)}
              rows={3}
            />
          </div>

          {/* Parameters Section */}
          <div className="border rounded-lg p-4 bg-gray-50">
            <Heading level="2" size="small" spacing>
              Steg 2: Finn tilgjengelige parametere
            </Heading>

            <ol className="list-decimal list-inside text-sm text-gray-600 mb-4">
              <li>Kjør denne spørringen i Metabase:</li>
            </ol>

            <div className="bg-white p-4 rounded border mb-4">
              <div className="relative">
                <pre className="overflow-x-auto">
                  {getParametersSQL()}
                </pre>
                <div className="absolute top-2 right-2">
                  <CopyButton
                    copyText={getParametersSQL()}
                    text="Kopier SQL"
                    activeText="Kopiert!"
                    size="small"
                  />
                </div>
              </div>
            </div>

            <Textarea
              label="Lim inn parametere"
              description="Kopier resultatet fra parameters-kolonnen i Metabase og lim inn her"
              value={parameters}
              onChange={(e) => setParameters(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        {(!selectedWebsite || !eventNames || !parameters) ? (
          <Alert variant="info">
            Følg stegene over for å generere en AI-prompt
          </Alert>
        ) : (
          <div className="space-y-4">
            <Heading level="2" size="small">
              Din AI-prompt
            </Heading>

            <div className="bg-gray-50 p-4 rounded relative overflow-hidden">
              <pre className="whitespace-pre-wrap max-h-[600px] overflow-y-auto">
                {generatePrompt()}
              </pre>
              <div className="absolute top-2 right-2">
                <Button
                  variant="secondary"
                  size="small"
                  onClick={handleCopyPrompt}
                  icon={<Copy aria-hidden />}
                >
                  {copySuccess ? 'Kopiert!' : 'Kopier'}
                </Button>
              </div>
            </div>

            <div className="space-y-4 bg-white p-6 rounded border">
              <Heading level="3" size="xsmall">
                Slik bruker du prompten:
              </Heading>
              <ol className="list-decimal list-inside space-y-2">
                <li>Kopier prompten over</li>
                <li>Åpne din foretrukne AI-assistent (f.eks. ChatGPT eller Claude)</li>
                <li>Lim inn prompten</li>
                <li>Still spørsmål om hvilken visualisering du ønsker å lage</li>
                <li>Få SQL-kode tilbake som du kan bruke i Metabase</li>
              </ol>

              <Heading level="3" size="xsmall" className="mt-6">
                Eksempel på spørsmål du kan stille:
              </Heading>
              <ul className="list-disc list-inside space-y-2">
                <li>"Vis meg daglige sidevisninger for de siste 30 dagene"</li>
                <li>"Lag en konverteringstrakt for hendelsene A → B → C"</li>
                <li>"Sammenlign konverteringsrater mellom ulike brukergrupper"</li>
                <li>"Vis trend for fluktrate fordelt på trafikkilde"</li>
              </ul>
            </div>
          </div>
        )}

        <Kontaktboks />
      </div>
    </div>
  );
};

export default CopilotPage;

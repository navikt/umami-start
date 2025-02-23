import { useState, KeyboardEvent, ChangeEvent, useEffect } from 'react';
import {
  Button,
  TextField,
  Heading,
  UNSAFE_Combobox,
  RadioGroup,
  Radio,
  CopyButton,
  HGrid
} from '@navikt/ds-react';

interface Website {
  id: string;
  name: string;
  domain: string;
  teamId: string;
}

type EventQueryType = 'custom' | 'pageview' | 'combined';

const ExploreQueries = () => {
  const [selectedWebsite, setSelectedWebsite] = useState<Website | null>(null);
  const [websites, setWebsites] = useState<Website[]>([]);
  const [queryType, setQueryType] = useState<EventQueryType>('custom');
  const [eventNames, setEventNames] = useState<string[]>([]);
  const [newEventName, setNewEventName] = useState<string>('');

  // Fetch websites
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

  const addEventName = (): void => {
    if (!newEventName.trim()) return;
    
    const events = newEventName
      .split(/[\n,]/)
      .map(event => event.trim())
      .filter(event => event && !eventNames.includes(event));
    
    if (events.length) {
      setEventNames(prev => [...prev, ...events]);
      setNewEventName('');
    }
  };

  const removeEventName = (eventToRemove: string): void => {
    setEventNames(eventNames.filter(event => event !== eventToRemove));
  };

  const handleKeyPress = (e: KeyboardEvent<HTMLInputElement>, action: () => void) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      action();
    }
  };

  const getEventOverviewSQL = (): string => {
    if (!selectedWebsite) return '';
    
    return `-- Oversikt over eventer og forekomster
SELECT 
  CASE 
    WHEN e.event_type = 1 THEN 'Pageview (Umami auto-track)'
    ELSE e.event_name 
  END as event_name,
  COUNT(DISTINCT e.event_id) as total_events,
  COUNT(DISTINCT e.session_id) as unique_sessions,
  MIN(e.created_at) as first_seen,
  MAX(e.created_at) as last_seen,
  COUNT(DISTINCT ed.data_key) as number_of_parameters,
  STRING_AGG(DISTINCT ed.data_key, ', ' ORDER BY ed.data_key LIMIT 5) as parameter_examples
FROM \`team-researchops-prod-01d6.umami.public_website_event\` e
LEFT JOIN \`team-researchops-prod-01d6.umami.public_event_data\` ed
  ON e.event_id = ed.website_event_id
WHERE e.website_id = '${selectedWebsite.id}'
GROUP BY 1
ORDER BY total_events DESC;`;
  };

  const getEventParamsSQL = (): string => {
    if (!selectedWebsite) return '';
    if (queryType === 'custom' && eventNames.length === 0) return '';
    
    return `-- Utforsk parametere for valgte events
WITH event_params AS (
  SELECT 
    CASE 
      WHEN e.event_type = 1 THEN 'Pageview (Umami auto-track)'
      ELSE e.event_name 
    END as event_name,
    ed.data_key,
    ed.data_type,
    COUNT(*) as occurrences,
    COUNT(DISTINCT e.session_id) as unique_sessions,
    MIN(e.created_at) as first_seen,
    MAX(e.created_at) as last_seen,
    COUNT(DISTINCT CASE 
      WHEN ed.string_value IS NOT NULL THEN ed.string_value
      WHEN ed.number_value IS NOT NULL THEN CAST(ed.number_value AS STRING)
      WHEN ed.date_value IS NOT NULL THEN CAST(ed.date_value AS STRING)
    END) as unique_values,
    STRING_AGG(DISTINCT CAST(
      CASE 
        WHEN ed.string_value IS NOT NULL THEN ed.string_value
        WHEN ed.number_value IS NOT NULL THEN CAST(ed.number_value AS STRING)
        WHEN ed.date_value IS NOT NULL THEN CAST(ed.date_value AS STRING)
      END
    AS STRING), ', ' ORDER BY CAST(
      CASE 
        WHEN ed.string_value IS NOT NULL THEN ed.string_value
        WHEN ed.number_value IS NOT NULL THEN CAST(ed.number_value AS STRING)
        WHEN ed.date_value IS NOT NULL THEN CAST(ed.date_value AS STRING)
      END
    AS STRING) LIMIT 5) as example_values
  FROM \`team-researchops-prod-01d6.umami.public_website_event\` e
  JOIN \`team-researchops-prod-01d6.umami.public_event_data\` ed
    ON e.event_id = ed.website_event_id
  WHERE 
    e.website_id = '${selectedWebsite.id}'
    ${queryType === 'custom' ? 
      `AND e.event_type = 2 AND e.event_name IN ('${eventNames.join("', '")}')` :
      queryType === 'pageview' ? 
      'AND e.event_type = 1' :
      eventNames.length > 0 ? 
      `AND (e.event_type = 1 OR e.event_name IN ('${eventNames.join("', '")}'))` :
      ''}
  GROUP BY 1, 2, 3
)
SELECT 
  event_name,
  data_key,
  data_type,
  occurrences,
  unique_sessions,
  unique_values,
  first_seen,
  last_seen,
  example_values
FROM event_params
ORDER BY 
  event_name,
  occurrences DESC;`;
  };

  return (
    <div className="w-full max-w-2xl">
      <Heading spacing level="1" size="medium" className="pt-12 pb-6">
        Utforsk strukturen til Umami-data i Metabase
      </Heading>
      <p className="text-gray-600 mb-10">
        Ønsker du å vite hvilke eventer som er tilgjengelige for din nettside eller app? Eller vil du se hvilke parametere som er knyttet til et spesifikt event? 
        Her finner du spørringer som hjelper deg med å utforske strukturen til Umami-data trinn for trinn i Metabase.
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

        {selectedWebsite ? (
          <div className="space-y-8">
            <div>
              <Heading level="2" size="small" spacing>
                Utforsk tilgjengelige eventer
              </Heading>
              <ol className="list-decimal list-inside text-sm text-gray-600 mb-4">
                <li>Åpne Metabase og klikk på den blå "Ny / New" knappen i toppmenyen.</li>
                <li>Velg "SQL-spørring / SQL query" fra menyen som vises.</li>
                <li>Kopier og kjør SQL-koden nedenfor og lim den inn i spørringseditoren.</li>
              </ol>
              <div className="relative">
                <pre className="bg-gray-50 p-4 rounded overflow-x-auto">
                  {getEventOverviewSQL()}
                </pre>
                <div className="absolute top-2 right-2">
                  <CopyButton
                    copyText={getEventOverviewSQL()}
                    text="Kopier SQL"
                    activeText="Kopiert!"
                    size="small"
                  />
                </div>
              </div>
            </div>

            <RadioGroup 
              legend="Hvilke event-typer vil du utforske parametere for?"
              value={queryType}
              onChange={(value: EventQueryType) => {
                setQueryType(value);
                if (value === 'pageview') setEventNames([]);
              }}
            >
              <Radio value="custom">Egendefinerte eventer</Radio>
              <Radio value="pageview">Umami besøk-eventet</Radio>
            </RadioGroup>

            {(queryType === 'custom' || queryType === 'combined') && (
              <div>
                <div className="flex gap-2 items-end mb-4">
                  <TextField
                    label="Event-navn"
                    description="Eksempel: skjema startet (legg til flere med komma)"
                    value={newEventName}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setNewEventName(e.target.value)}
                    onKeyUp={(e: KeyboardEvent<HTMLInputElement>) => handleKeyPress(e, addEventName)}
                    style={{ width: '100%' }}
                  />
                  <Button 
                    variant="secondary" 
                    onClick={addEventName}
                    style={{ height: '48px' }}
                  >
                    Legg til
                  </Button>
                </div>

                {eventNames.length > 0 && (
                  <HGrid gap="4">
                    {eventNames.map((event) => (
                      <div key={event} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                        <span>{event}</span>
                        <Button
                          variant="danger"
                          size="small"
                          onClick={() => removeEventName(event)}
                        >
                          Fjern
                        </Button>
                      </div>
                    ))}
                  </HGrid>
                )}
              </div>
            )}

            {((queryType === 'pageview') || (queryType === 'custom' && eventNames.length > 0)) && (
              <div>
                <Heading level="2" size="small" spacing>
                  Utforsk parametere
                </Heading>
                <ol className="list-decimal list-inside text-sm text-gray-600 mb-4">
                    <li>Åpne Metabase og klikk på den blå "Ny / New" knappen i toppmenyen.</li>
                    <li>Velg "SQL-spørring / SQL query" fra menyen som vises.</li>
                    <li>Kopier og kjør SQL-koden nedenfor og lim den inn i spørringseditoren.</li>
                </ol>
                <div className="relative">
                  <pre className="bg-gray-50 p-4 rounded overflow-x-auto">
                    {getEventParamsSQL()}
                  </pre>
                  <div className="absolute top-2 right-2">
                    <CopyButton
                      copyText={getEventParamsSQL()}
                      text="Kopier SQL"
                      activeText="Kopiert!"
                      size="small"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (<>    
            {/*
            <Box padding="8" background="surface-subtle" className="text-center">
              <Heading spacing level="2" size="small">
                Velg en nettside for å starte utforskningen
              </Heading>
              <p className="text-gray-600">
                Når du har valgt en nettside, vil du få tilgang til spørringer 
                som hjelper deg å utforske strukturen til dataene trinn for trinn i Metabase.
              </p>
            </Box>
            */}
          </>
        )}
      </div>
    </div>
  );
};

export default ExploreQueries;

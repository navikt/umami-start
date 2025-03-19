import { useState, KeyboardEvent, ChangeEvent } from 'react';
import {
  Button,
  Link,
  TextField,
  Heading,
  RadioGroup,
  Radio,
  CopyButton,
  HGrid,
  Alert
} from '@navikt/ds-react';
import { ChevronDown, ChevronUp, Copy, ExternalLink } from 'lucide-react';
import Kontaktboks from '../components/kontaktboks';
import WebsitePicker from '../components/WebsitePicker';

interface Website {
  id: string;
  name: string;
  domain: string;
  teamId: string;
}

type EventQueryType = 'custom' | 'pageview' | 'combined';

const ExploreQueries = () => {
  const [selectedWebsite, setSelectedWebsite] = useState<Website | null>(null);
  const [queryType, setQueryType] = useState<EventQueryType>('custom');
  const [eventNames, setEventNames] = useState<string[]>([]);
  const [newEventName, setNewEventName] = useState<string>('');
  const [showEventOverviewSQL, setShowEventOverviewSQL] = useState(false);
  const [showEventParamsSQL, setShowEventParamsSQL] = useState(false);
  const [eventOverviewCopied, setEventOverviewCopied] = useState(false);
  const [eventParamsCopied, setEventParamsCopied] = useState(false);

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
  STRING_AGG(DISTINCT ed.data_key, ', ' ORDER BY ed.data_key) as parameters
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

  const handleCopyEventOverview = () => {
    navigator.clipboard.writeText(getEventOverviewSQL());
    setEventOverviewCopied(true);
    setTimeout(() => setEventOverviewCopied(false), 3000);
  };

  const handleCopyEventParams = () => {
    navigator.clipboard.writeText(getEventParamsSQL());
    setEventParamsCopied(true);
    setTimeout(() => setEventParamsCopied(false), 3000);
  };

  return (
    <div className="w-full max-w-2xl">
      <Heading spacing level="1" size="medium" className="pt-12 pb-6">
        Utforsk data-strukturen for ditt nettsted
      </Heading>
      <p className="text-gray-600 mb-10">
        Dette verktøyet hjelper deg å utforske hvilke data som er tilgjengelige fra ditt nettsted i Metabase.
        Du kan se hvilke hendelser som er registrert og hvilke ekstra parametere som er knyttet til hver hendelse.
      </p>

      <div className="space-y-8">
          <WebsitePicker
            selectedWebsite={selectedWebsite}
            onWebsiteChange={setSelectedWebsite}
          />

        {selectedWebsite && (
          <div className="space-y-8">
            {/* Event Overview Section */}
            <div className="bg-white p-6 rounded-lg border shadow-sm">
              <div className="space-y-2 mb-4">
                <Heading level="2" size="small">
                  Steg 1: Se hvilke hendelser som finnes
                </Heading>
                <p className="text-sm text-gray-600">
                  Finn ut hvilke hendelser som er registrert for {selectedWebsite.name} og hvor ofte de forekommer.
                </p>
              </div>

              <div className="bg-blue-50 p-4 rounded-md border border-blue-100">
                <div className="flex flex-col gap-4">
                  <div className="flex items-start gap-3">
                    <div className="bg-blue-600 text-white rounded-full h-6 w-6 flex items-center justify-center flex-shrink-0 mt-0.5">
                      1
                    </div>
                    <div>
                      <p className="font-medium">Åpne Metabase</p>
                      <Link 
                        href="https://metabase.ansatt.nav.no/dashboard/484" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 mt-1"
                      >
                        Klikk her for å gå til Metabase <ExternalLink size={14} />
                      </Link>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="bg-blue-600 text-white rounded-full h-6 w-6 flex items-center justify-center flex-shrink-0 mt-0.5">
                      2
                    </div>
                    <div>
                      <p className="font-medium">Klikk på "New / Ny"-knappen i toppmenyen</p>
                      <p className="text-sm text-gray-600 mt-1">Velg deretter "SQL query / SQL-spørring"</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="bg-blue-600 text-white rounded-full h-6 w-6 flex items-center justify-center flex-shrink-0 mt-0.5">
                      3
                    </div>
                    <div className="flex-grow">
                      <p className="font-medium">Kopier oversikt-spørringen</p>
                      <div className="mt-2">
                        {!eventOverviewCopied ? (
                          <Button 
                            variant="primary" 
                            onClick={handleCopyEventOverview} 
                            icon={<Copy size={18} />}
                            className="w-full md:w-auto"
                          >
                            Kopier oversikt-spørring
                          </Button>
                        ) : (
                          <Alert variant="success" className="w-fit p-2 flex items-center">
                            Spørringen er kopiert!
                          </Alert>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="bg-blue-600 text-white rounded-full h-6 w-6 flex items-center justify-center flex-shrink-0 mt-0.5">
                      4
                    </div>
                    <div>
                      <p className="font-medium">Trykk på ▶️ "kjør spørring"-knappen</p>
                      <p className="text-sm text-gray-600 mt-1">Du vil nå se alle hendelser og deres forekomster</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4">
                <Button 
                  variant="tertiary"
                  size="small"
                  onClick={() => setShowEventOverviewSQL(!showEventOverviewSQL)}
                  icon={showEventOverviewSQL ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  className="mb-2"
                >
                  {showEventOverviewSQL ? "Skjul SQL-kode" : "Vis SQL-kode"}
                </Button>

                {showEventOverviewSQL && (
                  <div className="relative">
                    <pre className="bg-gray-50 p-4 rounded overflow-x-auto whitespace-pre-wrap max-h-[calc(100vh-500px)] overflow-y-auto border text-sm">
                      {getEventOverviewSQL()}
                    </pre>
                    <div className="absolute top-2 right-2">
                      <CopyButton
                        copyText={getEventOverviewSQL()}
                        text="Kopier"
                        activeText="Kopiert!"
                        size="small"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-2 text-sm bg-yellow-50 p-3 rounded-md border border-yellow-100">
                <p>
                  <strong>Tips:</strong> Bruk denne spørringen for å få en oversikt over alle hendelser som er 
                  registrert for ditt nettsted. Resultatene vil vise hvilke eventer du kan utforske nærmere i steg 2.
                </p>
              </div>
            </div>

            {/* Event Parameters Section */}
            <div className="bg-white p-6 rounded-lg border shadow-sm">
              <div className="space-y-2 mb-4">
                <Heading level="2" size="small">
                  Steg 2: Utforsk parametere for hendelser
                </Heading>
                <p className="text-sm text-gray-600">
                  Velg hvilke hendelser du vil utforske parametere for.
                </p>
              </div>

              <div className="p-4 rounded-md border mb-6">
                <RadioGroup 
                  legend="Hvilke hendelser vil du utforske parameterene til?"
                  value={queryType}
                  onChange={(value: EventQueryType) => {
                    setQueryType(value);
                    if (value === 'pageview') setEventNames([]);
                  }}
                >
                  <Radio value="custom">Egendefinerte hendelser</Radio>
                  <Radio value="pageview">Automatisk registrerte sidevisninger</Radio>
                </RadioGroup>

                {(queryType === 'custom' || queryType === 'combined') && (
                  <div className="mt-4">
                    <div className="flex gap-2 items-end mb-4">
                      <TextField
                        label="Navn på hendelser"
                        description="Eksempel: skjema startet (legg til flere med komma)"
                        value={newEventName}
                        onChange={(e: ChangeEvent<HTMLInputElement>) => setNewEventName(e.target.value)}
                        onKeyUp={(e: KeyboardEvent<HTMLInputElement>) => handleKeyPress(e, addEventName)}
                        style={{ width: '100%' }}
                      />
                      <Button 
                        variant="secondary" 
                        onClick={addEventName}
                        style={{ 
                          height: '48px',
                          whiteSpace: 'nowrap',
                          minWidth: 'fit-content'
                        }}
                      >
                        Legg til
                      </Button>
                    </div>

                    {eventNames.length > 0 && (
                      <div className="bg-blue-50 p-3 rounded-md mt-2 mb-4">
                        <p className="font-medium mb-2">Valgte hendelser:</p>
                        <HGrid gap="4">
                          {eventNames.map((event) => (
                            <div key={event} className="flex items-center justify-between p-2 bg-white rounded border">
                              <span>{event}</span>
                              <Button
                                variant="tertiary-neutral"
                                size="small"
                                onClick={() => removeEventName(event)}
                              >
                                Fjern
                              </Button>
                            </div>
                          ))}
                        </HGrid>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {((queryType === 'pageview') || (queryType === 'custom' && eventNames.length > 0)) && (
                <>
                  <div className="bg-blue-50 p-4 rounded-md border border-blue-100">
                    <div className="flex flex-col gap-4">
                      <div className="flex items-start gap-3">
                        <div className="bg-blue-600 text-white rounded-full h-6 w-6 flex items-center justify-center flex-shrink-0 mt-0.5">
                          1
                        </div>
                        <div>
                          <p className="font-medium">Åpne Metabase</p>
                          <Link 
                            href="https://metabase.ansatt.nav.no/dashboard/484" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 mt-1"
                          >
                            Klikk her for å gå til Metabase <ExternalLink size={14} />
                          </Link>
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <div className="bg-blue-600 text-white rounded-full h-6 w-6 flex items-center justify-center flex-shrink-0 mt-0.5">
                          2
                        </div>
                        <div>
                          <p className="font-medium">Klikk på "New / Ny"-knappen i toppmenyen</p>
                          <p className="text-sm text-gray-600 mt-1">Velg deretter "SQL query / SQL-spørring"</p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <div className="bg-blue-600 text-white rounded-full h-6 w-6 flex items-center justify-center flex-shrink-0 mt-0.5">
                          3
                        </div>
                        <div className="flex-grow">
                          <p className="font-medium">Kopier parameter-spørringen</p>
                          <div className="mt-2">
                            {!eventParamsCopied ? (
                              <Button 
                                variant="primary" 
                                onClick={handleCopyEventParams} 
                                icon={<Copy size={18} />}
                                className="w-full md:w-auto"
                              >
                                Kopier parameter-spørring
                              </Button>
                            ) : (
                              <Alert variant="success" className="w-fit p-2 flex items-center">
                                Spørringen er kopiert!
                              </Alert>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <div className="bg-blue-600 text-white rounded-full h-6 w-6 flex items-center justify-center flex-shrink-0 mt-0.5">
                          4
                        </div>
                        <div>
                          <p className="font-medium">Trykk på ▶️ "kjør spørring"-knappen</p>
                          <p className="text-sm text-gray-600 mt-1">Du vil nå se alle tilgjengelige parametere for de valgte hendelsene</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4">
                    <Button 
                      variant="tertiary"
                      size="small"
                      onClick={() => setShowEventParamsSQL(!showEventParamsSQL)}
                      icon={showEventParamsSQL ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      className="mb-2"
                    >
                      {showEventParamsSQL ? "Skjul SQL-kode" : "Vis SQL-kode"}
                    </Button>

                    {showEventParamsSQL && (
                      <div className="relative">
                        <pre className="bg-gray-50 p-4 rounded overflow-x-auto whitespace-pre-wrap max-h-[calc(100vh-500px)] overflow-y-auto border text-sm">
                          {getEventParamsSQL()}
                        </pre>
                        <div className="absolute top-2 right-2">
                          <CopyButton
                            copyText={getEventParamsSQL()}
                            text="Kopier"
                            activeText="Kopiert!"
                            size="small"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="mt-2 text-sm bg-yellow-50 p-3 rounded-md border border-yellow-100">
                    <p>
                      <strong>Tips:</strong> Parameterne du finner her kan brukes i Grafbyggeren 
                      under "Egendefinerte parametere" for å lage mer avanserte visualiseringer.
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
        <div className="pt-8"><Kontaktboks /></div>
      </div>
    </div>
  );
};

export default ExploreQueries;

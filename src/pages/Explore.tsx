import { useState, useEffect } from 'react';
import {
  Heading,
  Search,
  Tabs,
  BodyShort,
  Panel,
  Accordion,
  Tag,
  Skeleton,
  Button,
  Alert,
  VStack,
  HStack,
  TextField,
} from '@navikt/ds-react';
import { Download, Filter, ChevronDown, ChevronUp, Calendar } from 'lucide-react';
import Kontaktboks from '../components/kontaktboks';
import WebsitePicker from '../components/WebsitePicker';

interface Website {
  id: string;
  name: string;
  domain: string;
  teamId: string;
}

interface EventProperty {
  eventName: string;
  propertyName: string;
  total: number;
}

interface EventItem {
  name: string;
  count: number;
  parameters: {
    name: string;
    count: number;
  }[];
}

const ExploreEvents = () => {
  const [selectedWebsite, setSelectedWebsite] = useState<Website | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [showContent, setShowContent] = useState<'data' | 'charts'>('data');
  const [error, setError] = useState<string | null>(null);
  const [expandedTimeRange, setExpandedTimeRange] = useState(false);
  const [daysToShow, setDaysToShow] = useState<number>(7);
  const [maxDaysAvailable, setMaxDaysAvailable] = useState<number>(0);
  
  // Fetch event data when website is selected
  useEffect(() => {
    if (!selectedWebsite?.id) return;
    
    const fetchEventData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const baseUrl = window.location.hostname === 'localhost' 
          ? 'https://reops-proxy.intern.nav.no' 
          : 'https://reops-proxy.ansatt.nav.no';

        // Fetch the date range first
        const dateRangeResponse = await fetch(`${baseUrl}/umami/api/websites/${selectedWebsite.id}/daterange`, {
          credentials: window.location.hostname === 'localhost' ? 'omit' : 'include'
        });
        const dateRange = await dateRangeResponse.json();
        
        // Calculate date range
        const endDate = new Date(dateRange.maxdate);
        const startDate = new Date(dateRange.mindate);
        
        // Calculate max available days
        const totalDays = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
        setMaxDaysAvailable(totalDays);
        
        // Adjust daysToShow if it exceeds available days
        if (daysToShow > totalDays) {
          setDaysToShow(totalDays);
        }
        
        // Calculate effective start date
        const requestedDaysAgo = new Date(endDate);
        requestedDaysAgo.setDate(requestedDaysAgo.getDate() - daysToShow);
        const effectiveStartDate = startDate > requestedDaysAgo ? startDate : requestedDaysAgo;
        
        // Convert to milliseconds
        const startAt = effectiveStartDate.getTime();
        const endAt = endDate.getTime();
        
        // Fetch event properties with limited date range
        const propertiesResponse = await fetch(
          `${baseUrl}/umami/api/websites/${selectedWebsite.id}/event-data/properties?startAt=${startAt}&endAt=${endAt}&unit=hour&timezone=Europe%2FOslo`,
          {
            credentials: window.location.hostname === 'localhost' ? 'omit' : 'include'
          }
        );
        const properties: EventProperty[] = await propertiesResponse.json();
        
        // Process the data into a more usable format
        const eventMap = new Map<string, EventItem>();
        
        properties.forEach(prop => {
          if (!eventMap.has(prop.eventName)) {
            eventMap.set(prop.eventName, {
              name: prop.eventName,
              count: prop.total,
              parameters: []
            });
          }
          
          const event = eventMap.get(prop.eventName)!;
          
          // Add parameter if it doesn't already exist
          if (!event.parameters.find(p => p.name === prop.propertyName)) {
            event.parameters.push({
              name: prop.propertyName,
              count: prop.total
            });
          }
        });
        
        // Convert map to array and sort by frequency
        const eventArray = Array.from(eventMap.values()).sort((a, b) => b.count - a.count);
        setEvents(eventArray);
      } catch (err) {
        console.error('Error fetching event data:', err);
        setError('Det oppstod en feil ved henting av hendelser. Vennligst prøv igjen senere.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchEventData();
  }, [selectedWebsite?.id, daysToShow]);

  const handleDaysChange = (value: string) => {
    const days = parseInt(value, 10);
    if (isNaN(days) || days < 1) {
      setDaysToShow(1);
    } else if (days > maxDaysAvailable) {
      setDaysToShow(maxDaysAvailable);
    } else {
      setDaysToShow(days);
    }
  };

  // Filter events based on search term with null check
  const filteredEvents = events.filter(event => {
    if (!event?.name) return false;
    
    const searchLower = searchTerm.toLowerCase();
    return (
      event.name.toLowerCase().includes(searchLower) ||
      event.parameters?.some(param => param?.name?.toLowerCase().includes(searchLower))
    );
  });
  
  // Generate a simple CSV of events and parameters
  const downloadCSV = () => {
    if (events.length === 0) return;
    
    const headers = ['Event', 'Occurrences', 'Parameter', 'Parameter Occurrences'];
    const rows: string[][] = [];
    
    events.forEach(event => {
      if (event.parameters.length === 0) {
        rows.push([event.name, event.count.toString(), '', '']);
      } else {
        event.parameters.forEach((param, idx) => {
          if (idx === 0) {
            rows.push([event.name, event.count.toString(), param.name, param.count.toString()]);
          } else {
            rows.push(['', '', param.name, param.count.toString()]);
          }
        });
      }
    });
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `${selectedWebsite?.name}-events.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="w-full max-w-5xl">
      <Heading spacing level="1" size="medium" className="pt-12 pb-6">
        Utforsk hendelser og parametere
      </Heading>
      <p className="text-gray-600 mb-10 prose max-w-none">
        Dette verktøyet gir deg en enkel oversikt over alle hendelser som er registrert på nettsiden din,
        inkludert hvilke ekstra parametere som er tilgjengelige for hver hendelse og hvor ofte de brukes.
        Dette er nyttig når du skal lage grafer og tabeller og trenger å vite hvilke data som er tilgjengelige.
      </p>

      <div className="bg-white p-6 rounded-lg border shadow-sm mb-6">
        <WebsitePicker
          selectedWebsite={selectedWebsite}
          onWebsiteChange={setSelectedWebsite}
        />
      </div>

      {selectedWebsite && (
        <div className="bg-white p-6 rounded-lg border shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <Heading level="2" size="small">
              Hendelser for {selectedWebsite.name}
            </Heading>
            
            <Button
              variant="secondary"
              icon={<Download aria-hidden />}
              size="small"
              onClick={downloadCSV}
              disabled={events.length === 0 || loading}
            >
              Last ned CSV
            </Button>
          </div>
          
          {error ? (
            <Alert variant="error">{error}</Alert>
          ) : (
            <>
              <div className="mb-6">
                <Search
                  label="Søk etter hendelser eller parametere"
                  placeholder="F.eks. 'klikk', 'skjema' eller 'button'"
                  size="small"
                  value={searchTerm}
                  onChange={setSearchTerm} // Corrected onChange handler
                  hideLabel={false}
                />
              </div>
              
              {loading ? (
                <VStack gap="4">
                  {[1, 2, 3].map(i => (
                    <Skeleton key={i} variant="rounded" height={100} />
                  ))}
                </VStack>
              ) : (
                events.length > 0 ? (
                  <div className="space-y-4">
                    <div className="bg-blue-50 p-4 rounded-md mb-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <BodyShort>
                            <strong>Totalt {events.length} unike hendelser</strong> funnet med totalt {events.reduce((acc, event) => acc + event.parameters.length, 0)} parametere.
                            {searchTerm && (
                              <> Viser {filteredEvents.length} hendelser som matcher søket.</>
                            )}
                          </BodyShort>
                          <BodyShort size="small" className="text-gray-600 mt-2">
                            * Viser data for de siste {daysToShow} dagene {maxDaysAvailable > 0 && `(maks ${maxDaysAvailable} dager tilgjengelig)`}
                          </BodyShort>
                        </div>
                        <div className="flex items-center gap-2">
                          <TextField
                            label="Antall dager"
                            type="number"
                            size="small"
                            value={daysToShow}
                            onChange={(e) => handleDaysChange(e.target.value)}
                            min={1}
                            max={maxDaysAvailable}
                            className="w-24"
                            icon={<Calendar aria-hidden />}
                          />
                        </div>
                      </div>
                    </div>
                    
                    <Accordion>
                      {filteredEvents.map((event) => (
                        <Accordion.Item key={event.name}>
                          <Accordion.Header>
                            <div className="flex justify-between items-center w-full pr-4">
                              <span className="font-medium">{event.name}</span>
                              <div className="flex items-center gap-2">
                                <Tag size="small" variant="info">
                                  {event.parameters.length} {event.parameters.length === 1 ? 'parameter' : 'parametere'}
                                </Tag>
                                <Tag size="small" variant="success">
                                  {event.count.toLocaleString()} forekomster
                                </Tag>
                              </div>
                            </div>
                          </Accordion.Header>
                          <Accordion.Content>
                            {event.parameters.length > 0 ? (
                              <div className="space-y-3">
                                <BodyShort>Tilgjengelige parametere for denne hendelsen:</BodyShort>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                  {event.parameters
                                    .sort((a, b) => b.count - a.count)
                                    .map((param) => (
                                      <div 
                                        key={param.name}
                                        className="bg-gray-50 p-3 rounded-md flex justify-between items-center"
                                      >
                                        <div className="font-mono text-sm">{param.name}</div>
                                        <Tag variant="info" size="small">
                                          {param.count.toLocaleString()} forekomster
                                        </Tag>
                                      </div>
                                    ))}
                                </div>
                              </div>
                            ) : (
                              <Panel>
                                Denne hendelsen har ingen ytterligere parametere.
                              </Panel>
                            )}
                            
                            <div className="mt-4 border-t pt-4">
                              <BodyShort>
                                Du kan bruke disse verdiene i grafbyggeren ved å:
                              </BodyShort>
                              <ol className="list-decimal list-inside mt-2 text-sm text-gray-700 space-y-1">
                                <li>Filtrere på <code>event_name = '{event.name}'</code></li>
                                {event.parameters.length > 0 && (
                                  <li>
                                    Legge til parametere som egendefinerte parametere (
                                    {event.parameters.map((p, i) => (
                                      <span key={p.name}>
                                        {i > 0 && ", "}<code>{p.name}</code>
                                      </span>
                                    ))}
                                    )
                                  </li>
                                )}
                              </ol>
                            </div>
                          </Accordion.Content>
                        </Accordion.Item>
                      ))}
                    </Accordion>
                  </div>
                ) : (
                  <Panel>
                    Ingen hendelser funnet. Dette kan bety at det ikke er samlet inn data for denne nettsiden ennå.
                  </Panel>
                )
              )}
            </>
          )}
        </div>
      )}

      <div className="mt-8">
        <Kontaktboks />
      </div>
    </div>
  );
};

export default ExploreEvents;

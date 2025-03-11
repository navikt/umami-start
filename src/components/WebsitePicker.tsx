import { useState, useEffect, useRef, ChangeEvent, useCallback } from 'react';
import { UNSAFE_Combobox, Button, ReadMore, TextField, Loader } from '@navikt/ds-react';
import AlertWithCloseButton from './chartbuilder/AlertWithCloseButton';

interface Website {
  id: string;
  name: string;
  domain: string;
  teamId: string;
}

interface WebsitePickerProps {
  selectedWebsite: Website | null;
  onWebsiteChange: (website: Website | null) => void;
  onEventsLoad?: (events: string[], autoParameters?: { key: string; type: 'string' }[]) => void;
}

interface EventProperty {
  eventName: string;
  propertyName: string;
  total: number;
  type?: 'string' | 'number';
}

// Cache for API responses
interface ApiCache {
  [websiteId: string]: {
    dateRange?: { mindate: string; maxdate: string };
    properties?: EventProperty[];
  }
}

interface WebsiteApiResponse {
  data: Website[];
}

const WebsitePicker = ({ selectedWebsite, onWebsiteChange, onEventsLoad }: WebsitePickerProps) => {
  const [websites, setWebsites] = useState<Website[]>([]);
  const [loadedWebsiteId, setLoadedWebsiteId] = useState<string | null>(null);
  const [maxDaysAvailable, setMaxDaysAvailable] = useState<number>(30);
  const [dateRangeInDays, setDateRangeInDays] = useState<number>(3); // Changed from 7 to 3
  const [tempDateRangeInDays, setTempDateRangeInDays] = useState<number>(3); // Changed from 7 to 3
  const apiCache = useRef<ApiCache>({});
  const fetchInProgress = useRef<{[key: string]: boolean}>({});
  const websitesLoaded = useRef<boolean>(false); // New flag to prevent repeated fetching
  const [dateChanged, setDateChanged] = useState(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  // @ts-ignore
  const [isInitialLoading, setIsInitialLoading] = useState<boolean>(true);

  // @ts-ignore
  const fetchEventNames = useCallback(async (websiteId: string, forceFresh = false) => {
    if (fetchInProgress.current[websiteId]) return;
    
    fetchInProgress.current[websiteId] = true;
    setIsLoading(true); // Set loading state when fetching starts
    
    try {
      const baseUrl = window.location.hostname === 'localhost' 
        ? 'https://reops-proxy.intern.nav.no' 
        : 'https://reops-proxy.ansatt.nav.no';

      // Always get fresh date range
      const dateRangeResponse = await fetch(`${baseUrl}/umami/api/websites/${websiteId}/daterange`, {
        credentials: window.location.hostname === 'localhost' ? 'omit' : 'include'
      });
      const dateRange = await dateRangeResponse.json();
      
      // Calculate max available days
      const endDate = new Date(dateRange.maxdate);
      const startDate = new Date(dateRange.mindate);
      const totalDays = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      setMaxDaysAvailable(totalDays);

      // Always get fresh properties when date range changes
      const calculatedEndDate = new Date(dateRange.maxdate);
      const calculatedStartDate = new Date(calculatedEndDate);
      calculatedStartDate.setDate(calculatedStartDate.getDate() - dateRangeInDays);
      
      const startAt = calculatedStartDate.getTime();
      const endAt = calculatedEndDate.getTime();
      
      const propertiesResponse = await fetch(
        `${baseUrl}/umami/api/websites/${websiteId}/event-data/properties?startAt=${startAt}&endAt=${endAt}&unit=hour&timezone=Europe%2FOslo`,
        { credentials: window.location.hostname === 'localhost' ? 'omit' : 'include' }
      );
      const properties: EventProperty[] = await propertiesResponse.json();
      
      // Process events and parameters
      const eventMap = new Map<string, string[]>();
      properties.forEach(prop => {
        if (!eventMap.has(prop.eventName)) {
          eventMap.set(prop.eventName, []);
        }
        if (!eventMap.get(prop.eventName)!.includes(prop.propertyName)) {
          eventMap.get(prop.eventName)!.push(prop.propertyName);
        }
      });
      
      const uniqueEventNames = Array.from(eventMap.keys());
      const paramsByEvent: {key: string, type: 'string'}[] = [];
      eventMap.forEach((props, eventName) => {
        props.forEach(prop => {
          paramsByEvent.push({
            key: `${eventName}.${prop}`,
            type: 'string'
          });
        });
      });
      
      if (onEventsLoad) {
        onEventsLoad(uniqueEventNames, paramsByEvent);
      }
    } catch (error) {
      console.error("Error fetching event data:", error);
    } finally {
      fetchInProgress.current[websiteId] = false;
      setIsLoading(false); // Clear loading state when done
    }
  }, [dateRangeInDays, onEventsLoad, setMaxDaysAvailable]);

  useEffect(() => {
    if (websitesLoaded.current) {
      setIsInitialLoading(false);
      return;
    }
    
    setIsInitialLoading(true); // Show loading state for initial load

    const baseUrl = window.location.hostname === 'localhost' 
      ? 'https://reops-proxy.intern.nav.no' 
      : 'https://reops-proxy.ansatt.nav.no';

    // Only fetch websites list once
    Promise.all([
      fetch(`${baseUrl}/umami/api/teams/aa113c34-e213-4ed6-a4f0-0aea8a503e6b/websites`, {
        credentials: window.location.hostname === 'localhost' ? 'omit' : 'include'
      }).then(response => response.json() as Promise<WebsiteApiResponse>),
      fetch(`${baseUrl}/umami/api/teams/bceb3300-a2fb-4f73-8cec-7e3673072b30/websites`, {
        credentials: window.location.hostname === 'localhost' ? 'omit' : 'include'
      }).then(response => response.json() as Promise<WebsiteApiResponse>)
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
        websitesLoaded.current = true; // Mark as loaded
        setIsInitialLoading(false); // Clear initial loading
      })
      .catch(error => {
        console.error("Error fetching websites:", error);
        setIsInitialLoading(false); // Clear loading even on error
      });
  }, []);

  // Fetch events when a website is selected
  useEffect(() => {
    if (selectedWebsite && selectedWebsite.id !== loadedWebsiteId && onEventsLoad) {
      // Clear cache when website changes
      apiCache.current = {};
      fetchEventNames(selectedWebsite.id, true)
        .finally(() => {
          setLoadedWebsiteId(selectedWebsite.id);
        });
    }
  }, [selectedWebsite?.id, loadedWebsiteId, onEventsLoad, fetchEventNames]);

  // Wrap handleDateRangeChange in useCallback
  const handleDateRangeChange = useCallback(() => {
    if (tempDateRangeInDays < 1) {
      setTempDateRangeInDays(1);
      setDateRangeInDays(1);
    } else if (tempDateRangeInDays > maxDaysAvailable && maxDaysAvailable > 0) {
      setTempDateRangeInDays(maxDaysAvailable);
      setDateRangeInDays(maxDaysAvailable);
    } else {
      setDateRangeInDays(tempDateRangeInDays);
    }

    // If we have a selected website, refresh the data with the new date range
    if (selectedWebsite) {
      // Clear cache and fetch fresh data when changing days
      apiCache.current[selectedWebsite.id] = {};
      fetchEventNames(selectedWebsite.id, true);
      setDateChanged(true); // Set dateChanged to true after updating
    }
  }, [tempDateRangeInDays, maxDaysAvailable, selectedWebsite, fetchEventNames, setDateRangeInDays, setTempDateRangeInDays]);

  return (
    <div className="space-y-4">
        <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
          <UNSAFE_Combobox
            label="Nettside / app"
            options={websites.map(website => ({
              label: website.name,
              value: website.name,
              website: website
            }))}
            selectedOptions={selectedWebsite ? [selectedWebsite.name] : []}
            onToggleSelected={(option: string, isSelected: boolean) => {
              if (isSelected) {
                const website = websites.find(w => w.name === option);
                onWebsiteChange(website || null);
              } else {
                onWebsiteChange(null);
              }
            }}
            clearButton
          />
          
          {selectedWebsite && (
            <div className="mt-4">
              <ReadMore header="Innstillinger for hendelsesinnlasting">
                
                <div className="space-y-4 mt-2">
                  <div className="text-sm">
                    Velg tidsperiode for å se tilgjengelige hendelser og detaljer.
                    {maxDaysAvailable > 0 && 
                      ` Data er tilgjengelig for de siste ${maxDaysAvailable} dagene.`
                    }
                  </div>
                  
                  <div className="flex items-end gap-2">
                    <TextField
                      label="Antall dager"
                      type="number"
                      size="small"
                      value={tempDateRangeInDays}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => {
                        const val = parseInt(e.target.value, 10);
                        setTempDateRangeInDays(isNaN(val) ? 1 : val);
                      }}
                      min={1}
                      max={maxDaysAvailable}
                      className="w-24"
                    />
                    <Button
                      variant="secondary"
                      size="small"
                      onClick={handleDateRangeChange}
                      className="h-[33px]"
                    >
                      Oppdater
                    </Button>
                  </div>
                  
                  {dateChanged && !isLoading && (
                    <AlertWithCloseButton variant="success">
                      Tilgjengelige hendelser og parametere ble lastet inn
                    </AlertWithCloseButton>
                  )}
                  
                  <div className="text-sm text-gray-600">
                    Viser tilgjengelige hendelser for de siste {dateRangeInDays} dagene
                  </div>
                </div>
              </ReadMore>
            </div>
          )}
        </div>
        {isLoading && (
                    <div className="flex items-center gap-2 my-2">
                      <Loader size="small" /> 
                      <span>Laster inn hendelser og detaljer...</span>
                    </div>
                  )}
    </div>
  );
};

export default WebsitePicker;

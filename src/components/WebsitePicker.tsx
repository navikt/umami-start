import { useState, useEffect, useRef, useCallback } from 'react';
import { UNSAFE_Combobox, Alert, ProgressBar } from '@navikt/ds-react';

interface Website {
  id: string;
  name: string;
  domain: string;
  teamId: string;
}

interface WebsitePickerProps {
  selectedWebsite: Website | null;
  onWebsiteChange: (website: Website | null) => void;
  onEventsLoad?: (events: string[], autoParameters?: { key: string; type: 'string' }[], maxDays?: number) => void;
  dateRangeInDays?: number; // Add this prop to accept date range from parent
  shouldReload?: boolean;   // Add flag to force reload
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

const API_TIMEOUT_MS = 120000; // timeout

const timeoutPromise = (ms: number) => {
  return new Promise((_, reject) => {
    setTimeout(() => {
      reject(new Error(`Request timed out after ${ms}ms`));
    }, ms);
  });
};

const WebsitePicker = ({ 
  selectedWebsite, 
  onWebsiteChange, 
  onEventsLoad,
  dateRangeInDays: externalDateRange, 
  shouldReload = false                
}: WebsitePickerProps) => {
  const [websites, setWebsites] = useState<Website[]>([]);
  const [loadedWebsiteId, setLoadedWebsiteId] = useState<string | null>(null);
  const [setMaxDaysAvailable] = useState<number>(30);
  const [dateRangeInDays, setDateRangeInDays] = useState<number>(externalDateRange || 1);
  const apiCache = useRef<ApiCache>({});
  const fetchInProgress = useRef<{[key: string]: boolean}>({});
  const websitesLoaded = useRef<boolean>(false);
  const prevExternalDateRange = useRef<number>(externalDateRange || 1);
  const prevShouldReload = useRef<boolean>(shouldReload);
  const initialUrlChecked = useRef<boolean>(false);

  // @ts-ignore
  const [isInitialLoading, setIsInitialLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [showLoading, setShowLoading] = useState<boolean>(false);
  const loadingTimerRef = useRef<number | null>(null);

  // Function to update URL with website ID
  const updateUrlWithWebsiteId = useCallback((website: Website | null) => {
    const url = new URL(window.location.href);
    
    if (website && website.id) {
      url.searchParams.set('websiteId', website.id);
    } else {
      url.searchParams.delete('websiteId');
    }
    
    // Update URL without full page reload
    window.history.pushState({}, '', url.toString());
  }, []);

  // Handle website selection and update URL
  const handleWebsiteChange = useCallback((website: Website | null) => {
    onWebsiteChange(website);
    updateUrlWithWebsiteId(website);
  }, [onWebsiteChange, updateUrlWithWebsiteId]);

  // Check for website ID in URL on initial load
  useEffect(() => {
    if (websitesLoaded.current && !initialUrlChecked.current && websites.length > 0) {
      const urlParams = new URLSearchParams(window.location.search);
      const websiteIdFromUrl = urlParams.get('websiteId');
      
      if (websiteIdFromUrl) {
        const website = websites.find(w => w.id === websiteIdFromUrl);
        if (website && !selectedWebsite) {
          onWebsiteChange(website);
        }
      }
      
      initialUrlChecked.current = true;
    }
  }, [websites, selectedWebsite, onWebsiteChange]);

  // Handle browser back/forward navigation
  useEffect(() => {
    const handlePopState = () => {
      if (websitesLoaded.current) {
        const urlParams = new URLSearchParams(window.location.search);
        const websiteIdFromUrl = urlParams.get('websiteId');
        
        if (websiteIdFromUrl) {
          const website = websites.find(w => w.id === websiteIdFromUrl);
          if (website && (!selectedWebsite || website.id !== selectedWebsite.id)) {
            onWebsiteChange(website);
          }
        } else if (selectedWebsite) {
          // No website ID in URL, but we have a selected website, clear it
          onWebsiteChange(null);
        }
      }
    };
    
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [websites, selectedWebsite, onWebsiteChange]);

  const handleLoadingState = useCallback((loading: boolean) => {
    if (loading) {
      loadingTimerRef.current = window.setTimeout(() => {
        setShowLoading(true);
      }, 600);
    } else {
      // Clear both loading states
      setShowLoading(false);
      
      // Clear any pending timers
      if (loadingTimerRef.current) {
        window.clearTimeout(loadingTimerRef.current);
        loadingTimerRef.current = null;
      }
    }
  }, []); // Remove showLoading dependency since we handle it directly

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (loadingTimerRef.current) {
        window.clearTimeout(loadingTimerRef.current);
      }
    };
  }, []);

  // @ts-ignore
  const fetchEventNames = useCallback(async (websiteId: string, forceFresh = false, daysToFetch = dateRangeInDays) => {
    if (fetchInProgress.current[websiteId]) return;
    
    fetchInProgress.current[websiteId] = true;
    setError(null); // Clear any previous errors
    
    try {
      // Show loading UI
      handleLoadingState(true);
      
      // Use local API endpoint that queries BigQuery
      const apiBase = '/api/bigquery';

      // Add timeout to date range fetch
      const dateRangeResponse = await Promise.race([
        fetch(`${apiBase}/websites/${websiteId}/daterange`),
        timeoutPromise(API_TIMEOUT_MS)
      ]);
      // @ts-ignore
      const dateRange = await dateRangeResponse.json();
      
      // Calculate max available days
      const endDate = new Date(dateRange.maxdate);
      const startDate = new Date(dateRange.mindate);
      const totalDays = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

      // Use the daysToFetch parameter instead of the state variable
      const calculatedEndDate = new Date(dateRange.maxdate);
      const calculatedStartDate = new Date(calculatedEndDate);
      calculatedStartDate.setDate(calculatedStartDate.getDate() - daysToFetch);
      
      const startAt = calculatedStartDate.getTime();
      const endAt = calculatedEndDate.getTime();
      
      console.log(`Fetching data for ${daysToFetch} days from ${new Date(startAt).toLocaleDateString()} to ${new Date(endAt).toLocaleDateString()}`);
      
      // Add timeout to properties fetch
      const propertiesResponse = await Promise.race([
        fetch(`${apiBase}/websites/${websiteId}/event-properties?startAt=${startAt}&endAt=${endAt}`),
        timeoutPromise(API_TIMEOUT_MS)
      ]);// @ts-ignore
      const properties: EventProperty[] = await propertiesResponse.json();
      
      console.log(`Fetched ${properties.length} properties from the API`);
      
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
      
      console.log(`[API Source] Found ${uniqueEventNames.length} unique events and ${paramsByEvent.length} parameters`);
      
      if (onEventsLoad) {
        onEventsLoad(uniqueEventNames, paramsByEvent, totalDays);
      }
      
      // Move loading cleanup here after all processing is done
      handleLoadingState(false);
      
    } catch (error) {
      console.error("Error fetching event data:", error);
      if (error instanceof Error) {
        const message = error.message.includes('timed out')
          ? 'Forespørselen tok for lang tid. Prøv igjen senere.'
          : 'Det oppstod en feil ved lasting av data. Forsøk å laste siden inn på nytt.';
        setError(message);
      }
      handleLoadingState(false);
    } finally {
      fetchInProgress.current[websiteId] = false;
    }
  }, [onEventsLoad, setMaxDaysAvailable, handleLoadingState]);

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
    if (selectedWebsite && selectedWebsite.id !== loadedWebsiteId) {
      // Clear cache when website changes
      apiCache.current = {};
      
      fetchEventNames(selectedWebsite.id, false, dateRangeInDays)
        .finally(() => {
          setLoadedWebsiteId(selectedWebsite.id);
        });
    }
  }, [selectedWebsite?.id, loadedWebsiteId, onEventsLoad, fetchEventNames, dateRangeInDays]);

  // Combine the reload effects to avoid loops
  useEffect(() => {
    // Only proceed if we have a selected website
    if (!selectedWebsite) return;
    
    const dateRangeChanged = externalDateRange !== prevExternalDateRange.current;
    const reloadFlagChanged = shouldReload !== prevShouldReload.current;
    
    // Update the refs to track current values
    prevExternalDateRange.current = externalDateRange || 3;
    prevShouldReload.current = shouldReload;
    
    // Only reload if something actually changed
    if (dateRangeChanged || reloadFlagChanged) {
      console.log(`Reload triggered - dateRange: ${dateRangeChanged}, reloadFlag: ${reloadFlagChanged}`);
      
      if (dateRangeChanged) {
        // Update the internal state
        setDateRangeInDays(externalDateRange || 3);
      }
      
      // Clear cache and force a fresh fetch
      apiCache.current[selectedWebsite.id] = {};
      
      // Always use API data when explicitly reloading
      fetchEventNames(selectedWebsite.id, true, externalDateRange || dateRangeInDays);
    }
  }, [externalDateRange, shouldReload, selectedWebsite, fetchEventNames, dateRangeInDays]);


  return (
    <div className="space-y-4">
        <div className="space-y-4 p-4 bg-gray-50 rounded-lg border shadow-sm ">
          {error && (
            <Alert variant="error" className="mb-4">
              {error}
            </Alert>
          )}
          <UNSAFE_Combobox
            label={selectedWebsite ? "Nettside eller app" : "Velg nettside eller app"}
            options={websites.map(website => ({
              label: website.name,
              value: website.name,
              website: website
            }))}
            selectedOptions={selectedWebsite ? [selectedWebsite.name] : []}
            onToggleSelected={(option: string, isSelected: boolean) => {
              if (isSelected) {
                const website = websites.find(w => w.name === option);
                handleWebsiteChange(website || null); // Use the new handler
              } else {
                handleWebsiteChange(null); // Use the new handler
              }
            }}
            clearButton
          />
        </div>
        {showLoading && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span>Laster inn hendelser og detaljer...</span>
            </div>
            <ProgressBar 
              size="small"
              simulated={{
                seconds: 10,
                 onTimeout: () => {}
              }}
              aria-label="Laster inn data"
            />
          </div>
        )}
    </div>
  );
};

export default WebsitePicker;

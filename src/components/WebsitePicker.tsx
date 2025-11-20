import { useState, useEffect, useRef, useCallback } from 'react';
import { UNSAFE_Combobox, Alert, ProgressBar, Button } from '@navikt/ds-react';

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
  onIncludeParamsChange?: (includeParams: boolean) => void; // Callback to notify parent of includeParams state
  resetIncludeParams?: boolean; // Add flag to reset includeParams
  requestIncludeParams?: boolean; // Add flag to request loading params
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
  shouldReload = false,
  onIncludeParamsChange,
  resetIncludeParams = false,
  requestIncludeParams = false
}: WebsitePickerProps) => {
  const [websites, setWebsites] = useState<Website[]>([]);
  const [loadedWebsiteId, setLoadedWebsiteId] = useState<string | null>(null);
  const [setMaxDaysAvailable] = useState<number>(30);
  const [dateRangeInDays, setDateRangeInDays] = useState<number>(externalDateRange || 14);
  const apiCache = useRef<ApiCache>({});
  const fetchInProgress = useRef<{ [key: string]: boolean }>({});
  const websitesLoaded = useRef<boolean>(false);
  const prevExternalDateRange = useRef<number>(externalDateRange || 14);
  const prevShouldReload = useRef<boolean>(shouldReload);
  const initialUrlChecked = useRef<boolean>(false);

  // @ts-ignore
  const [isInitialLoading, setIsInitialLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [showLoading, setShowLoading] = useState<boolean>(false);
  const loadingTimerRef = useRef<number | null>(null);
  const [gbProcessed, setGbProcessed] = useState<string | null>(null);
  const [estimatedGbProcessed, setEstimatedGbProcessed] = useState<string | null>(null);
  const [includeParams, setIncludeParams] = useState<boolean>(false);
  const prevIncludeParams = useRef<boolean>(false);

  // Reset includeParams when resetIncludeParams prop changes
  useEffect(() => {
    if (resetIncludeParams) {
      setIncludeParams(false);
    }
  }, [resetIncludeParams]);

  // Set includeParams when requestIncludeParams prop changes to true
  useEffect(() => {
    if (requestIncludeParams && !includeParams) {
      setIncludeParams(true);
    }
  }, [requestIncludeParams, includeParams]);

  // Notify parent when includeParams changes
  useEffect(() => {
    if (onIncludeParamsChange) {
      onIncludeParamsChange(includeParams);
    }
  }, [includeParams, onIncludeParamsChange]);

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
    // Reset to cheap query when switching websites
    setIncludeParams(false);
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
    setGbProcessed(null); // Clear previous GB count
    setEstimatedGbProcessed(null); // Clear previous estimated GB

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

      // Fetch BOTH query types to get both estimates
      const propertiesResponse = await Promise.race([
        fetch(`${apiBase}/websites/${websiteId}/event-properties?startAt=${startAt}&endAt=${endAt}&includeParams=${includeParams}`),
        timeoutPromise(API_TIMEOUT_MS)
      ]);// @ts-ignore
      const responseData = await propertiesResponse.json();

      console.log('API Response:', responseData);

      // Extract properties and GB processed from response
      const properties: EventProperty[] = responseData.properties || [];
      const gbProcessedValue = responseData.gbProcessed;
      const estimatedGbValue = responseData.estimatedGbProcessed;

      if (gbProcessedValue) {
        setGbProcessed(gbProcessedValue);
      }

      if (estimatedGbValue) {
        setEstimatedGbProcessed(estimatedGbValue);
      }

      console.log(`Fetched ${properties.length} event entries from the API, estimated ${estimatedGbValue} GB, actual ${gbProcessedValue} GB`);

      // Process events and parameters
      const eventMap = new Map<string, string[]>();
      properties.forEach(prop => {
        if (!eventMap.has(prop.eventName)) {
          eventMap.set(prop.eventName, []);
        }
        // Only add property name if it exists (when includeParams=true)
        if (prop.propertyName && !eventMap.get(prop.eventName)!.includes(prop.propertyName)) {
          eventMap.get(prop.eventName)!.push(prop.propertyName);
        }
      });

      const uniqueEventNames = Array.from(eventMap.keys());
      const paramsByEvent: { key: string, type: 'string' }[] = [];
      eventMap.forEach((props, eventName) => {
        props.forEach(prop => {
          paramsByEvent.push({
            key: `${eventName}.${prop}`,
            type: 'string'
          });
        });
      });

      console.log(`Found ${uniqueEventNames.length} unique events and ${paramsByEvent.length} parameters`);


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
  }, [onEventsLoad, setMaxDaysAvailable, handleLoadingState, includeParams]);

  useEffect(() => {
    if (websitesLoaded.current) {
      setIsInitialLoading(false);
      return;
    }

    setIsInitialLoading(true); // Show loading state for initial load

    const baseUrl = ''; // Use relative path for local API

    // Only fetch websites list once
    fetch(`${baseUrl}/api/bigquery/websites`)
      .then(response => response.json() as Promise<WebsiteApiResponse>)
      .then((response) => {
        const websitesData = response.data || [];
        // Deduplicate by name to avoid key collisions in Combobox
        const uniqueWebsites = websitesData.filter((website: Website, index: number, self: Website[]) =>
          index === self.findIndex((w) => w.name === website.name)
        );
        setWebsites(uniqueWebsites);
        websitesLoaded.current = true; // Mark as loaded
        setIsInitialLoading(false); // Clear initial loading
      })
      .catch(error => {
        console.error("Error fetching websites:", error);
        setIsInitialLoading(false); // Clear loading even on error
      });
  }, []);

  // Fetch events when a website is selected (only if onEventsLoad callback is provided)
  useEffect(() => {
    if (selectedWebsite && selectedWebsite.id !== loadedWebsiteId && onEventsLoad) {
      // Clear cache when website changes
      apiCache.current = {};

      fetchEventNames(selectedWebsite.id, false, dateRangeInDays)
        .finally(() => {
          setLoadedWebsiteId(selectedWebsite.id);
        });
    } else if (!selectedWebsite && loadedWebsiteId) {
      // Clear loadedWebsiteId when website is deselected/reset
      setLoadedWebsiteId(null);
    }
  }, [selectedWebsite?.id, loadedWebsiteId, onEventsLoad, fetchEventNames, dateRangeInDays]);

  // Reload when includeParams changes (only if onEventsLoad callback is provided)
  useEffect(() => {
    if (selectedWebsite && loadedWebsiteId === selectedWebsite.id && includeParams !== prevIncludeParams.current && onEventsLoad) {
      prevIncludeParams.current = includeParams;
      apiCache.current[selectedWebsite.id] = {};
      fetchEventNames(selectedWebsite.id, true, dateRangeInDays);
    }
  }, [includeParams, selectedWebsite, loadedWebsiteId, fetchEventNames, dateRangeInDays, onEventsLoad]);



  // Combine the reload effects to avoid loops (only if onEventsLoad callback is provided)
  useEffect(() => {
    // Only proceed if we have a selected website and onEventsLoad callback
    if (!selectedWebsite || !onEventsLoad) return;

    const dateRangeChanged = externalDateRange !== prevExternalDateRange.current;
    const reloadFlagChanged = shouldReload !== prevShouldReload.current;

    // Update the refs to track current values
    prevExternalDateRange.current = externalDateRange || 14;
    prevShouldReload.current = shouldReload;

    // Only reload if something actually changed
    if (dateRangeChanged || reloadFlagChanged) {
      console.log(`Reload triggered - dateRange: ${dateRangeChanged}, reloadFlag: ${reloadFlagChanged}`);

      if (dateRangeChanged) {
        // Update the internal state
        setDateRangeInDays(externalDateRange || 14);
      }

      // Clear cache and force a fresh fetch
      apiCache.current[selectedWebsite.id] = {};

      // Always use API data when explicitly reloading
      fetchEventNames(selectedWebsite.id, true, externalDateRange || dateRangeInDays);
    }
  }, [externalDateRange, shouldReload, selectedWebsite, fetchEventNames, dateRangeInDays, onEventsLoad]);


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
        {!selectedWebsite && (
          <div className="flex items-center gap-2 mt-2">
            <span className="text-sm">Hurtigvalg:</span>
            <Button
              size="xsmall"
              variant="secondary"
              onClick={() => {
                const website = websites.find(w => w.id === '35abb2b7-3f97-42ce-931b-cf547d40d967');
                if (website) {
                  handleWebsiteChange(website);
                }
              }}
            >
              nav.no
            </Button>
          </div>
        )}

        {selectedWebsite && includeParams && (
          <div className="mt-4 p-3 bg-green-50 rounded border border-green-200">
            <div className="text-sm text-gray-700">
              Hentet hendelser med hendelsesdetaljer for siste {dateRangeInDays} {dateRangeInDays === 1 ? 'dag' : 'dager'}.
            </div>
          </div>
        )}
      </div>
      {showLoading && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span>Laster inn hendelser...</span>
            {estimatedGbProcessed && (
              <span className="text-sm text-gray-600">(estimert {estimatedGbProcessed} GB)</span>
            )}
            {gbProcessed && (
              <span className="text-sm text-gray-600">(faktisk {gbProcessed} GB)</span>
            )}
          </div>
          <ProgressBar
            size="small"
            simulated={{
              seconds: 10,
              onTimeout: () => { }
            }}
            aria-label="Laster inn data"
          />
        </div>
      )}
    </div>
  );
};

export default WebsitePicker;
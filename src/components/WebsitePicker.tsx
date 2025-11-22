import { useState, useEffect, useRef, useCallback } from 'react';
import { UNSAFE_Combobox, Alert, ProgressBar, Button } from '@navikt/ds-react';
import { PadlockLockedIcon } from '@navikt/aksel-icons';

interface Website {
  id: string;
  name: string;
  domain: string;
  teamId: string;
  createdAt: string;
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
    properties?: EventProperty[];
  }
}

interface WebsiteApiResponse {
  data: Website[];
}

const API_TIMEOUT_MS = 120000; // timeout
const CACHE_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours
const WEBSITES_CACHE_KEY = 'umami_websites_cache';
const SELECTED_WEBSITE_CACHE_KEY = 'umami_selected_website';

// LocalStorage helper functions
const saveToLocalStorage = (key: string, data: any) => {
  try {
    const item = {
      data,
      timestamp: Date.now()
    };
    localStorage.setItem(key, JSON.stringify(item));
  } catch (error) {
    console.error('Error saving to localStorage:', error);
  }
};

const getFromLocalStorage = <T,>(key: string, maxAgeMs: number = CACHE_EXPIRY_MS): T | null => {
  try {
    const itemStr = localStorage.getItem(key);
    if (!itemStr) return null;

    const item = JSON.parse(itemStr);
    const now = Date.now();

    // Check if cache has expired
    if (now - item.timestamp > maxAgeMs) {
      localStorage.removeItem(key);
      return null;
    }

    return item.data as T;
  } catch (error) {
    console.error('Error reading from localStorage:', error);
    return null;
  }
};

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

    // Save/clear selected website in localStorage
    if (website) {
      saveToLocalStorage(SELECTED_WEBSITE_CACHE_KEY, website);
    } else {
      localStorage.removeItem(SELECTED_WEBSITE_CACHE_KEY);
    }

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
          handleWebsiteChange(website); // Use handleWebsiteChange to ensure caching
          setShowPicker(false); // Hide picker to display locked view
        }
      }

      initialUrlChecked.current = true;
    }
  }, [websites, selectedWebsite, handleWebsiteChange]);

  // Handle browser back/forward navigation
  useEffect(() => {
    const handlePopState = () => {
      if (websitesLoaded.current) {
        const urlParams = new URLSearchParams(window.location.search);
        const websiteIdFromUrl = urlParams.get('websiteId');

        if (websiteIdFromUrl) {
          const website = websites.find(w => w.id === websiteIdFromUrl);
          if (website && (!selectedWebsite || website.id !== selectedWebsite.id)) {
            // Note: We call onWebsiteChange here instead of handleWebsiteChange
            // because handleWebsiteChange would update the URL again via pushState,
            // which we don't want during popstate (back/forward navigation)
            onWebsiteChange(website);
            // But we still need to save to localStorage
            saveToLocalStorage(SELECTED_WEBSITE_CACHE_KEY, website);
          }
        } else if (selectedWebsite) {
          // No website ID in URL, but we have a selected website, clear it
          onWebsiteChange(null);
          localStorage.removeItem(SELECTED_WEBSITE_CACHE_KEY);
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
  // @ts-ignore
  const fetchEventNames = useCallback(async (website: Website, forceFresh = false, daysToFetch = dateRangeInDays) => {
    const websiteId = website.id;
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

      // Calculate max available days using website creation date
      const endDate = new Date();
      const startDate = website.createdAt ? new Date(website.createdAt) : new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);

      // Calculate difference in milliseconds
      const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
      // Convert to days and round up to include partial days
      let totalDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      // Ensure totalDays is valid and at least 1
      if (isNaN(totalDays) || totalDays < 1) {
        totalDays = 1;
      }

      // Use the daysToFetch parameter instead of the state variable
      const calculatedEndDate = new Date();
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

  // State to control whether to show the picker
  const [showPicker, setShowPicker] = useState<boolean>(false);

  // Load websites only when showPicker is true
  useEffect(() => {
    if (!showPicker || websitesLoaded.current) {
      return;
    }

    setIsInitialLoading(true);

    // Try to load websites from cache first
    const cachedWebsites = getFromLocalStorage<Website[]>(WEBSITES_CACHE_KEY);

    if (cachedWebsites && cachedWebsites.length > 0) {
      console.log('Using cached websites list');
      setWebsites(cachedWebsites);
      websitesLoaded.current = true;
      setIsInitialLoading(false);
      return;
    }

    // If no cache, fetch from API
    const baseUrl = '';

    fetch(`${baseUrl}/api/bigquery/websites`)
      .then(response => response.json() as Promise<WebsiteApiResponse>)
      .then((response) => {
        const websitesData = response.data || [];
        const uniqueWebsites = websitesData.filter((website: Website, index: number, self: Website[]) =>
          index === self.findIndex((w) => w.name === website.name)
        );
        setWebsites(uniqueWebsites);
        saveToLocalStorage(WEBSITES_CACHE_KEY, uniqueWebsites);
        websitesLoaded.current = true;
        setIsInitialLoading(false);
      })
      .catch(error => {
        console.error("Error fetching websites:", error);
        setIsInitialLoading(false);
      });
  }, [showPicker]);

  // On mount, try to restore from localStorage
  useEffect(() => {
    if (initialUrlChecked.current) return;

    const urlParams = new URLSearchParams(window.location.search);
    const websiteIdFromUrl = urlParams.get('websiteId');

    // Priority 1: URL parameter (need to load websites to find it)
    if (websiteIdFromUrl) {
      setShowPicker(true); // This will trigger website loading
      initialUrlChecked.current = true;
      return;
    }

    // Priority 2: localStorage cache
    const cachedWebsite = getFromLocalStorage<Website>(SELECTED_WEBSITE_CACHE_KEY);
    if (cachedWebsite && !selectedWebsite) {
      console.log('[WebsitePicker] Restoring from localStorage:', cachedWebsite.name);
      handleWebsiteChange(cachedWebsite); // Use handleWebsiteChange to ensure URL is updated
    }

    initialUrlChecked.current = true;
  }, [selectedWebsite, handleWebsiteChange]);

  // Check for website ID in URL after websites are loaded
  useEffect(() => {
    if (!websitesLoaded.current || websites.length === 0) return;

    const urlParams = new URLSearchParams(window.location.search);
    const websiteIdFromUrl = urlParams.get('websiteId');

    if (websiteIdFromUrl) {
      const website = websites.find(w => w.id === websiteIdFromUrl);
      if (website) {
        console.log('[WebsitePicker] Applying website from URL:', website.name);
        handleWebsiteChange(website);
        setShowPicker(false);
      }
    }
  }, [websites, handleWebsiteChange]);

  // Fetch events when a website is selected (only if onEventsLoad callback is provided)
  useEffect(() => {
    if (selectedWebsite && selectedWebsite.id !== loadedWebsiteId && onEventsLoad) {
      // Clear cache when website changes
      apiCache.current = {};

      fetchEventNames(selectedWebsite, false, dateRangeInDays)
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
      fetchEventNames(selectedWebsite, true, dateRangeInDays);
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
      fetchEventNames(selectedWebsite, true, externalDateRange || dateRangeInDays);
    }
  }, [externalDateRange, shouldReload, selectedWebsite, fetchEventNames, dateRangeInDays, onEventsLoad]);


  return (
    <div className="space-y-4">
      <div className="space-y-4 p-4 bg-gray-50 rounded-lg border shadow-sm">
        {error && (
          <Alert variant="error" className="mb-4">
            {error}
          </Alert>
        )}

        {/* Show selected website with change button */}
        {selectedWebsite && !showPicker ? (
          <div>
            <label className="navds-label navds-label--medium mb-2 block">Nettside eller app</label>
            <div className="bg-white border border-gray-300 border-l-4 border-l-blue-600 p-2 rounded mb-3">
              <div className="flex items-center gap-2">
                <PadlockLockedIcon className="text-blue-600" aria-hidden="true" />
                <div className="text-lg font-semibold text-gray-900">{selectedWebsite.name}</div>
              </div>
            </div>
            <Button
              size="small"
              variant="secondary"
              onClick={() => {
                handleWebsiteChange(null); // Clear selection
                setShowPicker(true); // Show picker
              }}
            >
              Bytt nettside eller app
            </Button>
          </div>
        ) : (
          /* Show combobox when changing or no selection */
          <>
            <UNSAFE_Combobox
              label="Velg nettside eller app"
              options={websites.map(website => ({
                label: website.name,
                value: website.name,
                website: website
              }))}
              selectedOptions={selectedWebsite ? [selectedWebsite.name] : []}
              onToggleSelected={(option: string, isSelected: boolean) => {
                if (isSelected) {
                  const website = websites.find(w => w.name === option);
                  if (website) {
                    handleWebsiteChange(website);
                    setShowPicker(false); // Hide picker after selection
                  }
                } else {
                  handleWebsiteChange(null);
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
                      setShowPicker(false);
                    } else {
                      setShowPicker(true); // Load websites if not in cache
                    }
                  }}
                >
                  nav.no
                </Button>
                <Button
                  size="xsmall"
                  variant="secondary"
                  onClick={() => {
                    const website = websites.find(w => w.id === '83b80c84-b551-4dff-a679-f21be5fa0453');
                    if (website) {
                      handleWebsiteChange(website);
                      setShowPicker(false);
                    } else {
                      setShowPicker(true); // Load websites if not in cache
                    }
                  }}
                >
                  navet
                </Button>
              </div>
            )}
          </>
        )}

        {selectedWebsite && includeParams && (
          <div className="mt-4 p-3 bg-green-50 rounded border border-green-200">
            <div className="text-sm text-gray-700">
              Hentet hendelser med hendelsesdetaljer for siste {dateRangeInDays} {dateRangeInDays === 1 ? 'dag' : 'dager'}.
            </div>
          </div>
        )}
      </div>
      {
        showLoading && (
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
        )
      }
    </div >
  );
};

export default WebsitePicker;
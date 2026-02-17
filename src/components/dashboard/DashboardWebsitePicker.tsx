import { useState, useEffect, useRef, useCallback } from 'react';
import { UNSAFE_Combobox, Alert, Button } from '@navikt/ds-react';

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
    variant?: 'default' | 'minimal'; // Add variant prop
    disableAutoEvents?: boolean; // Add flag to disable auto-fetching of events
    requestLoadEvents?: boolean; // Add flag to manually trigger event loading
    onLoadingChange?: (isLoading: boolean) => void; // Add callback for loading state
    size?: 'medium' | 'small';
    disableUrlUpdate?: boolean; // Add flag to disable automatic URL updates
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

interface EventPropertiesResponse {
    properties?: EventProperty[];
    gbProcessed?: number;
    estimatedGbProcessed?: number;
}

const API_TIMEOUT_MS = 120000; // timeout
const CACHE_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

// Make cache keys environment-aware to prevent dev/prod conflicts
const getHostPrefix = () => window.location.hostname.replace(/\./g, '_');
const WEBSITES_CACHE_KEY = `umami_websites_cache_${getHostPrefix()}`;
const SELECTED_WEBSITE_CACHE_KEY = `umami_selected_website_${getHostPrefix()}`;

const isRecord = (value: unknown): value is Record<string, unknown> => {
    return typeof value === 'object' && value !== null;
};

const isWebsiteLike = (value: unknown): value is Website => {
    return isRecord(value)
        && typeof value.id === 'string'
        && typeof value.name === 'string'
        && typeof value.domain === 'string'
        && typeof value.teamId === 'string'
        && typeof value.createdAt === 'string';
};

const isEventProperty = (value: unknown): value is EventProperty => {
    return isRecord(value)
        && typeof value.eventName === 'string'
        && typeof value.propertyName === 'string'
        && typeof value.total === 'number'
        && (value.type === undefined || value.type === 'string' || value.type === 'number');
};

const parseEventPropertiesResponse = (value: unknown): EventPropertiesResponse => {
    if (!isRecord(value)) return {};
    const properties = Array.isArray(value.properties)
        ? value.properties.filter(isEventProperty)
        : [];
    const gbProcessed = typeof value.gbProcessed === 'number' ? value.gbProcessed : undefined;
    const estimatedGbProcessed = typeof value.estimatedGbProcessed === 'number' ? value.estimatedGbProcessed : undefined;
    return { properties, gbProcessed, estimatedGbProcessed };
};

const parseWebsitesResponse = (value: unknown): Website[] => {
    if (!isRecord(value) || !Array.isArray(value.data)) return [];
    return value.data.filter(isWebsiteLike);
};

const safeParseJson = (value: string): unknown => {
    try {
        return JSON.parse(value) as unknown;
    } catch {
        return null;
    }
};

// LocalStorage helper functions
const saveToLocalStorage = (key: string, data: unknown) => {
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

        const item = safeParseJson(itemStr);
        if (!isRecord(item) || typeof item.timestamp !== 'number' || !('data' in item)) {
            return null;
        }

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

const DashboardWebsitePicker = ({
    selectedWebsite,
    onWebsiteChange,
    onEventsLoad,
    dateRangeInDays: externalDateRange,
    shouldReload = false,
    onIncludeParamsChange,
    resetIncludeParams = false,
    requestIncludeParams = false,
    variant = 'default',
    disableAutoEvents = false,
    requestLoadEvents = false,
    onLoadingChange,
    size = 'medium',
    disableUrlUpdate = false
}: WebsitePickerProps) => {
    const [websites, setWebsites] = useState<Website[]>([]);
    const [loadedWebsiteId, setLoadedWebsiteId] = useState<string | null>(null);
    const [dateRangeInDays, setDateRangeInDays] = useState<number>(externalDateRange || 14);
    const apiCache = useRef<ApiCache>({});
    const fetchInProgress = useRef<{ [key: string]: boolean }>({});
    const websitesLoaded = useRef<boolean>(false);
    const prevExternalDateRange = useRef<number>(externalDateRange || 14);
    const prevShouldReload = useRef<boolean>(shouldReload);
    const initialUrlChecked = useRef<boolean>(false);

    const [error, setError] = useState<string | null>(null);
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
        if (!disableUrlUpdate) {
            updateUrlWithWebsiteId(website);
        }

        // Save/clear selected website in localStorage
        if (website) {
            saveToLocalStorage(SELECTED_WEBSITE_CACHE_KEY, website);
        } else {
            localStorage.removeItem(SELECTED_WEBSITE_CACHE_KEY);
        }

        // Reset to cheap query when switching websites
        setIncludeParams(false);
    }, [onWebsiteChange, updateUrlWithWebsiteId, disableUrlUpdate]);

    // Check for website ID in URL on initial load
    useEffect(() => {
        if (websitesLoaded.current && !initialUrlChecked.current && websites.length > 0) {
            const urlParams = new URLSearchParams(window.location.search);
            const websiteIdFromUrl = urlParams.get('websiteId');

            if (websiteIdFromUrl) {
                const website = websites.find(w => w.id === websiteIdFromUrl);
                if (website && !selectedWebsite) {
                    handleWebsiteChange(website); // Use handleWebsiteChange to ensure caching
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
        if (onLoadingChange) {
            onLoadingChange(loading);
        }
    }, [onLoadingChange]);

    const [fullEventsLoadedId, setFullEventsLoadedId] = useState<string | null>(null);

    const fetchEventNames = useCallback(async (website: Website, daysToFetch = dateRangeInDays, metadataOnly = false) => {
        const websiteId = website.id;
        if (fetchInProgress.current[websiteId]) return;

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

        if (metadataOnly) {
            if (onEventsLoad) {
                onEventsLoad([], [], totalDays);
            }
            return;
        }

        fetchInProgress.current[websiteId] = true;
        setError(null); // Clear any previous errors

        try {
            // Show loading UI
            handleLoadingState(true);

            // Use local API endpoint that queries BigQuery
            const apiBase = '/api/bigquery';

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
            ]);
            if (!(propertiesResponse instanceof Response)) {
                throw new Error('Unexpected response from event properties request');
            }
            const responseData = await propertiesResponse.json() as unknown;

            console.log('API Response:', responseData);

            // Extract properties and GB processed from response
            const parsedResponse = parseEventPropertiesResponse(responseData);
            const properties: EventProperty[] = parsedResponse.properties || [];
            const gbProcessedValue = parsedResponse.gbProcessed;
            const estimatedGbValue = parsedResponse.estimatedGbProcessed;

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
    }, [onEventsLoad, handleLoadingState, includeParams, dateRangeInDays]);

    // Load websites on mount
    useEffect(() => {
        if (websitesLoaded.current) {
            return;
        }

        // Try to load websites from cache first
        const cachedWebsites = getFromLocalStorage<Website[]>(WEBSITES_CACHE_KEY);

        if (cachedWebsites && cachedWebsites.length > 0) {
            console.log('Using cached websites list');
            setWebsites(cachedWebsites);
            websitesLoaded.current = true;
            return;
        }

        // If no cache, fetch from API
        const baseUrl = '';

        fetch(`${baseUrl}/api/bigquery/websites`)
            .then(response => response.json() as Promise<unknown>)
            .then((response) => {
                const websitesData = parseWebsitesResponse(response);
                const uniqueWebsites = websitesData.filter((website: Website, index: number, self: Website[]) =>
                    index === self.findIndex((w) => w.name === website.name)
                );
                setWebsites(uniqueWebsites);
                saveToLocalStorage(WEBSITES_CACHE_KEY, uniqueWebsites);
                websitesLoaded.current = true;
            })
            .catch(error => {
                console.error("Error fetching websites:", error);
            });
    }, []);

    // On mount, try to restore from localStorage
    useEffect(() => {
        if (initialUrlChecked.current) return;

        const urlParams = new URLSearchParams(window.location.search);
        const websiteIdFromUrl = urlParams.get('websiteId');

        // Priority 1: URL parameter (need to load websites to find it)
        if (websiteIdFromUrl) {
            // Websites will load automatically via the effect above
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
            }
        }
    }, [websites, handleWebsiteChange]);

    // Fetch events when a website is selected (only if onEventsLoad callback is provided)
    useEffect(() => {
        if (!selectedWebsite || !onEventsLoad) {
            if (!selectedWebsite && loadedWebsiteId) {
                setLoadedWebsiteId(null);
                setFullEventsLoadedId(null);
            }
            return;
        }

        const isNewWebsite = selectedWebsite.id !== loadedWebsiteId;
        const needsFullLoad = requestLoadEvents && fullEventsLoadedId !== selectedWebsite.id;

        if (isNewWebsite) {
            if (disableAutoEvents && !requestLoadEvents) {
                // Metadata only fetch
                void fetchEventNames(selectedWebsite, dateRangeInDays, true);
                setLoadedWebsiteId(selectedWebsite.id);
                setFullEventsLoadedId(null);
            } else {
                // Full fetch
                apiCache.current = {};
                void fetchEventNames(selectedWebsite, dateRangeInDays, false);
                setLoadedWebsiteId(selectedWebsite.id);
                setFullEventsLoadedId(selectedWebsite.id);
            }
        } else if (needsFullLoad) {
            // We are on the same website, but now requesting full load
            apiCache.current = {};
            void fetchEventNames(selectedWebsite, dateRangeInDays, false);
            setFullEventsLoadedId(selectedWebsite.id);
        }
    }, [selectedWebsite, loadedWebsiteId, onEventsLoad, fetchEventNames, dateRangeInDays, disableAutoEvents, requestLoadEvents, fullEventsLoadedId]);

    // Reload when includeParams changes (only if onEventsLoad callback is provided)
    useEffect(() => {
        if (selectedWebsite && loadedWebsiteId === selectedWebsite.id && includeParams !== prevIncludeParams.current && onEventsLoad) {
            prevIncludeParams.current = includeParams;
            apiCache.current[selectedWebsite.id] = {};
            void fetchEventNames(selectedWebsite, dateRangeInDays);
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
            void fetchEventNames(selectedWebsite, externalDateRange || dateRangeInDays);
        }
    }, [externalDateRange, shouldReload, selectedWebsite, fetchEventNames, dateRangeInDays, onEventsLoad]);


    const sortedWebsites = [...websites].sort((a, b) => {
        const priorityIds = ['35abb2b7-3f97-42ce-931b-cf547d40d967', '83b80c84-b551-4dff-a679-f21be5fa0453'];
        const aIndex = priorityIds.indexOf(a.id);
        const bIndex = priorityIds.indexOf(b.id);

        if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
        if (aIndex !== -1) return -1;
        if (bIndex !== -1) return 1;

        return a.name.localeCompare(b.name);
    });

    const isWebsitesLoading = websites.length === 0 && !websitesLoaded.current;
    const optionLabels = sortedWebsites.map(w => ({ value: w.id, label: w.name }));

    return (
        <div className={`${variant === 'minimal' ? '' : ''}`}>
            <div>
                {error && (
                    <Alert variant="error" className="mb-4">
                        {error}
                    </Alert>
                )}

                <UNSAFE_Combobox
                    label="Nettside eller app"
                    size={size}
                    options={optionLabels}
                    selectedOptions={selectedWebsite ? [selectedWebsite.id] : []}
                    onToggleSelected={(value, isSelected) => {
                        if (isSelected) {
                            const website = websites.find(w => w.id === value);
                            if (website) handleWebsiteChange(website);
                        } else {
                            handleWebsiteChange(null);
                        }
                    }}
                    className="w-full"
                    isLoading={isWebsitesLoading}
                />
                {!isWebsitesLoading && sortedWebsites.length === 0 && (
                    <div className="mt-2 text-sm">Ingen nettsteder tilgjengelig</div>
                )}

                {selectedWebsite && (
                    <div className="mt-4">
                        <Button
                            variant="secondary"
                            onClick={() => handleWebsiteChange(null)}
                            size={size}
                        >
                            Fjern valg
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default DashboardWebsitePicker;


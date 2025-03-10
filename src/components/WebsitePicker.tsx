import { useState, useEffect, useRef } from 'react';
import { UNSAFE_Combobox } from '@navikt/ds-react';

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

const WebsitePicker = ({ selectedWebsite, onWebsiteChange, onEventsLoad }: WebsitePickerProps) => {
  const [websites, setWebsites] = useState<Website[]>([]);
  const [loadedWebsiteId, setLoadedWebsiteId] = useState<string | null>(null);
  const apiCache = useRef<ApiCache>({});
  const fetchInProgress = useRef<{[key: string]: boolean}>({});

  useEffect(() => {
    const baseUrl = window.location.hostname === 'localhost' 
      ? 'https://reops-proxy.intern.nav.no' 
      : 'https://reops-proxy.ansatt.nav.no';

    // Only fetch websites list once
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

  // Fetch events when a website is selected
  useEffect(() => {
    if (selectedWebsite && selectedWebsite.id !== loadedWebsiteId && onEventsLoad) {
      fetchEventNames(selectedWebsite.id)
        .finally(() => {
          setLoadedWebsiteId(selectedWebsite.id);
        });
    }
  }, [selectedWebsite?.id, loadedWebsiteId, onEventsLoad]);

  const fetchEventNames = async (websiteId: string) => {
    // Prevent multiple API calls for the same website
    if (fetchInProgress.current[websiteId]) {
      return;
    }
    
    fetchInProgress.current[websiteId] = true;

    try {
      const baseUrl = window.location.hostname === 'localhost' 
        ? 'https://reops-proxy.intern.nav.no' 
        : 'https://reops-proxy.ansatt.nav.no';

      // Initialize cache for this website if needed
      if (!apiCache.current[websiteId]) {
        apiCache.current[websiteId] = {};
      }

      // Step 1: Get date range (check cache first)
      let dateRange;
      if (apiCache.current[websiteId].dateRange) {
        console.log("Using cached date range");
        dateRange = apiCache.current[websiteId].dateRange;
      } else {
        console.log("Fetching date range");
        const dateRangeResponse = await fetch(`${baseUrl}/umami/api/websites/${websiteId}/daterange`, {
          credentials: window.location.hostname === 'localhost' ? 'omit' : 'include'
        });
        dateRange = await dateRangeResponse.json();
        apiCache.current[websiteId].dateRange = dateRange;
      }
      
      // Step 2: Get properties (check cache first)
      let properties: EventProperty[];
      if (apiCache.current[websiteId].properties) {
        console.log("Using cached properties");
        properties = apiCache.current[websiteId].properties!;
      } else {
        console.log("Fetching properties");
        // Convert ISO dates to milliseconds
        const startAt = new Date(dateRange.mindate).getTime();
        const endAt = new Date(dateRange.maxdate).getTime();
        
        const propertiesResponse = await fetch(
          `${baseUrl}/umami/api/websites/${websiteId}/event-data/properties?startAt=${startAt}&endAt=${endAt}&unit=hour&timezone=Europe%2FOslo`,
          { credentials: window.location.hostname === 'localhost' ? 'omit' : 'include' }
        );
        properties = await propertiesResponse.json();
        apiCache.current[websiteId].properties = properties;
      }
      
      // Process the properties to get unique event names and their related parameters
      const eventMap = new Map<string, string[]>();
      properties.forEach(prop => {
        if (!eventMap.has(prop.eventName)) {
          eventMap.set(prop.eventName, []);
        }
        if (!eventMap.get(prop.eventName)!.includes(prop.propertyName)) {
          eventMap.get(prop.eventName)!.push(prop.propertyName);
        }
      });
      
      // Convert map to arrays
      const uniqueEventNames = Array.from(eventMap.keys());
      
      // Create parameter objects with event name prefixes
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
      console.error("Error fetching event properties:", error);
    } finally {
      fetchInProgress.current[websiteId] = false;
    }
  };

  return (
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
          onWebsiteChange(website || null);
        } else {
          onWebsiteChange(null);
        }
      }}
      clearButton
    />
  );
};

export default WebsitePicker;

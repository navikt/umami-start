import { useState, useEffect } from 'react';
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
}

const WebsitePicker = ({ selectedWebsite, onWebsiteChange, onEventsLoad }: WebsitePickerProps) => {
  const [websites, setWebsites] = useState<Website[]>([]);
  const [loadedWebsiteId, setLoadedWebsiteId] = useState<string | null>(null);

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
    try {
      const baseUrl = window.location.hostname === 'localhost' 
        ? 'https://reops-proxy.intern.nav.no' 
        : 'https://reops-proxy.ansatt.nav.no';

      // Step 1: Fetch the date range
      const dateRangeResponse = await fetch(`${baseUrl}/umami/api/websites/${websiteId}/daterange`, {
        credentials: window.location.hostname === 'localhost' ? 'omit' : 'include'
      });
      const dateRange = await dateRangeResponse.json();
      
      // Step 2: Convert ISO dates to milliseconds
      const startAt = new Date(dateRange.mindate).getTime();
      const endAt = new Date(dateRange.maxdate).getTime();
      
      // Step 3: Fetch event properties
      const propertiesResponse = await fetch(
        `${baseUrl}/umami/api/websites/${websiteId}/event-data/properties?startAt=${startAt}&endAt=${endAt}&unit=hour&timezone=Europe%2FOslo`,
        {
          credentials: window.location.hostname === 'localhost' ? 'omit' : 'include'
        }
      );
      const properties: EventProperty[] = await propertiesResponse.json();
      
      // Extract unique event names and property names
      const uniqueEventNames = Array.from(new Set(properties.map(prop => prop.eventName)));
      const uniqueProperties = Array.from(new Set(properties.map(prop => prop.propertyName)));
      
      if (onEventsLoad) {
        // Pass both event names and parameters to parent
        onEventsLoad(uniqueEventNames, uniqueProperties.map(prop => ({
          key: prop,
          type: 'string' as const
        })));
      }
    } catch (error) {
      console.error("Error fetching event properties:", error);
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

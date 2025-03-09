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
}

const WebsitePicker = ({ selectedWebsite, onWebsiteChange }: WebsitePickerProps) => {
  const [websites, setWebsites] = useState<Website[]>([]);

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

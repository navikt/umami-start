import { useState, KeyboardEvent, ChangeEvent, useEffect } from 'react';
import {
  Button,
  TextField,
  Checkbox,
  Heading,
  HGrid,
  Radio,
  RadioGroup,
  UNSAFE_Combobox,
  Textarea,
  Alert // Add this to imports at top
} from '@navikt/ds-react';
import { Copy, MoveUp, MoveDown } from 'lucide-react';

// Add Website interface
interface Website {
  id: string;
  name: string;
  domain: string;
  teamId: string;
}

type BaseColumns = {
  [key: string]: boolean;
};

type EventQueryType = 'custom' | 'pageview';

const SQLGeneratorForm = () => {
  const [eventNames, setEventNames] = useState<string[]>([]); // New state for multiple events
  const [newEventName, setNewEventName] = useState<string>(''); // New state for event input
  const [selectedWebsite, setSelectedWebsite] = useState<Website | null>(null);
  const [websites, setWebsites] = useState<Website[]>([]);
  const [dataKeys, setDataKeys] = useState<string[]>([]);
  const [newDataKey, setNewDataKey] = useState<string>('');
  const [queryType, setQueryType] = useState<EventQueryType>('custom');
  const [error, setError] = useState<string | null>(null); // Add error state
  const [parameterSQLCopySuccess, setParameterSQLCopySuccess] = useState<boolean>(false);
  const [eventSQLCopySuccess, setEventSQLCopySuccess] = useState<boolean>(false);
  const [eventSQLDetailsOpen, setEventSQLDetailsOpen] = useState<boolean>(false);
  const [parameterSQLDetailsOpen, setParameterSQLDetailsOpen] = useState<boolean>(false);
  const [parameterSQLCopySuccess1, setParameterSQLCopySuccess1] = useState<boolean>(false);
  const [parameterSQLCopySuccess2, setParameterSQLCopySuccess2] = useState<boolean>(false);

  // Update the allBaseColumns organization into groups
  const columnGroups = {
    eventBasics: {
      label: 'Basisdetaljer (anbefalt)',
      columns: {
        event_id: false,
        created_at: false,
        event_name: false,
        website_id: false,
        website_domain: false,
        website_name: false,
      }
    },
    pageDetails: {
      label: 'Hendelsesdetaljer',
      columns: {
        page_title: false,
        // URL details
        url_path: false,
        url_query: false,
        url_fullpath: false,
        url_fullurl: false,
        // Referrer details
        referrer_domain: false,
        referrer_path: false,
        referrer_query: false,
        referrer_fullpath: false,
        referrer_fullurl: false,
      }
    },
    visitorDetails: {
      label: 'Brukerdetaljer',
      columns: {
        visit_id: false,
        session_id: false,
        browser: false,
        os: false,
        device: false,
        screen: false,
        language: false,
        country: false,
        subdivision1: false,
        city: false,
      }
    }
  };

  // Replace allBaseColumns with flattened version of groups
  const allBaseColumns: BaseColumns = Object.values(columnGroups)
    .reduce((acc, group) => ({ ...acc, ...group.columns }), {});

  // Updated initial state with minimum preset
  const [baseColumns, setBaseColumns] = useState<BaseColumns>({
    ...allBaseColumns,
    event_id: true,
    created_at: true,
    event_name: true,
    website_id: true,
    website_domain: true,
    website_name: true
  });
  const [generatedSQL, setGeneratedSQL] = useState<string>('');
  const [copySuccess, setCopySuccess] = useState<boolean>(false);

  // Update the addDataKey function
  const addDataKey = (): void => {
    if (!newDataKey.trim()) return;
    
    // Split the input by newlines and commas
    const keys = newDataKey
      .split(/[\n,]/)
      .map(key => key.trim())
      .filter(key => key && !dataKeys.includes(key));
    
    if (keys.length) {
      setDataKeys(prev => [...prev, ...keys]);
      setNewDataKey('');
    }
  };

  const removeDataKey = (keyToRemove: string): void => {
    setDataKeys(dataKeys.filter(key => key !== keyToRemove));
  };

  const handleCopySQL = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(generatedSQL);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  // Add this new helper function
  const sanitizeColumnName = (key: string): string => {
    return key
      .replace(/\./g, '_')
      .replace(/æ/gi, 'ae')
      .replace(/ø/gi, 'oe')
      .replace(/å/gi, 'aa')
      .replace(/[^a-z0-9_]/gi, '_'); // Replace any other special characters with underscore
  };

  // Add new function to handle multiple events
  const addEventName = (): void => {
    if (!newEventName.trim()) return;
    
    // Split the input by newlines and commas
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

  const generateSQL = (): void => {
    setError(null);
    console.log('Selected website:', selectedWebsite);

    if (!selectedWebsite) {
      setError('Du må velge en nettside først');
      return;
    }

    if (queryType === 'custom') {
      if (eventNames.length === 0) {
        setError('Du må legge til minst ett event-navn');
        return;
      }
    }

    const hasSelectedColumns = Object.values(baseColumns).some(isSelected => isSelected);
    if (!hasSelectedColumns) {
      setError('Du må velge minst én kolonne');
      return;
    }

    // Check if any "Brukerdetaljer" columns are selected
    const hasVisitorDetails = Object.keys(columnGroups.visitorDetails.columns).some(
      column => baseColumns[column]
    );

    let sql = 'WITH base_query AS (\n';
    sql += '  SELECT\n';
    sql += '    e.*,\n';
    sql += `    '${selectedWebsite?.domain}' as website_domain,\n`;
    sql += `    '${selectedWebsite?.name}' as website_name,\n`;
    sql += '    CONCAT(\n';
    sql += '      e.url_path,\n';
    sql += '      CASE\n';
    sql += '        WHEN e.url_query IS NOT NULL AND e.url_query != \'\'\n';
    sql += '        THEN CONCAT(\'?\', e.url_query)\n';
    sql += '        ELSE \'\'\n';
    sql += '      END\n';
    sql += '    ) AS url_fullpath,\n';
    sql += '    CONCAT(\n';
    sql += `      'https://${selectedWebsite?.domain}',\n`;
    sql += '      e.url_path,\n';
    sql += '      CASE\n';
    sql += '        WHEN e.url_query IS NOT NULL AND e.url_query != \'\'\n';
    sql += '        THEN CONCAT(\'?\', e.url_query)\n';
    sql += '        ELSE \'\'\n';
    sql += '      END\n';
    sql += '    ) AS url_fullurl,\n';
    sql += '    CONCAT(\n';
    sql += '      e.referrer_path,\n';
    sql += '      CASE\n';
    sql += '        WHEN e.referrer_query IS NOT NULL AND e.referrer_query != \'\'\n';
    sql += '        THEN CONCAT(\'?\', e.referrer_query)\n';
    sql += '        ELSE \'\'\n';
    sql += '      END\n';
    sql += '    ) AS referrer_fullpath,\n';
    sql += '    CASE\n';
    sql += '      WHEN e.referrer_domain IS NOT NULL AND e.referrer_domain != \'\'\n';
    sql += '      THEN CONCAT(\n';
    sql += '        \'https://\',\n';
    sql += '        e.referrer_domain,\n';
    sql += '        e.referrer_path,\n';
    sql += '        CASE\n';
    sql += '          WHEN e.referrer_query IS NOT NULL AND e.referrer_query != \'\'\n';
    sql += '          THEN CONCAT(\'?\', e.referrer_query)\n';
    sql += '          ELSE \'\'\n';
    sql += '        END\n';
    sql += '      )\n';
    sql += '      ELSE NULL\n';
    sql += '    END AS referrer_fullurl';

    // Conditionally include session columns
    if (hasVisitorDetails) {
      sql += ',\n    s.browser,\n';
      sql += '    s.os,\n';
      sql += '    s.device,\n';
      sql += '    s.screen,\n';
      sql += '    s.language,\n';
      sql += '    s.country,\n';
      sql += '    s.subdivision1,\n';
      sql += '    s.city\n';
    }

    sql += '  FROM `team-researchops-prod-01d6.umami.public_website_event` e\n';
    
    // Conditionally join the public_session table
    if (hasVisitorDetails) {
      sql += '  LEFT JOIN `team-researchops-prod-01d6.umami.public_session` s\n';
      sql += '    ON e.session_id = s.session_id\n';
    }
    
    // Modified WHERE clause based on query type and website_id
    if (queryType === 'custom') {
      sql += '  WHERE e.event_name IN (\'' + eventNames.join('\', \'') + '\')\n';
    } else {
      sql += '  WHERE e.event_type = 1\n'; // pageview type
    }
    
    if (selectedWebsite) {
      sql += `  AND e.website_id = '${selectedWebsite.id}'\n`;
    }
    
    sql += ')\n\n';
    sql += 'SELECT\n';
    
    // Add base columns with correct table reference
    const selectedBaseColumns = Object.entries(baseColumns)
      .filter(([_, isSelected]) => isSelected)
      .map(([column]) => `  base_query.${column}`);
    
    // Add data key columns
    const dataKeyColumns = dataKeys.map(key => 
      `  MAX(CASE WHEN event_data.data_key = '${key}' THEN event_data.string_value END) AS data_key_${sanitizeColumnName(key)}`
    );
    
    const allColumns = [...selectedBaseColumns, ...dataKeyColumns];
    
    sql += allColumns.join(',\n');
    
    sql += '\nFROM base_query\n';
    sql += 'LEFT JOIN `team-researchops-prod-01d6.umami.public_event_data` AS event_data\n';
    sql += '  ON base_query.event_id = event_data.website_event_id\n';

    // Add GROUP BY if we have any data key columns
    if (dataKeyColumns.length > 0) {
      sql += 'GROUP BY\n  ' + selectedBaseColumns.join(',\n  ');
    }

    setGeneratedSQL(sql);
  };

const getParameterLookupSQL = (): string => {
  if (!selectedWebsite) {
    return '⚠️ Velg en nettside først for å se SQL-koden';
  }
  if (queryType === 'custom' && eventNames.length === 0) {
    return '⚠️ Legg til event-navn først for å se SQL-koden';
  }
  return `-- Velg en av spørringene under:

-- 1. Liste med kommaseparerte verdier (enkel å kopiere):
SELECT STRING_AGG(DISTINCT data_key, ',')
FROM \`team-researchops-prod-01d6.umami.public_event_data\` ed
JOIN \`team-researchops-prod-01d6.umami.public_website_event\` e
  ON ed.website_event_id = e.event_id
WHERE e.website_id = '${selectedWebsite.id}'
  ${eventNames.length > 0 ? `AND e.event_name IN ('${eventNames.join("', '")}')` : ''};

-- 2. Liste med én verdi per rad (lettere å lese):
SELECT DISTINCT data_key
FROM \`team-researchops-prod-01d6.umami.public_event_data\` ed
JOIN \`team-researchops-prod-01d6.umami.public_website_event\` e
  ON ed.website_event_id = e.event_id
WHERE e.website_id = '${selectedWebsite.id}'
  ${eventNames.length > 0 ? `AND e.event_name IN ('${eventNames.join("', '")}')` : ''}
ORDER BY data_key;`;
};

  const handleCopyParameterSQL = async (): Promise<void> => {
    if (!selectedWebsite) {
      return;
    }
    try {
      await navigator.clipboard.writeText(getParameterLookupSQL());
      setParameterSQLCopySuccess(true);
      setTimeout(() => setParameterSQLCopySuccess(false), 2000);
    } catch (err) {
      console.error('Failed to copy parameter SQL:', err);
    }
  };

  const getEventLookupSQL = (): string => {
    if (!selectedWebsite) {
      return '⚠️ Velg en nettside først for å se SQL-kode';
    }
    return `SELECT DISTINCT event_name, COUNT(*) as count
FROM \`team-researchops-prod-01d6.umami.public_website_event\`
WHERE website_id = '${selectedWebsite.id}'
  AND event_type = 2
GROUP BY event_name
ORDER BY count DESC`;
  };

  const handleCopyEventSQL = async (): Promise<void> => {
    if (!selectedWebsite) {
      return;
    }
    try {
      await navigator.clipboard.writeText(getEventLookupSQL());
      setEventSQLCopySuccess(true);
      setTimeout(() => setEventSQLCopySuccess(false), 2000);
    } catch (err) {
      console.error('Failed to copy event SQL:', err);
    }
  };

  const handleCloseEventSQL = () => {
    setEventSQLDetailsOpen(false);
  };

  const handleCloseParameterSQL = () => {
    setParameterSQLDetailsOpen(false);
  };

  // Add API fetch for websites
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
        // Sort by environment first (prod first), then alphabetically by name
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

  // Add function to toggle all columns in a group
  const toggleGroupColumns = (groupKey: string, value: boolean) => {
    setBaseColumns(prev => {
      const newState = { ...prev }
      // @ts-ignore
      Object.keys(columnGroups[groupKey].columns).forEach(column => {
        newState[column] = value;
      });
      if (!value) {
        // Keep recommended columns selected even when deselecting all
        if (groupKey === 'eventDetails') {
          newState.event_id = true;
          newState.created_at = true;
          newState.event_name = true;
          newState.website_id = true;
          newState.website_domain = true;
        }
      }
      return newState;
    });
  };

  // Split the parameter lookup SQL into two functions
  const getParameterLookupSQL1 = (): string => {
    if (!selectedWebsite) return '⚠️ Velg en nettside først for å se SQL-koden';
    if (queryType === 'custom' && eventNames.length === 0) return '⚠️ Legg til event-navn først for å se SQL-koden';
    
    return `SELECT STRING_AGG(DISTINCT data_key, ',')
FROM \`team-researchops-prod-01d6.umami.public_event_data\` ed
JOIN \`team-researchops-prod-01d6.umami.public_website_event\` e
  ON ed.website_event_id = e.event_id
WHERE e.website_id = '${selectedWebsite.id}'
  ${eventNames.length > 0 ? `AND e.event_name IN ('${eventNames.join("', '")}')` : ''};`;
  };

  const getParameterLookupSQL2 = (): string => {
    if (!selectedWebsite) return '⚠️ Velg en nettside først for å se SQL-koden';
    if (queryType === 'custom' && eventNames.length === 0) return '⚠️ Legg til event-navn først for å se SQL-koden';
    
    return `SELECT DISTINCT data_key
FROM \`team-researchops-prod-01d6.umami.public_event_data\` ed
JOIN \`team-researchops-prod-01d6.umami.public_website_event\` e
  ON ed.website_event_id = e.event_id
WHERE e.website_id = '${selectedWebsite.id}'
  ${eventNames.length > 0 ? `AND e.event_name IN ('${eventNames.join("', '")}')` : ''}
ORDER BY data_key;`;
  };

  const handleCopyParameterSQL1 = async (): Promise<void> => {
    if (!selectedWebsite) return;
    try {
      await navigator.clipboard.writeText(getParameterLookupSQL1());
      setParameterSQLCopySuccess1(true);
      setTimeout(() => setParameterSQLCopySuccess1(false), 2000);
    } catch (err) {
      console.error('Failed to copy parameter SQL:', err);
    }
  };

  const handleCopyParameterSQL2 = async (): Promise<void> => {
    if (!selectedWebsite) return;
    try {
      await navigator.clipboard.writeText(getParameterLookupSQL2());
      setParameterSQLCopySuccess2(true);
      setTimeout(() => setParameterSQLCopySuccess2(false), 2000);
    } catch (err) {
      console.error('Failed to copy parameter SQL:', err);
    }
  };

  // Add move key functions
  const moveKey = (index: number, direction: 'up' | 'down') => {
    const newKeys = [...dataKeys];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    
    if (newIndex >= 0 && newIndex < newKeys.length) {
      [newKeys[index], newKeys[newIndex]] = [newKeys[newIndex], newKeys[index]];
      setDataKeys(newKeys);
    }
  };

  // Add this function before the return statement
const handleAddDataKeyPres = (e: KeyboardEvent<HTMLInputElement>, action: () => void) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      action();
    }
  };

    // Add this function before the return statement
const handleAddEventKeyPres = (e: KeyboardEvent<HTMLInputElement>, action: () => void) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      action();
    }
  };
  

  return (
    <div className="w-full max-w-2xl">
      <Heading spacing level="1" size="medium" className="pt-12 pb-6">
        Bygg en Metabase-modell med kombinerte Umami-data
      </Heading>

      <div className="space-y-6">

        {/* Updated Combobox implementation */}
        <UNSAFE_Combobox
          label="Nettside / app"
          className="mb-8"
          options={websites.map(website => ({
            label: website.name,
            value: website.name,
            website: website
          }))}
          selectedOptions={selectedWebsite ? [selectedWebsite.name] : []}
          onToggleSelected={(option, isSelected) => {
            if (isSelected) {
              const website = websites.find(w => w.name === option);
              setSelectedWebsite(website || null);
            } else {
              setSelectedWebsite(null);
            }
          }}
          clearButton
        />

        {/* Query Type Selection */}
        <RadioGroup 
          legend="Event-type du ønsker å kombinere data for"
          value={queryType}
          className="-mb-8"
          onChange={(value: EventQueryType) => setQueryType(value)}
        >
          <Radio value="custom">Egendefinert event</Radio>
          <Radio value="pageview">Umami besøk-eventet</Radio>
        </RadioGroup>

        {/* Event Name Input - Only show for custom events */}
        {queryType === 'custom' && (
          <div className="space-y-2">
            <div className="flex gap-2 items-end">
              <TextField
                label="Event-navn"
                description="Eksempel: skjema startet (legg til flere med komma)"
                value={newEventName}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setNewEventName(e.target.value)}
                onKeyUp={(e: KeyboardEvent<HTMLInputElement>) => handleAddEventKeyPres(e, addEventName)}
                style={{ width: '100%' }}
              />
              <Button 
                variant="secondary" 
                onClick={addEventName}
                style={{ height: '50px' }}
              >
                Legg til event-navn
              </Button>
            </div>

            {/* Display added event names */}
            <HGrid className="mt-4">
              {eventNames.map((event) => (
                <div key={event}>
                  <div className="flex items-center justify-between p-2 my-2 bg-gray-100 rounded">
                    <span>{event}</span>
                    <Button
                      variant="danger"
                      size="small"
                      onClick={() => removeEventName(event)}
                    >
                      Fjern
                    </Button>
                  </div>
                </div>
              ))}
            </HGrid>

            <details 
              className="text-sm"
              open={eventSQLDetailsOpen}
              onToggle={(e) => setEventSQLDetailsOpen(e.currentTarget.open)}
            >
              <summary className="cursor-pointer text-blue-500 hover:text-blue-600">
                Vis SQL-kode for å finne tilgjengelige eventer i Metabase
              </summary>
              <div className="mt-2 p-3 bg-gray-50 rounded border">
                <div className="flex flex-col gap-3">
                  {!selectedWebsite ? (
                    <>
                      <pre className="overflow-x-auto whitespace-pre-wrap bg-white p-2 rounded">
                        {getEventLookupSQL()}
                      </pre>
                      <div className="flex justify-end space-x-2 border-t pt-2">
                        <Button
                          variant="secondary"
                          size="xsmall"
                          onClick={handleCloseEventSQL}
                        >
                          Lukk
                        </Button>
                      </div>
                    </>
                  ) : (
                    <>
                      <span className="text-gray-600">
                        Kjør denne spørringen i Metabase for å se tilgjengelige events:
                      </span>
                      <div className="bg-white p-3 rounded border">
                        <pre className="overflow-x-auto whitespace-pre-wrap mb-2">
                          {getEventLookupSQL()}
                        </pre>
                        <div className="flex justify-end space-x-2 border-t pt-2">
                          <Button
                            variant="secondary"
                            size="xsmall"
                            onClick={handleCopyEventSQL}
                            icon={<Copy aria-hidden />}
                          >
                            {eventSQLCopySuccess ? 'Kopiert!' : 'Kopier'}
                          </Button>
                          <Button
                            variant="secondary"
                            size="xsmall"
                            onClick={handleCloseEventSQL}
                          >
                            Lukk
                          </Button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </details>
          </div>
        )}

        {/* Data Keys Input */}
        <div>
          <div className="space-y-2">
            <div className="flex gap-2 items-end">
              <TextField 
                label="Event-metadetaljer"
                description="Eksempel: skjemanavn (legg til flere med komma)"
                value={newDataKey}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setNewDataKey(e.target.value)}
                onKeyUp={(e: KeyboardEvent<HTMLInputElement>) => handleAddDataKeyPres(e, addDataKey)}
                style={{ width: '100%' }}
              />
              <Button 
                variant="secondary" 
                onClick={addDataKey}
                style={{ height: '50px' }}
              >
                Legg til metadetaljer
              </Button>
            </div>

            {/* Rest of the details section */}
            <details 
              className="text-sm"
              open={parameterSQLDetailsOpen}
              onToggle={(e) => setParameterSQLDetailsOpen(e.currentTarget.open)}
            >
              <summary className="cursor-pointer text-blue-500 hover:text-blue-600">
                Vis SQL-kode for å finne tilgjengelige metadetaljer i Metabase
              </summary>
              <div className="mt-2 p-3 bg-gray-50 rounded border">
                <div className="flex flex-col gap-4">
                  {(!queryType || (queryType === 'custom' && eventNames.length === 0) || !selectedWebsite) ? (
                    <>
                      <pre className="overflow-x-auto whitespace-pre-wrap bg-white p-2 rounded">
                        {getParameterLookupSQL()}
                      </pre>
                      <div className="flex justify-end space-x-2 border-t pt-2">
                        <Button
                          variant="secondary"
                          size="xsmall"
                          onClick={handleCloseParameterSQL}
                        >
                          Lukk
                        </Button>
                      </div>
                    </>
                  ) : (
                    <>
                      <span className="text-gray-600 mb-2">
                        Kjør en av disse spørringene i Metabase for å finne tilgjengelige metadetaljer:
                      </span>

                    <div className="bg-white p-3 rounded border">
                        <div className="mb-3">
                          <strong className="text-sm text-gray-900">Spørring 1: Lett å lese i Metabase</strong>
                          <p className="text-sm text-gray-600">Viser alle metadetaljer på separate linjer.</p>
                        </div>
                        <pre className="overflow-x-auto whitespace-pre-wrap mb-2 bg-gray-50 p-2 rounded">
                          {getParameterLookupSQL2()}
                        </pre>
                        <div className="flex justify-end space-x-2 border-t pt-2">
                          <Button
                            variant="secondary"
                            size="xsmall"
                            onClick={handleCopyParameterSQL2}
                            icon={<Copy aria-hidden />}
                          >
                            {parameterSQLCopySuccess2 ? 'Kopiert!' : 'Kopier'}
                          </Button>
                        </div>
                      </div>
                      
                      <div className="bg-white p-3 rounded border">
                        <div className="mb-3">
                          <strong className="text-sm text-gray-900">Spørring 2: Lett å kopiere rett inn i tekstfeltet</strong>
                          <p className="text-sm text-gray-600">Returnerer alle metadetaljer som en kommaseparert liste.</p>
                        </div>
                        <pre className="overflow-x-auto whitespace-pre-wrap mb-2 bg-gray-50 p-2 rounded">
                          {getParameterLookupSQL1()}
                        </pre>
                        <div className="flex justify-end space-x-2 border-t pt-2">
                          <Button
                            variant="secondary"
                            size="xsmall"
                            onClick={handleCopyParameterSQL1}
                            icon={<Copy aria-hidden />}
                          >
                            {parameterSQLCopySuccess1 ? 'Kopiert!' : 'Kopier'}
                          </Button>
                        </div>
                      </div>

                      <div className="flex justify-end border-t pt-2">
                        <Button
                          variant="secondary"
                          size="xsmall"
                          onClick={handleCloseParameterSQL}
                        >
                          Lukk
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </details>
          </div>

          {/* Display added data keys with sorting */}
          <HGrid className="mt-4">
            {dataKeys.map((key, index) => (
              <div key={key}>
                <div className="flex items-center justify-between p-2 my-2 bg-gray-100 rounded">
                  <span>{key}</span>
                  <div className="flex gap-2">
                  <div className="flex gap-1">
                    {index > 0 && (
                        <Button
                        variant="secondary"
                        size="small"
                        icon={<MoveUp size={16} />}
                        onClick={() => moveKey(index, 'up')}
                        aria-label="Flytt opp"
                        />
                    )}
                    {index < dataKeys.length - 1 && (
                        <Button
                        variant="secondary"
                        size="small"
                        icon={<MoveDown size={16} />}
                        onClick={() => moveKey(index, 'down')}
                        aria-label="Flytt ned"
                        />
                    )}
                    </div>
                    <Button
                      variant="danger"
                      size="small"
                      onClick={() => removeDataKey(key)}
                    >
                      Fjern
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </HGrid>
        </div>

        <div>
          <Heading spacing level="2" size="small">
            Supplerende kolonner
          </Heading>

          <div className="mt-4 p-4 bg-gray-50 rounded">
            <div className="space-y-6">
              {Object.entries(columnGroups).map(([groupKey, group]) => (
                <div key={groupKey} className="border rounded p-4">
                  <div className="flex justify-between items-center mb-4">
                    <Heading level="3" size="xsmall">
                      {group.label}
                    </Heading>
                    <div className="flex gap-2">
                      <Button
                        variant="secondary"
                        size="xsmall"
                        onClick={() => toggleGroupColumns(groupKey, true)}
                      >
                        Velg alle
                      </Button>
                      <Button
                        variant="secondary"
                        size="xsmall"
                        onClick={() => toggleGroupColumns(groupKey, false)}
                      >
                        Fjern alle
                      </Button>
                    </div>
                  </div>
                  <HGrid>
                    {Object.entries(group.columns).map(([column, _]) => (
                      <div key={column}>
                        <Checkbox
                          checked={baseColumns[column]}
                          onChange={(e) =>
                            setBaseColumns((prev) => ({
                              ...prev,
                              [column]: e.target.checked,
                            }))
                          }
                        >
                          {column}
                        </Checkbox>
                      </div>
                    ))}
                  </HGrid>
                </div>
              ))}
            </div>
          </div>
        </div>

        <Button variant="primary" onClick={generateSQL}>
        Generer SQL-kode for Metabase-modell
        </Button>

        {error && (
          <Alert variant="error" closeButton onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {generatedSQL && !error && (
          <div>
            <div className="flex justify-between items-center mb-2">
              <Heading level="2" size="small">
                SQL-kode for Metabase-modell
              </Heading>
              <Button
                variant="secondary"
                size="small"
                onClick={handleCopySQL}
                icon={<Copy aria-hidden />}
              >
                {copySuccess ? 'Kopiert!' : 'Kopier'}
              </Button>
            </div>
            <div className="border border-gray-400 p-4">
              <pre className="overflow-x-auto whitespace-pre-wrap">
                {generatedSQL}
              </pre>
            </div>
            <Button
                variant="secondary"
                size="small"
                className="mt-2"
                onClick={handleCopySQL}
                icon={<Copy aria-hidden />}
              >
                {copySuccess ? 'Kopiert!' : 'Kopier'}
              </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default SQLGeneratorForm;
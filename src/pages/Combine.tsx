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
  Alert // Add this to imports at top
} from '@navikt/ds-react';
import { Copy } from 'lucide-react';

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
  const [eventName, setEventName] = useState<string>('');
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

  const addDataKey = (): void => {
    if (newDataKey && !dataKeys.includes(newDataKey)) {
      setDataKeys([...dataKeys, newDataKey]);
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

  const generateSQL = (): void => {
    setError(null);
    console.log('Selected website:', selectedWebsite);

    if (!selectedWebsite) {
      setError('Du må velge en nettside først');
      return;
    }

    if (queryType === 'custom') {
      if (!eventName) {
        setError('Du må skrive inn et event-navn');
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
      sql += '  WHERE e.event_name = \'' + eventName + '\'\n';
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
    if (queryType === 'custom' && !eventName) {
      return '⚠️ Skriv inn event-navn først for å se SQL-koden';
    }
    return `SELECT DISTINCT data_key
FROM \`team-researchops-prod-01d6.umami.public_event_data\` ed
JOIN \`team-researchops-prod-01d6.umami.public_website_event\` e
  ON ed.website_event_id = e.event_id
WHERE e.website_id = '${selectedWebsite.id}'
  ${eventName ? `AND e.event_name = '${eventName}'` : ''}
ORDER BY data_key`;
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
            <TextField
              label="Event-navn"
              description="Eksempel: skjema startet"
              value={eventName}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setEventName(e.target.value)}
            />
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
                    <pre className="overflow-x-auto whitespace-pre-wrap bg-white p-2 rounded">
                      {getEventLookupSQL()}
                    </pre>
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
                description="Eksempel: skjemanavn (legg til flere én og én)"
                value={newDataKey}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setNewDataKey(e.target.value)}
                onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addDataKey();
                  }
                }}
              />
              <Button 
                variant="secondary" 
                onClick={addDataKey} 
                style={{ height: '50px' }}
              >
                Legg til metadetalj
              </Button>
            </div>
            <details 
              className="text-sm"
              open={parameterSQLDetailsOpen}
              onToggle={(e) => setParameterSQLDetailsOpen(e.currentTarget.open)}
            >
              <summary className="cursor-pointer text-blue-500 hover:text-blue-600">
                Vis SQL-kode for å finne tilgjengelige metadetaljer i Metabase
              </summary>
              <div className="mt-2 p-3 bg-gray-50 rounded border">
                <div className="flex flex-col gap-3">
                  {(!queryType || (queryType === 'custom' && !eventName) || !selectedWebsite) ? (
                    <pre className="overflow-x-auto whitespace-pre-wrap bg-white p-2 rounded">
                      {getParameterLookupSQL()}
                    </pre>
                  ) : (
                    <>
                      <span className="text-gray-600">
                        Kjør denne spørringen i Metabase for å se tilgjengelige metadetaljer:
                      </span>
                      <div className="bg-white p-3 rounded border">
                        <pre className="overflow-x-auto whitespace-pre-wrap mb-2">
                          {getParameterLookupSQL()}
                        </pre>
                        <div className="flex justify-end space-x-2 border-t pt-2">
                          <Button
                            variant="secondary"
                            size="xsmall"
                            onClick={handleCopyParameterSQL}
                            icon={<Copy aria-hidden />}
                          >
                            {parameterSQLCopySuccess ? 'Kopiert!' : 'Kopier'}
                          </Button>
                          <Button
                            variant="secondary"
                            size="xsmall"
                            onClick={handleCloseParameterSQL}
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

          {/* Display added data keys */}
          <HGrid className="mt-4">
            {dataKeys.map((key) => (
              <div key={key}>
                <div className="flex items-center justify-between p-2 my-2 bg-gray-100 rounded">
                  <span>{key}</span>
                  <Button
                    variant="danger"
                    size="small"
                    onClick={() => removeDataKey(key)}
                  >
                    Fjern
                  </Button>
                </div>
              </div>
            ))}
          </HGrid>
        </div>

        <div>
          <Heading spacing level="2" size="small">
            Supplerende kolonner du kan legge til i modellen
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
import { useState, KeyboardEvent, ChangeEvent } from 'react';
import {
  Button,
  TextField,
  Checkbox,
  Heading,
  HGrid,
} from '@navikt/ds-react';
import { Copy } from 'lucide-react';

type BaseColumns = {
  [key: string]: boolean;
};

type PresetType = 'minimum' | 'alle';

type Presets = {
  [K in PresetType]: {
    [key: string]: boolean;
  };
};

const SQLGeneratorForm = () => {
  const [eventName, setEventName] = useState<string>('');
  const [websiteName, setWebsiteName] = useState<string>('');
  const [dataKeys, setDataKeys] = useState<string[]>([]);
  const [newDataKey, setNewDataKey] = useState<string>('');
  
  // All possible base columns
  const allBaseColumns: BaseColumns = {
    event_id: false,
    created_at: false,
    event_name: false,
    website_id: false,
    page_title: false,
    website_domain: false,
    url_path: false,
    url_query: false,
    url_fullpath: false,
    url_fullurl: false,
    referrer_domain: false,
    referrer_path: false,
    referrer_query: false,
    referrer_fullpath: false,
    referrer_fullurl: false,
    visit_id: false,
    session_id: false,
    browser: false,
    os: false,
    device: false,
    screen: false,
    language: false,
    country: false,
    subdivision1: false,
    city: false
  };

  const [baseColumns, setBaseColumns] = useState<BaseColumns>(allBaseColumns);
  const [generatedSQL, setGeneratedSQL] = useState<string>('');
  const [copySuccess, setCopySuccess] = useState<boolean>(false);

  // Preset column configurations
  const presets: Presets = {
    minimum: {
      event_id: true,
      created_at: true,
    },
    alle: Object.keys(allBaseColumns).reduce((acc, key) => ({...acc, [key]: true}), {})
  };

  const applyPreset = (presetName: PresetType): void => {
    const preset = presets[presetName];
    setBaseColumns({
      ...allBaseColumns,
      ...preset
    });
  };

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

  const generateSQL = (): void => {
    if (!eventName) {
      alert('Please enter an event name');
      return;
    }

    let sql = 'WITH base_query AS (\n';
    sql += '  SELECT *\n';
    sql += '  FROM `team-researchops-prod-01d6.umami.public_website_event`\n';
    sql += '  WHERE event_name = \'' + eventName + '\'\n';
    
    if (websiteName) {
      sql += '  AND website_id IN (\n';
      sql += '    SELECT website_id\n';
      sql += '    FROM `team-researchops-prod-01d6.umami.public_website`\n';
      sql += '    WHERE name = \'' + websiteName + '\'\n';
      sql += '  )\n';
    }
    
    sql += ')\n\n';
    sql += 'SELECT\n';
    
    // Add base columns
    const selectedBaseColumns = Object.entries(baseColumns)
      .filter(([_, isSelected]) => isSelected)
      .map(([column]) => `  base_query.${column} AS ${column}`);
    
    // Add data key columns - now all added keys are included
    const dataKeyColumns = dataKeys.map(key => 
      `  MAX(CASE WHEN event_data.data_key = '${key}' THEN event_data.string_value END) AS data_key_${key}`
    );
    
    const allColumns = [...selectedBaseColumns, ...dataKeyColumns];
    
    sql += allColumns.join(',\n');
    
    sql += '\nFROM base_query\n';
    sql += 'LEFT JOIN `team-researchops-prod-01d6.umami.public_event_data` AS event_data\n';
    sql += '  ON base_query.event_id = event_data.website_event_id\n';

    // Add GROUP BY if we have any data key columns
    if (dataKeyColumns.length > 0) {
      sql += 'GROUP BY\n  ' + selectedBaseColumns.map(col => col.split(' AS ')[0]).join(',\n  ');
    }

    setGeneratedSQL(sql);
  };

  return (
    <div className="w-full max-w-2xl">
      <Heading spacing level="1" size="medium" className="pt-6 pb-4">
        Umami Metabase eventrad kombinator
      </Heading>

      <div className="space-y-6">
        {/* Website Name Input */}
        <TextField
          label="website_name"
          value={websiteName}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setWebsiteName(e.target.value)}
          placeholder="e.g., aksel.nav.no"
        />

        {/* Event Name Input */}
        <TextField
          label="event_name"
          value={eventName}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setEventName(e.target.value)}
          placeholder="e.g., download"
        />

        {/* Data Keys Input */}
        <div>
          <div className="flex gap-2 items-end">
            <TextField
              label="data_keys"
              value={newDataKey}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setNewDataKey(e.target.value)}
              placeholder="e.g. file_name"
              onKeyPress={(e: KeyboardEvent<HTMLInputElement>) => {
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
            Legg til data_keys
            </Button>
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
                    Remove
                  </Button>
                </div>
              </div>
            ))}
          </HGrid>
        </div>

        {/* Base Columns with Presets */}
        <div>
          <div className="flex gap-2 mb-4">
            {Object.keys(presets).map((preset) => (
              <Button 
                key={preset}
                variant="secondary" 
                onClick={() => applyPreset(preset as PresetType)}
              >
                {preset.charAt(0).toUpperCase() + preset.slice(1)} kolonner
              </Button>
            ))}
          </div>

          <Heading spacing level="2" size="small">
            Tilgjengelige kolonner
          </Heading>
          <HGrid>
            {Object.entries(baseColumns).map(([column, isSelected]) => (
              <div key={column}>
                <Checkbox
                  checked={isSelected}
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

        <Button variant="primary" onClick={generateSQL}>
          Generer SQL-kode til Metabase-modell
        </Button>

        {generatedSQL && (
          <div>
            <div className="flex justify-between items-center mb-2">
              <Heading level="2" size="small">
                Generated SQL
              </Heading>
              <Button
                variant="secondary"
                size="small"
                onClick={handleCopySQL}
                icon={<Copy aria-hidden />}
              >
                {copySuccess ? 'Copied!' : 'Copy SQL'}
              </Button>
            </div>
            <div className="border border-gray-400 p-4">
              <pre className="overflow-x-auto whitespace-pre-wrap">
                {generatedSQL}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SQLGeneratorForm;
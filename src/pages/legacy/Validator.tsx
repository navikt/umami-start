import { useState, ChangeEvent } from 'react';
import {
  Button,
  Heading,
  Textarea,
  Alert,
  CopyButton,
} from '@navikt/ds-react';
import Kontaktboks from '../../components/theme/Kontaktboks/Kontaktboks';

interface ValidationError {
  type: 'error' | 'warning';
  message: string;
  fix?: () => string;
}

interface SuggestedFilter {
  name: string;
  description: string;
  example: string;
  matches?: string[];
}

const ValidatorPage = () => {
  const [sql, setSql] = useState<string>('');
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [fixedSQL, setFixedSQL] = useState<string>('');
  const [hasValidated, setHasValidated] = useState(false);
  const [suggestedFilters, setSuggestedFilters] = useState<SuggestedFilter[]>([]);
  const [lastAddedFilter, setLastAddedFilter] = useState<string | null>(null);
  const [appliedFilters, setAppliedFilters] = useState<Set<string>>(new Set());

  const validateSQL = (input: string): ValidationError[] => {
    const errors: ValidationError[] = [];

    // Add new check for lone AND after WHERE
    if (input.match(/WHERE\s+AND/i)) {
      errors.push({
        type: 'error',
        message: 'Invalid WHERE clause - remove the lone AND after WHERE',
        fix: () => input.replace(/WHERE\s+AND/i, 'WHERE')
      });
    }

    // Check for event_name being queried from event_data instead of directly
    if (input.match(/data_key\s*=\s*['"]event_name['"]/i) && input.match(/string_value\s*=\s*['"][^'"]+['"]/i)) {
      errors.push({
        type: 'error',
        message: 'Event names should be queried directly from website_event table, not from event_data',
        fix: () => {
          const eventNameMatch = input.match(/string_value\s*=\s*['"]([^'"]+)['"]/i);
          const eventName = eventNameMatch ? eventNameMatch[1] : '';
          
          return input
            // Remove the JOIN if only used for event_name
            .replace(/JOIN.*?event_data.*?website_event_id\n/i, '\n')
            // Remove the data_key and string_value conditions
            .replace(/\s+AND\s+ed\.data_key\s*=\s*['"]event_name['"]\s*\n/i, '\n')
            .replace(/\s+AND\s+ed\.string_value\s*=\s*['"][^'"]+['"]\s*\n/i, '\n')
            // Add the direct event_name condition
            .replace(
              /(WHERE\s+[^\n]*)\n/i, 
              `$1\n  AND we.event_name = '${eventName}'\n`
            )
            // Fix any potential double WHERE clauses or misplaced AND
            .replace(/WHERE\s+AND/i, 'WHERE')
            .replace(/\s+AND\s+AND\s+/i, ' AND ');
        }
      });
    }

    // Check for wrong variable syntax
    if (input.match(/\{{3,}.*\}{3,}/)) {
      errors.push({
        type: 'error',
        message: 'Too many curly braces in variables. Use exactly two: {{variable}}',
        fix: () => input.replace(/\{{3,}(.*?)\}{3,}/g, '{{$1}}')
      });
    }

    // Check for quoted variables
    if (input.match(/'{{.*?}}'/)) {
      errors.push({
        type: 'error',
        message: 'Variables should not be wrapped in quotes',
        fix: () => input.replace(/'{{(.*?)}}'/g, '{{$1}}')
      });
    }

    // Check for wrong field names
    if (input.match(/ed\.key\b/) || input.match(/ed\.value\b/)) {
      errors.push({
        type: 'error',
        message: 'Use data_key and string_value instead of key and value',
        fix: () => input
          .replace(/ed\.key\b/g, 'ed.data_key')
          .replace(/ed\.value\b/g, 'ed.string_value')
      });
    }

    // Check for missing event_type on custom events
    if (input.match(/event_name\s+IN/i) && !input.match(/event_type\s*=\s*2/i)) {
      errors.push({
        type: 'warning',
        message: 'Custom events should include event_type = 2 check',
        fix: () => input.replace(
          /(event_name\s+IN\s*\([^)]+\))/i,
          'event_type = 2 AND $1'
        )
      });
    }

    // Check for wrong table quoting
    if (input.match(/"team-researchops/i)) {
      errors.push({
        type: 'error',
        message: 'Use backticks (`) for table names, not double quotes',
        fix: () => input.replace(
          /"(team-researchops[^"]+)"/gi,
          '`$1`'
        )
      });
    }

    // Check for redundant event_name check in event_data
    if (input.match(/event_type\s*=\s*2/i) && 
        input.match(/data_key\s*=\s*['"]event_name['"]/i)) {
      errors.push({
        type: 'error',
        message: 'No need to check data_key="event_name" - use event_name column directly from website_event table',
        fix: () => {
          let fixed = input
            // Remove the JOIN if it's only used for event_name
            .replace(/JOIN.*?event_data.*?website_event_id\n/si, '')
            // Remove the event_name condition
            .replace(/AND\s+ed\.data_key\s*=\s*['"]event_name['"]\s*\n/i, '')
            // Remove the string_value condition and replace with direct event_name check
            .replace(/AND\s+ed\.string_value\s*=\s*['"]([^'"]+)['"]/gi, 'AND we.event_name = \'$1\'');
          return fixed;
        }
      });
    }

    // Modified date filter check with better WHERE clause handling
    if (!input.match(/created_at/i) && input.match(/GROUP BY/i)) {
      errors.push({
        type: 'warning',
        message: 'Consider adding a date filter (e.g., last 30 days) for better performance',
        fix: () => {
          const lines = input.split('\n');
          const whereIndex = lines.findIndex(line => line.trim().startsWith('WHERE'));
          
          if (whereIndex >= 0) {
            // Get the first condition after WHERE
            const whereClause = lines[whereIndex].trim();
            const firstCondition = lines[whereIndex + 1]?.trim() || '';

            if (whereClause === 'WHERE') {
              // If WHERE is alone on its line
              lines[whereIndex] = 'WHERE we.created_at >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 DAY)';
            } else if (whereClause !== 'WHERE' && !firstCondition.startsWith('AND')) {
              // If WHERE has a condition on same line
              const condition = whereClause.replace('WHERE', '').trim();
              lines[whereIndex] = `WHERE we.created_at >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 DAY)\n  AND ${condition}`;
            } else {
              // If WHERE is followed by AND conditions
              lines.splice(whereIndex + 1, 0, '  we.created_at >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 DAY) AND');
            }
            return lines.join('\n');
          }
          return input;
        }
      });
    }

    return errors;
  };

  const detectPossibleFilters = (sql: string): SuggestedFilter[] => {
    const filters: SuggestedFilter[] = [];

    // Check for static date conditions (any TIMESTAMP or date comparison)
    // But exclude SQL that already has the {{created_at}} variable
    if (
      (sql.match(/created_at\s*(>=|<=|=|>|<|BETWEEN)/i) || sql.match(/created_at.*TIMESTAMP/i)) && 
      !sql.match(/{{created_at}}/i)
    ) {
      filters.push({
        name: 'date_dynamic',
        description: 'Gjør datofeltet til et dynamisk Metabase-filter',
        example: 'AND {{created_at}}',
        // Don't store specific matches as we'll do a more targeted replacement
      });
    }

    // Check for static path conditions
    const pathMatches = sql.match(/url_path\s*=\s*['"][^'"]+['"]/g);
    if (pathMatches && !sql.match(/{{path}}/)) {
      filters.push({
        name: 'path',
        description: 'Gjør URL-stien til en variabel',
        example: 'url_path = {{path}}',
        matches: pathMatches
      });
    }

    return filters;
  };

  const applyFilter = (sql: string, filter: SuggestedFilter): string => {
    let newSQL = sql;

    switch (filter.name) {
      case 'date_dynamic':
        // First identify the complete date condition
        const dateConditionMatch = sql.match(
          /(?:AND\s+)(?:\w+\.)?created_at\s*(?:>=|<=|=|>|<|BETWEEN)(?:[^;{}\n]+?)(?=\s+(?:AND|OR|GROUP|ORDER|LIMIT|$))/i
        );
        
        if (dateConditionMatch && dateConditionMatch[0]) {
          // Replace the entire date condition with AND {{created_at}}
          newSQL = newSQL.replace(dateConditionMatch[0], 'AND {{created_at}}');
        } else {
          // If no specific match found, add it after WHERE
          const whereMatch = sql.match(/WHERE\s+([^\n]+)/i);
          if (whereMatch) {
            // Insert after the first WHERE condition
            newSQL = newSQL.replace(
              whereMatch[0],
              whereMatch[0] + '\n    AND {{created_at}}'
            );
          }
        }
        break;

      case 'path':
        // Replace each occurrence of url_path = 'specific-path'
        filter.matches?.forEach(match => {
          const path = match.match(/['"]([^'"]+)['"]/)?.[1];
          if (path) {
            newSQL = newSQL.replace(
              new RegExp(`url_path\\s*=\\s*['"]${path}['"]`, 'g'),
              `url_path = {{path}}`
            );
          }
        });
        break;
    }

    // Track that this filter has been applied
    setAppliedFilters(prev => new Set([...prev, filter.name]));
    setLastAddedFilter(filter.name);
    setTimeout(() => setLastAddedFilter(null), 3000);
    
    return newSQL;
  };

  // Reset applied filters when SQL changes
  const handleSQLChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setSql(e.target.value);
    setAppliedFilters(new Set()); // Reset when SQL changes
  };

  const handleValidate = () => {
    setHasValidated(true);
    const errors = validateSQL(sql);
    setValidationErrors(errors);

    if (errors.length > 0) {
      let fixedCode = sql;
      errors.forEach(error => {
        if (error.fix) {
          fixedCode = error.fix();
        }
      });
      setFixedSQL(fixedCode);
    } else {
      // Don't show the fixed SQL if there are no errors
      setFixedSQL('');
    }

    // After validation, check for possible filters
    const possibleFilters = detectPossibleFilters(sql);
    setSuggestedFilters(possibleFilters);
  };

  const generateAIFeedback = (errors: ValidationError[]): string => {
    return `Please fix these issues in the SQL query:
${errors.map(error => `- ${error.message}`).join('\n')}`;
  };

  return (
    <div className="w-full max-w-2xl">
      <Heading spacing level="1" size="medium" className="pt-12 pb-6">
        Valider Metabase SQL-kode
      </Heading>

      <p className="text-gray-600 mb-10">
        Lim inn SQL-koden du har fått fra AI-assistenten her, så sjekker vi at alt er riktig formatert for Metabase.
      </p>

      <div className="space-y-8">
        <Textarea
          label="SQL-kode"
          description="Lim inn SQL-koden her"
          value={sql}
          onChange={handleSQLChange}
          rows={10}
        />

        <Button
          variant="primary"
          onClick={handleValidate}
          disabled={!sql.trim()}
        >
          Valider SQL
        </Button>

        {hasValidated && (
          <>
            {validationErrors.length > 0 ? (
              <div className="space-y-4">
                <Heading level="2" size="small">
                  Feil og advarsler
                </Heading>

                <div className="bg-white p-4 rounded border">
                  <p className="text-sm text-gray-600 mb-4">
                    Kopier denne tilbakemeldingen og send den til AI-assistenten for å få hjelp til å fikse problemene:
                  </p>
                  <div className="relative">
                    <pre className="bg-gray-50 p-4 rounded overflow-x-auto whitespace-pre-wrap">
                      {generateAIFeedback(validationErrors)}
                    </pre>
                    <div className="absolute top-2 right-2">
                      <CopyButton
                        copyText={generateAIFeedback(validationErrors)}
                        text="Kopier tilbakemelding"
                        activeText="Kopiert!"
                        size="small"
                      />
                    </div>
                  </div>
                </div>
                
                {validationErrors.map((error, index) => (
                  <Alert
                    key={index}
                    variant={error.type === 'error' ? 'error' : 'warning'}
                  >
                    {error.message}
                  </Alert>
                ))}

                {fixedSQL && (
                  <div>
                    <Heading level="2" size="small" spacing>
                      Korrigert SQL-kode
                    </Heading>
                    <div className="relative">
                      <pre className="bg-gray-50 p-4 rounded overflow-x-auto whitespace-pre-wrap">
                        {fixedSQL}
                      </pre>
                      <div className="absolute top-2 right-2">
                        <CopyButton
                          copyText={fixedSQL}
                          text="Kopier SQL"
                          activeText="Kopiert!"
                          size="small"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <Alert variant="success">
                  SQL-koden ser bra ut! Den burde fungere i Metabase.
                </Alert>

                {suggestedFilters.length > 0 && (
                  <div className="mt-4">
                    <Heading level="2" size="small" spacing>
                      Foreslåtte Metabase-filtre
                    </Heading>
                    <p className="text-sm text-gray-600 mb-4">
                      Du kan gjøre spørringen mer dynamisk ved å legge til disse filtrene:
                    </p>
                    <div className="space-y-4">
                      {suggestedFilters
                        .filter(filter => !appliedFilters.has(filter.name))
                        .map((filter, index) => (
                          <div key={index} className="p-4 bg-gray-50 rounded border">
                            <div className="flex justify-between items-start mb-2">
                              <div>
                                <strong>{filter.name}</strong>
                                <p className="text-sm text-gray-600">{filter.description}</p>
                                <pre className="text-xs bg-white p-2 mt-2 rounded">
                                  {filter.example}
                                </pre>
                                {lastAddedFilter === filter.name && (
                                  <Alert variant="success" size="small" className="mt-2">
                                    Filter lagt til i SQL-koden ✓
                                  </Alert>
                                )}
                              </div>
                              <Button
                                variant="secondary"
                                size="small"
                                onClick={() => {
                                  const newSQL = applyFilter(sql, filter);
                                  setSql(newSQL);
                                  setFixedSQL(newSQL);
                                  handleValidate();
                                }}
                              >
                                Legg til filter
                              </Button>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        <Kontaktboks />
      </div>
    </div>
  );
};

export default ValidatorPage;

import { Button, Heading,  TextField, HelpText, Tag, Table } from '@navikt/ds-react';
import { useState, useEffect, useRef } from 'react';
import { Filter, Parameter, MetabaseVariable } from '../../types/chart';
import { Trash2, Plus, Check } from 'lucide-react';
import AlertWithCloseButton from './AlertWithCloseButton';
import { FILTER_COLUMNS } from '../../lib/constants';

interface MetabaseVariablesProps {
  variables: MetabaseVariable[];
  setVariables: (variables: MetabaseVariable[]) => void;
  parameters: Parameter[];
  availableEvents?: string[];
  filters: Filter[];
  groupByFields: string[];
  sanitizeColumnName: (key: string) => string;
  generatedSQL: string; // Add this to access the current SQL
  setGeneratedSQL: (sql: string) => void; // Add this to update the SQL directly
}

const MetabaseVariables = ({
  variables,
  setVariables,
  parameters,
  filters,
  groupByFields,
  sanitizeColumnName,
  generatedSQL,
  setGeneratedSQL
}: MetabaseVariablesProps) => {
  const [alertInfo, setAlertInfo] = useState<{show: boolean, message: string}>({
    show: false,
    message: ''
  });

  // Add this ref to track if changes should be committed to parent
  const [localSQL, setLocalSQL] = useState<string>('');
  const independentUpdate = useRef(false);
  const lastVariables = useRef<MetabaseVariable[]>([]);

  // Add this useEffect to manage SQL synchronization
  useEffect(() => {
    // Only update local SQL when generatedSQL changes from parent
    if (generatedSQL !== localSQL && !independentUpdate.current) {
      // Apply any existing variables to the new SQL from parent
      let processedSQL = generatedSQL;
      variables.forEach(variable => {
        // Apply appropriate transformations based on variable type
        if (variable.type === 'field_filter' && variable.column === 'url_path') {
          // Handle URL path specially to avoid syntax issues
          const urlPattern = /AND\s+e\.url_path\s+(IN\s*\([^)]+\)|=\s*'[^']+'|LIKE\s+'%[^']+')\s*/g;
          if (urlPattern.test(processedSQL)) {
            processedSQL = processedSQL.replace(
              urlPattern, 
              `AND e.url_path = {{${variable.name}}}`
            );
          }
        }
        // Add other variable types here
      });
      
      setLocalSQL(processedSQL);
    }
    
    // Reset the independent update flag
    independentUpdate.current = false;
    
    // Store current variables for comparison
    lastVariables.current = variables;
  }, [generatedSQL, variables]);

  // Get suggested variables based on chart configuration
  const getSuggestedVariables = (): {
    type: string;
    name: string;
    displayName: string;
    description: string;
    source: string;
    existingVariable?: MetabaseVariable;
  }[] => {
    const suggestions: {
      type: string;
      name: string;
      displayName: string;
      description: string;
      source: string;
      existingVariable?: MetabaseVariable;
    }[] = [];
    
    // Check for date filters
    const dateFilters = filters.filter(f => f.column === 'created_at');
    if (dateFilters.length > 0) {
      // Look for existing variable for date
      const existingDateVar = variables.find(v => 
        v.type === 'date' || 
        (v.type === 'field_filter' && v.column === 'created_at')
      );
      
      suggestions.push({
        type: 'date',
        name: 'date_range',
        displayName: 'Datoperiode',
        description: 'Lar brukere velge tidsperiode for dataene',
        source: 'date_filter',
        existingVariable: existingDateVar
      });
    }

    // Check for event name filters
    const eventFilters = filters.filter(f => f.column === 'event_name');
    if (eventFilters.length > 0) {
      // Look for existing variable for event names
      const existingEventVar = variables.find(v => 
        (v.type === 'text' && v.name.includes('event')) || 
        (v.type === 'field_filter' && v.column === 'event_name')
      );
      
      suggestions.push({
        type: 'event',
        name: 'event_name_filter',
        displayName: 'Hendelsestype',
        description: 'Lar brukere velge hvilke hendelser som skal vises',
        source: 'event_filter',
        existingVariable: existingEventVar
      });
    }

    // Check for URL path filters
    const urlFilters = filters.filter(f => f.column === 'url_path');
    if (urlFilters.length > 0) {
      // Look for existing variable for URL paths
      const existingUrlVar = variables.find(v => 
        (v.type === 'text' && v.name.includes('url')) || 
        (v.type === 'field_filter' && v.column === 'url_path')
      );
      
      suggestions.push({
        type: 'url',
        name: 'url_path_filter',
        displayName: 'URL-sti',
        description: 'Lar brukere velge hvilke sider som skal vises',
        source: 'url_filter',
        existingVariable: existingUrlVar
      });
    }

    // Check for custom parameter filters
    const paramFilters = filters.filter(f => f.column.startsWith('param_'));
    paramFilters.forEach(filter => {
      const paramName = filter.column.replace('param_', '');
      const param = parameters.find(p => sanitizeColumnName(getCleanParamName(p)) === paramName);
      
      if (param) {
        // Look for existing variable for this parameter
        const existingParamVar = variables.find(v => 
          (v.type === 'text' && v.name.includes(paramName)) || 
          (v.type === 'field_filter' && v.column === filter.column)
        );
        
        suggestions.push({
          type: param.type === 'number' ? 'number' : 'text',
          name: `param_${paramName}`,
          displayName: getCleanParamName(param),
          description: `Lar brukere filtrere på parameter "${getCleanParamName(param)}"`,
          source: 'parameter',
          existingVariable: existingParamVar
        });
      }
    });

    // Check for group by fields that could be useful as limits
    groupByFields.forEach(field => {
      if (field !== 'created_at' && !field.startsWith('param_')) {
        // Find the display name
        let displayName = field;
        
        Object.values(FILTER_COLUMNS).forEach(group => {
          group.columns.forEach(col => {
            if (col.value === field) {
              displayName = col.label;
            }
          });
        });
        
        // Look for existing variable for this field
        const existingFieldVar = variables.find(v => 
          (v.type === 'field_filter' && v.column === field)
        );
        
        if (!existingFieldVar) {
          suggestions.push({
            type: 'groupby',
            name: `filter_${field}`,
            displayName,
            description: `Lar brukere filtrere på ${displayName}`,
            source: 'groupby',
            existingVariable: existingFieldVar
          });
        }
      }
    });

    return suggestions;
  };

  // Add a suggested variable and update SQL
  const addSuggestedVariable = (suggestion: { 
    type: string; 
    name: string; 
    source: string;
  }) => {
    let newVariable: MetabaseVariable = {
      name: suggestion.name,
      type: suggestion.type as 'text' | 'number' | 'date' | 'field_filter',
      widgetType: 'input',
      defaultValue: '',
      valuesSource: 'custom_list',
      customValues: []
    };

    // Set up variable based on type
    if (suggestion.type === 'field_filter') {
      newVariable = {
        ...newVariable,
        type: 'field_filter',
        column: suggestion.name.replace('filter_', ''),
        widgetType: 'dropdown',
        valuesSource: 'from_data',
        dataSource: suggestion.name.includes('event') ? 'event_names' : 'url_paths'
      };
    }

    // Add the variable to the state
    setVariables([...variables, newVariable]);
    
    // Rest of the function remains the same
    let sqlTransformation: { search: RegExp | string, replace: string } | null = null;
    
    // Set up variable based on type
    if (suggestion.type === 'date') {
      newVariable = {
        name: 'date_range',
        type: 'date',
        widgetType: 'input',
        defaultValue: '',
        valuesSource: 'custom_list',
        customValues: []
      };
      
      // Find date range filters in SQL and replace them with the variable
      const dateRangePattern = /AND e\.created_at (>=|<=|>|<) '([^']+)'/g;
      sqlTransformation = {
        search: dateRangePattern,
        replace: `AND e.created_at $1 {{${newVariable.name}}}`
      };
      
    } else if (suggestion.type === 'event') {
      // Create a field filter for event name
      newVariable = {
        name: 'event_name_filter',
        type: 'field_filter',
        column: 'event_name',
        fieldName: 'Hendelsesnavn',
        widgetType: 'dropdown',
        defaultValue: '',
        valuesSource: 'from_data',
        dataSource: 'event_names',
        customValues: []
      };
      
      // Find event name filters in SQL and replace them with the variable
      const eventPattern = /AND e\.event_name (IN \([^)]+\)|=|LIKE) ('.*?'|%.*?%)/g;
      sqlTransformation = {
        search: eventPattern,
        replace: `AND e.event_name = {{${newVariable.name}}}`
      };
      
    } else if (suggestion.type === 'url') {
      // Create a field filter for URL path
      newVariable = {
        name: 'url_path_filter',
        type: 'field_filter',
        column: 'url_path',
        fieldName: 'URL-sti',
        widgetType: 'dropdown',
        defaultValue: '',
        valuesSource: 'from_data',
        dataSource: 'url_paths',
        customValues: []
      };
      
      const urlPattern = /AND\s+e\.url_path\s+(IN\s+\([^)]+\)|=|LIKE)\s+([^)\n]+)/g;
      sqlTransformation = {
        search: urlPattern,
        replace: `AND e.url_path = {{${newVariable.name}}}`
      };
      
    } else if (suggestion.type === 'groupby') {
      // Create a field filter for the group by field
      newVariable = {
        name: suggestion.name,
        type: 'field_filter',
        column: suggestion.source === 'groupby' ? suggestion.name.replace('filter_', '') : suggestion.name,
        widgetType: 'dropdown',
        defaultValue: '',
        valuesSource: 'connected_field',
        customValues: []
      };
      
      // Find field filters in SQL and replace them with the variable
      const columnName = suggestion.source === 'groupby' ? suggestion.name.replace('filter_', '') : suggestion.name;
      const fieldPattern = new RegExp(`AND (base_query|e)\.${columnName} (IN \\([^)]+\\)|=|LIKE) ('.*?'|%.*?%)`, 'g');
      sqlTransformation = {
        search: fieldPattern,
        replace: `AND $1.${columnName} = {{${newVariable.name}}}`
      };
      
    } else {
      // Default for parameters and other types
      newVariable = {
        name: suggestion.name,
        type: suggestion.type === 'number' ? 'number' : 'text',
        widgetType: 'input',
        defaultValue: '',
        valuesSource: 'custom_list',
        customValues: []
      };
      
      // Find parameter filters in SQL and replace them with the variable
      const paramPattern = new RegExp(`AND e\\.${suggestion.name} (IN \\([^)]+\\)|=|LIKE) ('.*?'|%.*?%)`, 'g');
      sqlTransformation = {
        search: paramPattern,
        replace: `AND e.${suggestion.name} = {{${newVariable.name}}}`
      };
    }
    
    // Add the variable to the state
    setVariables([...variables, newVariable]);
    
    // Transform the SQL if a transformation was defined
    if (sqlTransformation && generatedSQL) {
      let newSQL = generatedSQL;
      
      // Log what we're trying to match and replace for debugging
      console.log('Looking for pattern:', sqlTransformation.search);
      console.log('In SQL:', generatedSQL);
      
      // If we didn't find a direct match, try making it optional with [[...]]
      if (sqlTransformation.search instanceof RegExp) {
        const matches = generatedSQL.match(sqlTransformation.search);
        console.log('Matches found:', matches);
        
        if (!matches) {
          // Convert the replace to be wrapped in optional syntax
          const optionalReplace = `[[${sqlTransformation.replace}]]`;
          
          // Add the optional clause before the GROUP BY, ORDER BY, or end of query
          const insertPoint = generatedSQL.search(/(GROUP BY|ORDER BY|LIMIT|\n\n)/i);
          
          if (insertPoint > 0) {
            newSQL = generatedSQL.slice(0, insertPoint) + 
                     '\n' + optionalReplace + '\n' + 
                     generatedSQL.slice(insertPoint);
          }
        } else {
          // Replace the existing pattern
          newSQL = generatedSQL.replace(sqlTransformation.search, sqlTransformation.replace);
        }
      }
      
      // Remove any Metabase Variables comment sections
      newSQL = newSQL.replace(/\n\n-- Metabase Variables[\s\S]*$/, '');
      
      // Update both the local SQL and the parent's SQL
      setGeneratedSQL(newSQL);
    }
    
    // Auto-hide alert after 5 seconds
    setTimeout(() => {
      setAlertInfo(prev => ({...prev, show: false}));
    }, 5000);
  };

  // Helper function to get clean parameter name
  const getCleanParamName = (param: Parameter): string => {
    const parts = param.key.split('.');
    return parts[parts.length - 1]; // Get last part after dot
  };


  // Remove a variable and update SQL
  const removeVariable = (index: number) => {
    const variableToRemove = variables[index];
    const newVariables = [...variables];
    newVariables.splice(index, 1);
    setVariables(newVariables);
    
    // Try to remove the variable from the SQL
    if (generatedSQL && variableToRemove) {
      const varPattern = new RegExp(`\\{\\{${variableToRemove.name}\\}\\}`, 'g');
      
      // Replace direct variable references
      let newSQL = generatedSQL.replace(varPattern, "''");
      
      // Try to remove optional clauses containing this variable
      const optionalPattern = new RegExp(`\\[\\[(.*?)\\{\\{${variableToRemove.name}\\}\\}(.*?)\\]\\]`, 'g');
      newSQL = newSQL.replace(optionalPattern, '');
      
      // Update the SQL
      setGeneratedSQL(newSQL);
    }
    
    // Show alert
    setAlertInfo({
      show: true,
      message: 'Variabel fjernet fra SQL-koden'
    });
    
    // Auto-hide alert after 5 seconds
    setTimeout(() => {
      setAlertInfo(prev => ({...prev, show: false}));
    }, 5000);
  };

  // Update a variable
  const updateVariable = (index: number, updates: Partial<MetabaseVariable>) => {
    const oldVariable = variables[index];
    const newVariables = variables.map((variable, i) => {
      if (i === index) {
        return { ...variable, ...updates };
      }
      return variable;
    });
    
    setVariables(newVariables);
    
    // Update the variable name in the SQL if it changed
    if (updates.name && oldVariable.name !== updates.name && generatedSQL) {
      const varPattern = new RegExp(`\\{\\{${oldVariable.name}\\}\\}`, 'g');
      const newSQL = generatedSQL.replace(varPattern, `{{${updates.name}}}`);
      setGeneratedSQL(newSQL);
    }
  };

  // Auto-suggest field name based on column selection
  useEffect(() => {
    variables.forEach((variable, index) => {
      if (variable.type === 'field_filter' && variable.column && !variable.fieldName) {
        // Find the column display name
        let displayName = '';
        
        // Check in standard columns
        Object.values(FILTER_COLUMNS).forEach(group => {
          group.columns.forEach(col => {
            if (col.value === variable.column) {
              displayName = col.label;
            }
          });
        });
        
        // Check in parameters
        if (!displayName && variable.column.startsWith('param_')) {
          const paramName = variable.column.replace('param_', '');
          const param = parameters.find(p => sanitizeColumnName(getCleanParamName(p)) === paramName);
          if (param) {
            displayName = getCleanParamName(param);
          }
        }
        
        if (displayName) {
          updateVariable(index, { fieldName: displayName });
        }
      }
    });
  }, [variables, parameters]);

  // Get suggested variables
  const suggestedVariables = getSuggestedVariables();

  return (
    <section>
      <div className="flex justify-between items-center">
        <div className="mb-4 flex items-center gap-2">
          <Heading level="2" size="small">
            Gjør grafen/tabellen interaktiv
          </Heading>
          <HelpText title="Hva betyr interaktiv?">
            Metabase-variabler erstatter faste verdier i spørringen med interaktive filtre i Metabase-dashboards.
            Brukere kan da filtrere dataene direkte i dashboards.
          </HelpText>
        </div>
      </div>

      <div className="space-y-6 bg-gray-50 p-5 rounded-lg border shadow-sm relative">
        {/* Show alert if active - position it fixed to avoid scrolling */}
        {alertInfo.show && (
          <div className="sticky top-0 z-10 mb-4">
            <AlertWithCloseButton variant="success">
              {alertInfo.message}
            </AlertWithCloseButton>
          </div>
        )}

        {/* Suggested variables section */}
        {suggestedVariables.length > 0 && (
          <div className="mb-6">
            <Heading level="3" size="xsmall" spacing>
              Foreslåtte filter-variabler
            </Heading>
            <p className="text-sm text-gray-600 mb-3">
              Basert på grafen/tabellen du har laget, kan du legge til disse variablene:
            </p>
            
            <Table size="small">
              <Table.Header>
                <Table.Row>
                  <Table.HeaderCell scope="col">Variabel</Table.HeaderCell>
                  <Table.HeaderCell scope="col">Beskrivelse</Table.HeaderCell>
                  <Table.HeaderCell scope="col" className="w-[120px] text-right">Handling</Table.HeaderCell>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {suggestedVariables.map((suggestion, index) => (
                  <Table.Row key={index}>
                    <Table.DataCell>
                      <div className="font-medium">{suggestion.displayName}</div>
                      <div className="text-xs text-gray-600">
                        {suggestion.type === 'date' ? 'Dato' : 
                         suggestion.type === 'number' ? 'Tall' : 
                         suggestion.type === 'event' ? 'Hendelsestype' :
                         suggestion.type === 'url' ? 'URL-sti' : 
                         suggestion.type === 'groupby' ? 'Feltfilter' : 'Tekst'}
                      </div>
                    </Table.DataCell>
                    <Table.DataCell>{suggestion.description}</Table.DataCell>
                    <Table.DataCell className="text-right">
                      {suggestion.existingVariable ? (
                        <Tag size="small" variant="success">
                          Lagt til
                        </Tag>
                      ) : (
                        <div>
                          <Button
                            variant="secondary"
                            size="small"
                            onClick={() => addSuggestedVariable(suggestion)}
                            icon={<Plus size={16} />}
                          >
                            Legg til
                          </Button>
                          
                          {/* Show inline alerts next to buttons for improved UX */}
                          {alertInfo.show && suggestion.name === 'url_path_filter' && (
                            <span className="ml-2 text-sm text-green-600 font-medium inline-flex items-center">
                              <Check size={16} className="mr-1" /> Lagt til
                            </span>
                          )}
                        </div>
                      )}
                    </Table.DataCell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table>
          </div>
        )}

        {/* Active variables list */}
        {variables.length > 0 && (
          <div className="mb-6">
            <div className="mb-3">
              <Heading level="3" size="xsmall">
                Aktive variabler
              </Heading>
            </div>
            
            <div className="space-y-4">
              {variables.map((variable, index) => (
                <div key={index} className="bg-white p-4 rounded-md border">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center">
                      <span className="text-sm bg-gray-100 px-2 py-1 rounded-md text-blue-900 font-medium mr-2">
                        {index + 1}
                      </span>
                      {variable.name}
                    </div>
                    <Button
                      variant="tertiary-neutral"
                      size="small"
                      icon={<Trash2 size={16} />}
                      onClick={() => removeVariable(index)}
                    >
                      Fjern
                    </Button>
                  </div>

                  <div>
                    <div className="flex flex-wrap gap-2 mb-3">
                      <Tag variant="info" size="small">
                        {variable.type === 'field_filter' ? 'Feltfilter' : 
                         variable.type === 'date' ? 'Dato' : 
                         variable.type === 'number' ? 'Tall' : 'Tekst'}
                      </Tag>
                      
                      {variable.type === 'field_filter' && variable.column && (
                        <Tag variant="neutral" size="small">
                          Koblet til: {variable.fieldName || variable.column}
                        </Tag>
                      )}
                    </div>
                    
                    <TextField
                        label="Variabelnavn"
                        value={variable.name}
                        onChange={(e) => updateVariable(index, { name: e.target.value })}
                        size="small"
                      />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {variables.length === 0 && suggestedVariables.length === 0 && (
          <div className="p-4 bg-white border rounded-md text-gray-600">
            <p>Ingen interaktive filter-variabler kunne opprettes automatisk. Legg til flere filtre for å generere forslag.</p>
          </div>
        )}
        
      </div>
    </section>
  );
};

export default MetabaseVariables;

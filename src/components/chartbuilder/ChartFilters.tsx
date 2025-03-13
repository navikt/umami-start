import { Button, Heading, Select, TextField, UNSAFE_Combobox } from '@navikt/ds-react';
import { useMemo } from 'react';
import { Filter, Parameter } from '../../types/chart';
import { FILTER_COLUMNS, OPERATORS } from '../../lib/constants';

interface ChartFiltersProps {
  filters: Filter[];
  parameters: Parameter[];
  setFilters: (filters: Filter[]) => void;
  availableEvents?: string[];
}

const ChartFilters = ({
  filters,
  parameters,
  setFilters,
  availableEvents = []
}: ChartFiltersProps) => {

  const addFilter = () => {
    setFilters([...filters, { column: 'url_path', operator: '=', value: '' }]);
  };

  const removeFilter = (index: number) => {
    setFilters(filters.filter((_, i) => i !== index));
  };

  const updateFilter = (index: number, updates: Partial<Filter>) => {
    setFilters(filters.map((filter, i) => 
      i === index ? { ...filter, ...updates } : filter
    ));
  };

  // Helper function to get clean parameter name
  const getCleanParamName = (param: Parameter): string => {
    const parts = param.key.split('.');
    return parts[parts.length - 1]; // Get last part after dot
  };

  // Helper function to get parameter display name
  const getParamDisplayName = (param: Parameter): string => {
    const parts = param.key.split('.');
    return parts[parts.length - 1]; // Show only the parameter name, not the event prefix
  };

  // Create a Set to track unique parameters
  const uniqueParameters = useMemo(() => {
    const seen = new Set();
    return parameters.filter(param => {
      const cleanName = param.key.split('.').pop() || '';
      if (seen.has(cleanName)) {
        return false;
      }
      seen.add(cleanName);
      return true;
    });
  }, [parameters]);

  // Helper to check if a filter is using event_name with multiple values
  const isMultiEventFilter = (filter: Filter): boolean => {
    return filter.column === 'event_name' && filter.multipleValues && filter.multipleValues.length > 0;
  };

  return (
    <section>
      <Heading level="2" size="small" spacing>
        Filtrering
      </Heading>

      <div className="space-y-6 bg-gray-50 p-5 rounded-md border relative">
        {/* Static Filters */}
        <div>
          <Heading level="3" size="xsmall" spacing>
            Legg til statiske filter
          </Heading>
          <p className="text-sm text-gray-600 mb-4">
            Statiske filtre er låst til grafen eller tabellen du lager.
          </p>

          {filters.length > 0 && (
            <div className="space-y-3 mb-4">
              {filters.map((filter, index) => (
                <div key={index} className="flex gap-2 items-end bg-white p-3 rounded-md border">
                  <Select
                    label="Kolonne"
                    value={filter.column}
                    onChange={(e) => updateFilter(index, { column: e.target.value, operator: '=', value: '' })}
                    size="small"
                  >
                    {Object.entries(FILTER_COLUMNS).map(([groupKey, group]) => (
                      <optgroup key={groupKey} label={group.label}>
                        {group.columns.map(col => (
                          <option key={col.value} value={col.value}>
                            {col.label}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                    
                    {parameters.length > 0 && (
                      <optgroup label="Egendefinerte parametere">
                        {uniqueParameters.map(param => (
                          <option 
                            key={`param_${param.key}`} 
                            value={`param_${getCleanParamName(param)}`}
                          >
                            {getParamDisplayName(param)}
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </Select>

                  <Select
                    label="Operator"
                    value={filter.operator}
                    onChange={(e) => updateFilter(index, { operator: e.target.value, value: '' })}
                    size="small"
                  >
                    {OPERATORS.map(op => (
                      <option key={op.value} value={op.value}>
                        {op.label}
                      </option>
                    ))}
                  </Select>

                  {!['IS NULL', 'IS NOT NULL'].includes(filter.operator) && (
                    filter.column === 'event_name' ? (
                      <div style={{ flex: 1 }}>
                        <UNSAFE_Combobox
                          label="Event navn"
                          options={availableEvents.map(event => ({
                            label: event || '',
                            value: event || ''
                          }))}
                          selectedOptions={filter.multipleValues?.map(v => v || '') || 
                                          (filter.value ? [filter.value] : [])}
                          onToggleSelected={(option, isSelected) => {
                            if (option) {
                              const currentValues = filter.multipleValues || 
                                                   (filter.value ? [filter.value] : []);
                              const newValues = isSelected 
                                ? [...currentValues, option]
                                : currentValues.filter(val => val !== option);
                              
                              updateFilter(index, { 
                                multipleValues: newValues.length > 0 ? newValues : [],
                                // Keep a single value for backward compatibility
                                value: newValues.length > 0 ? newValues[0] : '' 
                              });
                            }
                          }}
                          isMultiSelect
                          size="small"
                          clearButton
                        />
                      </div>
                    ) : (
                      <TextField
                        label="Verdi"
                        value={filter.value || ''}
                        onChange={(e) => updateFilter(index, { value: e.target.value })}
                        size="small"
                      />
                    )
                  )}

                  <Button
                    variant="tertiary-neutral"
                    size="small"
                    onClick={() => removeFilter(index)}
                    className="mb-1"
                  >
                    Fjern
                  </Button>
                </div>
              ))}
            </div>
          )}

          <Button
            variant="secondary"
            onClick={addFilter}
            size="small"
            className="mb-2"
          >
            Legg til filter
          </Button>
        </div>
      </div>
    </section>
  );
};

export default ChartFilters;

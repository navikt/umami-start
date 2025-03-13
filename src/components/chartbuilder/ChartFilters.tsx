import { Button, Heading, Select, TextField, UNSAFE_Combobox } from '@navikt/ds-react';
import { useMemo, useState, useEffect } from 'react';
import { Filter, Parameter } from '../../types/chart';
import { FILTER_COLUMNS, OPERATORS } from '../../lib/constants';

// Time unit options for custom period
const TIME_UNITS = [
  { label: 'Minutter', value: 'MINUTE' },
  { label: 'Timer', value: 'HOUR' },
  { label: 'Dager', value: 'DAY' },
  { label: 'Uker', value: 'WEEK' },
  { label: 'Måneder', value: 'MONTH' }
];

// Modified interface to receive date range info
interface ChartFiltersProps {
  filters: Filter[];
  parameters: Parameter[];
  setFilters: (filters: Filter[]) => void;
  availableEvents?: string[];
  maxDaysAvailable?: number; // Added this prop to receive date range info
}

const ChartFilters = ({
  filters,
  parameters,
  setFilters,
  availableEvents = [],
  maxDaysAvailable = 365 // Default to a year if not provided
}: ChartFiltersProps) => {

  // Add state for custom period inputs
  const [customPeriodInputs, setCustomPeriodInputs] = useState<Record<number, {amount: string, unit: string}>>({});

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

  // Initialize custom period for created_at filters
  useEffect(() => {
    filters.forEach((filter, index) => {
      if (filter.column === 'created_at' && !customPeriodInputs[index]) {
        // Set a sensible default - 7 days or maxDaysAvailable, whichever is smaller
        const defaultDays = Math.min(7, maxDaysAvailable);
        
        setCustomPeriodInputs(prev => ({
          ...prev,
          [index]: { amount: defaultDays.toString(), unit: 'DAY' }
        }));
        
        // Set initial SQL value if not already set
        if (!filter.value || !filter.operator) {
          const sql = `TIMESTAMP_ADD(CURRENT_TIMESTAMP(), INTERVAL -${defaultDays} DAY)`;
          updateFilter(index, {
            operator: '>=', // Default to >= for date filters
            value: sql
          });
        }
      }
    });
  }, [filters, maxDaysAvailable]);

  // Update custom period values
  const updateCustomPeriod = (index: number, field: 'amount' | 'unit', value: string) => {
    const currentValues = customPeriodInputs[index] || { amount: '7', unit: 'DAY' };
    const newValues = { ...currentValues, [field]: value };
    
    setCustomPeriodInputs({
      ...customPeriodInputs,
      [index]: newValues
    });
    
    // Also update the SQL in the filter
    const amount = parseInt(newValues.amount) || 1;
    const sql = `TIMESTAMP_ADD(CURRENT_TIMESTAMP(), INTERVAL -${amount} ${newValues.unit})`;
    
    updateFilter(index, {
      value: sql
    });
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
                <div key={index} className="bg-white p-3 rounded-md border">
                  <div className="flex justify-between">
                    <div className="flex-1">
                      <div className="flex gap-2 items-end">
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
                            <optgroup label="Egendefinerte">
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

                        {/* Only show operator dropdown for non-created_at columns */}
                        {filter.column !== 'created_at' && filter.column !== 'event_name' && (
                          <Select
                            label="Operator"
                            value={filter.operator || '='}
                            onChange={(e) => updateFilter(index, { operator: e.target.value, value: '' })}
                            size="small"
                          >
                            {OPERATORS.map(op => (
                              <option key={op.value} value={op.value}>
                                {op.label}
                              </option>
                            ))}
                          </Select>
                        )}
                        
                        {!['IS NULL', 'IS NOT NULL'].includes(filter.operator || '') && 
                         filter.column !== 'event_name' && 
                         filter.column !== 'created_at' && (
                          <TextField
                            label="Verdi"
                            value={filter.value || ''}
                            onChange={(e) => updateFilter(index, { value: e.target.value })}
                            size="small"
                          />
                        )}
                      </div>
                      
                      {/* Simplified Date Input for created_at */}
                      {filter.column === 'created_at' && (
                        <div className="mt-3">
                          <div className="flex items-end gap-2">
                            <TextField
                              label="Tid tilbake"
                              value={customPeriodInputs[index]?.amount || '7'}
                              onChange={(e) => updateCustomPeriod(index, 'amount', e.target.value)}
                              type="number"
                              min="1"
                              max={(customPeriodInputs[index]?.unit || 'DAY') === 'DAY' ? maxDaysAvailable : undefined}
                              size="small"
                              className="w-24"
                            />
                            <Select
                              label="Tidsenhet"
                              value={customPeriodInputs[index]?.unit || 'DAY'}
                              onChange={(e) => updateCustomPeriod(index, 'unit', e.target.value)}
                              size="small"
                            >
                              {TIME_UNITS.map(unit => (
                                <option key={unit.value} value={unit.value}>
                                  {unit.label}
                                </option>
                              ))}
                            </Select>
                            <div className="text-sm self-center ml-2">
                              fra nåværende tidspunkt
                            </div>
                          </div>
                          
                          {/* Add info about available date range */}
                          <div className="mt-2 text-xs text-gray-600">
                            {maxDaysAvailable ? 
                              `Data er tilgjengelig for de siste ${maxDaysAvailable} dagene.` : 
                              'Velg nettside for å se tilgjengelig data.'
                            }
                          </div>
                        </div>
                      )}
                      
                      {/* Event name combobox on its own row */}
                      {!['IS NULL', 'IS NOT NULL'].includes(filter.operator || '') && filter.column === 'event_name' && (
                        <div className="mt-3">
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
                                  value: newValues.length > 0 ? newValues[0] : '' 
                                });
                              }
                            }}
                            isMultiSelect
                            size="small"
                            clearButton
                          />
                        </div>
                      )}
                    </div>

                    <Button
                      variant="tertiary-neutral"
                      size="small"
                      onClick={() => removeFilter(index)}
                      className="ml-2 self-start"
                    >
                      Fjern
                    </Button>
                  </div>
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

import { Button, ExpansionCard, Heading, Select, TextField, UNSAFE_Combobox } from '@navikt/ds-react';
import { useMemo, useState  } from 'react';
import { Filter, Parameter } from '../../types/chart';
import { FILTER_COLUMNS, OPERATORS } from '../../lib/constants';
import DateRangePicker from './DateRangePicker';

// Event type options for the dropdown
const EVENT_TYPES = [
  { label: 'Sidevisninger', value: '1' },
  { label: 'Egendefinerte hendelser', value: '2' }
];

// Filter suggestions to make common filters easier to apply
const FILTER_SUGGESTIONS = [
  { 
    id: 'pageviews',
    label: 'Filtrer på sidevisninger', 
    filters: [{ column: 'event_type', operator: '=', value: '1' }],
    description: 'Skjuler egendefinerte hendelser'
  },
  { 
    id: 'custom_events',
    label: 'Filtrer på egendefinerte hendelser', 
    filters: [{ column: 'event_type', operator: '=', value: '2' }],
    description: 'Skuler sidevisninger'
  },
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
  // Change to store single string instead of array
  const [appliedSuggestion, setAppliedSuggestion] = useState<string>('');
  // Add state for selected date range
  const [selectedDateRange, setSelectedDateRange] = useState<string>('');
  // Add state to track custom events selection
  const [customEvents, setCustomEvents] = useState<string[]>([]);
  // Add state to track selected URL paths
  const [selectedPaths, setSelectedPaths] = useState<string[]>([]);
  // Add this near other state declarations
  const [stagingFilter, setStagingFilter] = useState<Filter | null>(null);
  
  // Add a function to filter available events to only custom events (non-pageviews)
  const customEventsList = useMemo(() => {
    // Filter out null or undefined events and then filter for custom events
    return availableEvents
      .filter(event => event != null) // Filter out null/undefined events
      .filter(event => 
        !event.toLowerCase().startsWith('pageview') && 
        !event.includes('/')
      );
  }, [availableEvents]);

  // Update the availablePaths logic to better detect pageview paths
  const availablePaths = useMemo(() => {
    const paths = new Set<string>();
    availableEvents.forEach(event => {
      // Skip null events
      if (event == null) return;
      
      // Check if it's a pageview event (starts with '/' or contains 'pageview')
      if (event.startsWith('/')) {
        paths.add(event);
      }
    });
    
    // Sort paths alphabetically
    return Array.from(paths).sort((a, b) => a.localeCompare(b));
  }, [availableEvents]);

  // Change addFilter to accept a column parameter
  const addFilter = (column: string) => {
    if (column) {
      setStagingFilter({ column, operator: '=', value: '' });
    }
  };

  // Add helper function to commit staging filter
  const commitStagingFilter = () => {
    if (stagingFilter) {
      setFilters([...filters, stagingFilter]);
      setStagingFilter(null);
    }
  };

  const removeFilter = (index: number) => {
    const filterToRemove = filters[index];
    // Check if this filter was added by a suggestion
    const isSuggestionFilter = FILTER_SUGGESTIONS.some(suggestion =>
      suggestion.filters.some(f => 
        f.column === filterToRemove.column && 
        f.operator === filterToRemove.operator &&
        f.value === filterToRemove.value
      )
    );
    // If we're removing a suggestion filter, clear the selection
    if (isSuggestionFilter) {
      setAppliedSuggestion('');
    }
    
    // If removing date filter, clear date range selection
    if (filterToRemove.column === 'created_at') {
      setSelectedDateRange('');
    }
    
    setFilters(filters.filter((_, i) => i !== index));
  };

  const updateFilter = (index: number, updates: Partial<Filter>) => {
    setFilters(filters.map((filter, i) => 
      i === index ? { ...filter, ...updates } : filter
    ));
  };

  // Simplified toggle function for radio-like behavior
  const toggleFilterSuggestion = (suggestionId: string) => {
    if (appliedSuggestion === suggestionId) {
      // Deselect current suggestion
      setAppliedSuggestion('');
      // Reset selections
      setCustomEvents([]);
      setSelectedPaths([]);
      // Remove all suggestion filters
      const newFilters = filters.filter(existingFilter => {
        const isSuggestionFilter = FILTER_SUGGESTIONS.some(suggestion =>
          suggestion.filters.some(f => 
            f.column === existingFilter.column && f.operator === existingFilter.operator
          )
        );
        return !isSuggestionFilter;
      });
      // Also remove any event_name filters and url_path filters
      const finalFilters = newFilters.filter(f => 
        !(f.column === 'event_name' && f.operator === 'IN') && 
        !(f.column === 'url_path' && f.operator === 'IN')
      );
      setFilters(finalFilters);
    } else {
      // Remove any existing suggestion filters first
      const cleanFilters = filters.filter(existingFilter => {
        const isSuggestionFilter = FILTER_SUGGESTIONS.some(suggestion =>
          suggestion.filters.some(f => 
            f.column === existingFilter.column && f.operator === existingFilter.operator
          )
        );
        return !isSuggestionFilter;
      });
      // Remove any existing event_name filters and url_path filters
      const cleanerFilters = cleanFilters.filter(f => 
        !(f.column === 'event_name') && 
        !(f.column === 'url_path' && f.operator === 'IN')
      );
      
      // Add new suggestion filters
      const suggestion = FILTER_SUGGESTIONS.find(s => s.id === suggestionId);
      if (suggestion) {
        setFilters([...cleanerFilters, ...suggestion.filters]);
        // Reset selections when switching between suggestions
        setCustomEvents([]);
        setSelectedPaths([]);
      }
      setAppliedSuggestion(suggestionId);
    }
  };
  
  // Add function to handle custom event selection
  const handleCustomEventsChange = (selectedEvents: string[]) => {
    setCustomEvents(selectedEvents);
    
    // Find and remove any existing event_name filters
    const filtersWithoutEventNames = filters.filter(f => f.column !== 'event_name');
    
    // Only add event_name filter if events are selected
    if (selectedEvents.length > 0) {
      setFilters([
        ...filtersWithoutEventNames,
        { 
          column: 'event_name', 
          operator: 'IN', 
          value: selectedEvents[0], // Set first as value for compatibility
          multipleValues: selectedEvents // Store all values here
        }
      ]);
    } else {
      // Keep just the event_type=2 filter without specific event names
      setFilters(filtersWithoutEventNames);
    }
  };

  // Update function to handle URL path selection
  const handlePathsChange = (paths: string[]) => {
    setSelectedPaths(paths);
    
    // Find and remove any existing url_path filters
    const filtersWithoutPaths = filters.filter(f => 
      !(f.column === 'url_path')
    );
    
    // Only add url_path filter if paths are selected
    if (paths.length > 0) {
      setFilters([
        ...filtersWithoutPaths,
        { 
          column: 'url_path', 
          operator: 'IN', 
          value: paths[0], // Set first as value for compatibility
          multipleValues: paths // Store all values here
        }
      ]);
    } else {
      // Keep just the event_type=1 filter without specific paths
      setFilters(filtersWithoutPaths);
    }
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

  // Add this helper to check if filter should use the combobox interface
  const shouldUseCombobox = (column: string): boolean => {
    return column === 'url_path' || column === 'event_name';
  };

  // Add this helper function near other helper functions
  const isDateRangeFilter = (filter: Filter): boolean => {
    return filter.column === 'created_at' && ['>=', '<='].includes(filter.operator || '');
  };

  // Add this helper function to get the actual filter count
  const getActiveFilterCount = () => {
    const dateRangeFilters = filters.filter(isDateRangeFilter);
    const nonDateFilters = filters.filter(f => !isDateRangeFilter(f));
    // Count date range filters (from/to) as one filter
    return nonDateFilters.length + (dateRangeFilters.length > 0 ? 1 : 0);
  };

  return (
    <section>
      <Heading level="2" size="small" spacing>
        Filtervalg
      </Heading>

      <div className="space-y-6 bg-gray-50 p-5 rounded-lg border shadow-sm relative">
        <div>
          {/* Improved Filter Suggestions */}
          <div className="mb-6">
            <Heading level="3" size="xsmall" spacing>
              Type hendelser
            </Heading>
            <div className="flex flex-wrap gap-2 mt-2">
              <button 
                className={`px-3 py-2 rounded-md text-sm border transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 ${
                  appliedSuggestion === '' 
                    ? 'bg-blue-600 text-white border-blue-700' 
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
                }`}
                onClick={() => toggleFilterSuggestion(appliedSuggestion)} // Clicking active suggestion clears it
              >
                Alle hendelser
              </button>
              {FILTER_SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion.id}
                  className={`px-3 py-2 rounded-md text-sm border transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 ${
                    appliedSuggestion === suggestion.id 
                      ? 'bg-blue-600 text-white border-blue-700' 
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
                  }`}
                  onClick={() => toggleFilterSuggestion(suggestion.id)}
                  title={suggestion.description}
                >
                  {suggestion.label}
                </button>
              ))}
            </div>
            
            {/* Show URL path selector when pageviews filter is active */}
            {appliedSuggestion === 'pageviews' && (
              <div className="mt-4 ml-1 p-4 bg-white border rounded-md shadow-inner">
                <UNSAFE_Combobox
                  label="Filtrer på spesifikke URL-stier"
                  description="La stå tom for å vise alle sidevisninger"
                  options={availablePaths.map(path => ({
                    label: path,
                    value: path
                  }))}
                  selectedOptions={selectedPaths}
                  onToggleSelected={(option, isSelected) => {
                    if (option) {
                      const newSelection = isSelected 
                        ? [...selectedPaths, option] 
                        : selectedPaths.filter(p => p !== option);
                      handlePathsChange(newSelection);
                    }
                  }}
                  isMultiSelect
                  size="small"
                  clearButton
                  allowNewValues
                />
                {selectedPaths.length === 0 && (
                  <div className="mt-2 text-xs text-gray-600">
                    Skriv inn URL-stier eller velg fra listen. For eksempel: /min-side
                  </div>
                )}
              </div>
            )}
            
            {/* Show custom events selector when custom events filter is active */}
            {appliedSuggestion === 'custom_events' && (
              <div className="mt-4 ml-1 p-4 bg-white border rounded-md shadow-inner">
                <UNSAFE_Combobox
                  label="Velg spesifikke egendefinerte hendelser"
                  description="La stå tom for å vise alle egendefinerte hendelser"
                  options={customEventsList.map(event => ({
                    label: event,
                    value: event
                  }))}
                  selectedOptions={customEvents}
                  onToggleSelected={(option, isSelected) => {
                    if (option) {
                      const newSelection = isSelected 
                        ? [...customEvents, option] 
                        : customEvents.filter(e => e !== option);
                      handleCustomEventsChange(newSelection);
                    }
                  }}
                  isMultiSelect
                  allowNewValues
                  size="small"
                  clearButton
                />
                {customEventsList.length === 0 && (
                  <div className="mt-2 text-sm text-amber-600">
                    Ingen egendefinerte hendelser funnet. Velg en nettside som har sporing av egendefinerte hendelser.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Replace the date range section with the new component */}
          <DateRangePicker
            filters={filters}
            setFilters={setFilters}
            maxDaysAvailable={maxDaysAvailable}
            selectedDateRange={selectedDateRange}
            setSelectedDateRange={setSelectedDateRange}
            customPeriodInputs={customPeriodInputs}
            setCustomPeriodInputs={setCustomPeriodInputs}
          />

                <div>
                <Heading level="3" size="xsmall" spacing className='mt-2'>
                  Filter
                </Heading>
            
                 <div className="flex gap-2 items-center bg-white p-3 rounded-md border mt-3">
                    <Select
                      label="Legg til filter"
                      onChange={(e) => {
                        if (e.target.value) {
                          addFilter(e.target.value);
                          (e.target as HTMLSelectElement).value = '';
                        }
                      }}
                      size="small"
                      className="flex-grow"
                    >
                      <option value="">Velg filter...</option>
                      {Object.entries(FILTER_COLUMNS).map(([groupKey, group]) => (
                        <optgroup key={groupKey} label={group.label}>
                          {group.columns
                            .filter(col => col.value !== 'created_at') // Filter out the date option
                            .map(col => (
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
                  </div>

                  {/* Add staging area */}
                  {stagingFilter && (
                    <div className="mt-3 bg-white p-4 rounded-md border shadow-sm">
                      <div className="flex-1">
                        <div className="flex gap-2 items-end">
                          <Select
                            label="Kolonne"
                            value={stagingFilter.column}
                            onChange={(e) => setStagingFilter({ ...stagingFilter, column: e.target.value, operator: '=', value: '' })}
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
                          {stagingFilter.column !== 'created_at' && (
                            <Select
                              label="Operator"
                              value={stagingFilter.operator || '='}
                              onChange={(e) => setStagingFilter({ ...stagingFilter, operator: e.target.value })}
                              size="small"
                            >
                              {OPERATORS.map(op => (
                                <option key={op.value} value={op.value}>
                                  {op.label}
                                </option>
                              ))}
                            </Select>
                          )}
                        </div>
                        
                        {/* Value inputs based on column type */}
                        <div className="mt-3">
                          {/* Event type dropdown */}
                          {!['IS NULL', 'IS NOT NULL'].includes(stagingFilter.operator || '') && 
                          stagingFilter.column === 'event_type' && (
                            <Select
                              label="Hendelsestype"
                              value={stagingFilter.value || ''}
                              onChange={(e) => setStagingFilter({ ...stagingFilter, value: e.target.value })}
                              size="small"
                            >
                              <option value="">Velg hendelsestype</option>
                              {EVENT_TYPES.map(type => (
                                <option key={type.value} value={type.value}>
                                  {type.label}
                                </option>
                              ))}
                            </Select>
                          )}

                          {/* Event name combobox */}
                          {!['IS NULL', 'IS NOT NULL'].includes(stagingFilter.operator || '') && 
                          stagingFilter.column === 'event_name' && (
                            <UNSAFE_Combobox
                              label="Event navn"
                              options={availableEvents
                                .filter(event => event != null)
                                .map(event => ({
                                  label: event || '',
                                  value: event || ''
                                }))}
                              selectedOptions={stagingFilter.multipleValues?.map(v => v || '') || 
                                              (stagingFilter.value ? [stagingFilter.value] : [])}
                              onToggleSelected={(option, isSelected) => {
                                if (option) {
                                  const currentValues = stagingFilter.multipleValues || 
                                                      (stagingFilter.value ? [stagingFilter.value] : []);
                                  const newValues = isSelected 
                                    ? [...currentValues, option]
                                    : currentValues.filter(val => val !== option);
                                  setStagingFilter({
                                    ...stagingFilter,
                                    multipleValues: newValues.length > 0 ? newValues : [],
                                    value: newValues.length > 0 ? newValues[0] : ''
                                  });
                                }
                              }}
                              isMultiSelect
                              size="small"
                              clearButton
                            />
                          )}

                          {/* URL path combobox */}
                          {!['IS NULL', 'IS NOT NULL'].includes(stagingFilter.operator || '') && 
                          stagingFilter.column === 'url_path' && (
                            <UNSAFE_Combobox
                              label="URL-stier"
                              description="Velg en eller flere URL-stier"
                              options={availablePaths.map(path => ({
                                label: path,
                                value: path
                              }))}
                              selectedOptions={stagingFilter.multipleValues?.map(v => v || '') || 
                                              (stagingFilter.value ? [stagingFilter.value] : [])}
                              onToggleSelected={(option, isSelected) => {
                                if (option) {
                                  const currentValues = stagingFilter.multipleValues || 
                                                      (stagingFilter.value ? [stagingFilter.value] : []);
                                  const newValues = isSelected 
                                    ? [...currentValues, option]
                                    : currentValues.filter(val => val !== option);
                                  
                                  const newOperator = newValues.length > 1 ? 'IN' : stagingFilter.operator;
                                  
                                  setStagingFilter({
                                    ...stagingFilter,
                                    multipleValues: newValues.length > 0 ? newValues : undefined,
                                    value: newValues.length > 0 ? newValues[0] : '',
                                    operator: newOperator
                                  });
                                }
                              }}
                              isMultiSelect
                              size="small"
                              clearButton
                              allowNewValues
                            />
                          )}

                          {/* Default text field for other columns */}
                          {!['IS NULL', 'IS NOT NULL'].includes(stagingFilter.operator || '') && 
                          stagingFilter.column !== 'event_name' && 
                          stagingFilter.column !== 'created_at' &&
                          stagingFilter.column !== 'event_type' && 
                          !shouldUseCombobox(stagingFilter.column) && (
                            <TextField
                              label="Verdi"
                              value={stagingFilter.value || ''}
                              onChange={(e) => setStagingFilter({ ...stagingFilter, value: e.target.value })}
                              size="small"
                            />
                          )}
                        </div>

                        {/* Action buttons at the bottom */}
                        <div className="mt-4 flex gap-2">
                          <Button
                            variant="primary"
                            size="small"
                            onClick={commitStagingFilter}
                          >
                            Legg til
                          </Button>
                          <Button
                            variant="tertiary-neutral"
                            size="small"
                            onClick={() => setStagingFilter(null)}
                          >
                            Avbryt
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

          {/* Static Filters in ExpansionCard */}
          <div className="mt-4">
            <ExpansionCard
              aria-label="Aktive filtre"
              defaultOpen={false}
              size="small"
            >
              <ExpansionCard.Header>
                <ExpansionCard.Title as="h3" size="small">
                  Aktive filter ({getActiveFilterCount()})
                </ExpansionCard.Title>
              </ExpansionCard.Header>
              <ExpansionCard.Content>
              {filters.length === 0 && (
                <div className="text-sm text-gray-600">
                  Ingen aktive filter. Legg til et filter for å få mer spesifikke data.
                </div>
              )}

                {filters.length > 0 && (
                  <div className="space-y-3">
                    {/* Add a single date range message if any date filters exist */}
                    {filters.some(isDateRangeFilter) && (
                      <div className="bg-gray-50 p-4 rounded-md border shadow-sm">Datoområde filter er aktivt</div>
                    )}
                    
                    {/* Only show non-date range filters in the regular filter list */}
                    {filters.map((filter, index) => !isDateRangeFilter(filter) && (
                      <div key={index} className="bg-gray-50 p-4 rounded-md border shadow-sm">
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
                              {/* Rest of the filter inputs */}
                              {filter.column !== 'created_at' && (
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
                              {/* ...rest of existing filter input code... */}
                            </div>
                            {/* Event name combobox on its own row */}
                            {!['IS NULL', 'IS NOT NULL'].includes(filter.operator || '') && filter.column === 'event_name' && (
                              <div className="mt-3">
                                <UNSAFE_Combobox
                                  label="Event navn"
                                  options={availableEvents
                                    .filter(event => event != null) // Filter out null/undefined events
                                    .map(event => ({
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
                            {/* Add combobox for URL Path */}
                            {!['IS NULL', 'IS NOT NULL'].includes(filter.operator || '') && 
                            filter.column === 'url_path' && (
                              <div className="mt-3 w-full">
                                <UNSAFE_Combobox
                                  label="URL-stier"
                                  description="Velg en eller flere URL-stier"
                                  options={availablePaths.map(path => ({
                                    label: path,
                                    value: path
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
                                      
                                      // Always set operator to IN when there are multiple values
                                      const newOperator = newValues.length > 1 ? 'IN' : filter.operator;
                                      
                                      updateFilter(index, { 
                                        multipleValues: newValues.length > 0 ? newValues : undefined,
                                        value: newValues.length > 0 ? newValues[0] : '',
                                        operator: newOperator
                                      });
                                    }
                                  }}  
                                  isMultiSelect
                                  size="small"
                                  clearButton
                                  allowNewValues
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
              </ExpansionCard.Content>
            </ExpansionCard>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ChartFilters;
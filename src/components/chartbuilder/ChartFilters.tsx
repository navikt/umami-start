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

// Date range suggestions for quick date filtering
const DATE_RANGE_SUGGESTIONS = [
  {
    id: 'thismonth',
    label: 'Denne måneden',
    sql: `TIMESTAMP(DATE_TRUNC(CURRENT_DATE(), MONTH))`
  },
  {
    id: 'lastmonth',
    label: 'Forrige måned',
    sql: `TIMESTAMP(DATE_TRUNC(DATE_SUB(CURRENT_DATE(), INTERVAL 1 MONTH), MONTH))`
  },
  {
    id: 'thisyear',
    label: 'I år',
    sql: `TIMESTAMP(DATE_TRUNC(CURRENT_DATE(), YEAR))`
  }
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
  
  // Add a function to filter available events to only custom events (non-pageviews)
  const customEventsList = useMemo(() => {
    // If user has selected a custom event filter, filter out pageview events
    // Pageview events typically start with "pageview" or contain "/"
    return availableEvents.filter(event => 
      !event.toLowerCase().startsWith('pageview') && 
      !event.includes('/')
    );
  }, [availableEvents]);

  // Update the availablePaths logic to better detect pageview paths
  const availablePaths = useMemo(() => {
    const paths = new Set<string>();
    availableEvents.forEach(event => {
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
      setFilters([...filters, { column, operator: '=', value: '' }]);
    }
  };

  // Find the date filter index in the filters array
  const getDateFilterIndex = (): number => {
    return filters.findIndex(filter => filter.column === 'created_at');
  };

  // Apply a date range filter
  const applyDateRange = (rangeId: string) => {
    if (rangeId === 'all') {
      // "Hele perioden" option - remove any existing date filters
      setSelectedDateRange('all');
      const newFilters = filters.filter(f => f.column !== 'created_at');
      setFilters(newFilters);
      return;
    }
    
    if (selectedDateRange === rangeId) {
      // Deselect current date range - go back to "Hele perioden"
      setSelectedDateRange('all');
      
      // Remove the date filter
      const newFilters = filters.filter(f => f.column !== 'created_at');
      setFilters(newFilters);
    } else {
      // Select the new date range
      setSelectedDateRange(rangeId);
      
      if (rangeId === 'custom') {
        // Special case for custom period
        const dateFilterIndex = getDateFilterIndex();
        const defaultDays = Math.min(7, maxDaysAvailable);
        const sql = `TIMESTAMP_ADD(CURRENT_TIMESTAMP(), INTERVAL -${defaultDays} DAY)`;
        
        if (dateFilterIndex >= 0) {
          // Update existing date filter
          updateFilter(dateFilterIndex, {
            operator: '>=',
            value: sql,
            dateRangeType: 'custom'
          });
          setCustomPeriodInputs(prev => ({
            ...prev,
            [dateFilterIndex]: { amount: defaultDays.toString(), unit: 'DAY' }
          }));
        } else {
          // Add new date filter
          const newFilter = {
            column: 'created_at',
            operator: '>=',
            value: sql,
            dateRangeType: 'custom'
          };
          setFilters([...filters, newFilter]);
          
          // Initialize custom period inputs for the new filter
          // This will be picked up by useEffect
        }
      } else {
        // Regular preset date range
        const dateRange = DATE_RANGE_SUGGESTIONS.find(dr => dr.id === rangeId);
        if (!dateRange) return;
        
        const dateFilterIndex = getDateFilterIndex();
        
        if (dateFilterIndex >= 0) {
          // Update existing date filter
          updateFilter(dateFilterIndex, {
            operator: '>=',
            value: dateRange.sql,
            dateRangeType: 'preset'
          });
        } else {
          // Add new date filter
          setFilters([...filters, { 
            column: 'created_at', 
            operator: '>=', 
            value: dateRange.sql,
            dateRangeType: 'preset'
          }]);
        }
      }
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

  // Initialize custom period for created_at filters
  useEffect(() => {
    filters.forEach((filter, index) => {
      if (filter.column === 'created_at' && !customPeriodInputs[index]) {
        // If it's a preset date range, find and select it
        if (filter.dateRangeType === 'preset') {
          const matchingRange = DATE_RANGE_SUGGESTIONS.find(dr => dr.sql === filter.value);
          if (matchingRange) {
            setSelectedDateRange(matchingRange.id);
            return;
          }
        }
        
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
            value: sql,
            dateRangeType: 'custom'
          });
        }
      }
    });
  }, [filters, maxDaysAvailable]);

  // Update custom period values
  const updateCustomPeriod = (index: number, field: 'amount' | 'unit', value: string) => {
    // Clear selected date range when using custom period
    setSelectedDateRange('');
    
    const currentValues = customPeriodInputs[index] || { amount: '7', unit: 'DAY' };
    const newValues = { ...currentValues, [field]: value };
    setCustomPeriodInputs({
      ...customPeriodInputs,
      [index]: newValues
    });
    
    // Also update the SQL in the filter
    const amount = parseInt(newValues.amount) || 1;
    let sql;
    
    // Handle different time units - TIMESTAMP_ADD doesn't support WEEK and MONTH
    switch(newValues.unit) {
      case 'WEEK':
        // Convert weeks to days (7 days per week)
        sql = `TIMESTAMP_ADD(CURRENT_TIMESTAMP(), INTERVAL -${amount * 7} DAY)`;
        break;
      case 'MONTH':
        // Use DATE_ADD and convert to TIMESTAMP for consistent typingent typing
        sql = `TIMESTAMP(DATE_SUB(CURRENT_DATE(), INTERVAL ${amount} MONTH))`;
        break;
      default:
        // MINUTE, HOUR, DAY are directly supported by TIMESTAMP_ADD
        sql = `TIMESTAMP_ADD(CURRENT_TIMESTAMP(), INTERVAL -${amount} ${newValues.unit})`;
    }
    
    updateFilter(index, {
      value: sql,
      dateRangeType: 'custom'
    });
  };

  // Add helper to check if custom period is active
  const isCustomPeriodActive = (): boolean => {
    return filters.some(filter => 
      filter.column === 'created_at' && 
      filter.dateRangeType === 'custom'
    );
  };

  // Convert max days available to a specific date
  const getStartDateDisplay = (): string => {
    if (!maxDaysAvailable) return 'Velg nettside for å se tilgjengelig data.';
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - maxDaysAvailable);
    
    // Format date as DD.MM.YYYY (Norwegian format)
    const day = String(startDate.getDate()).padStart(2, '0');
    const month = String(startDate.getMonth() + 1).padStart(2, '0');
    const year = startDate.getFullYear();
    
    return `Data er tilgjengelig fra ${day}.${month}.${year} til i dag.`;
  };

  // Update to check if any date filter exists
  const hasDateFilter = (): boolean => {
    return filters.some(filter => filter.column === 'created_at');
  };

  // Add this helper to check if filter should use the combobox interface
  const shouldUseCombobox = (column: string): boolean => {
    return column === 'url_path' || column === 'event_name';
  };

  return (
    <section>
      <Heading level="2" size="small" spacing>
        Filtrering
      </Heading>

      <div className="space-y-6 bg-gray-50 p-5 rounded-md border relative">
        <div>
          {/* Improved Filter Suggestions */}
          <div className="mb-4">
            <Heading level="3" size="xsmall" spacing>
              Type hendelser
            </Heading>
            <div className="flex flex-wrap gap-2 mt-2">
              <button 
                className={`px-3 py-2 rounded-md text-sm border transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 ${
                  appliedSuggestion === '' 
                    ? 'bg-blue-600 text-white border-blue-700' 
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
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
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
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
              <div className="mt-5 ml-1 p-3 bg-white border rounded-md">
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
            {appliedSuggestion === 'custom_events' && customEventsList.length > 0 && (
              <div className="mt-5 ml-1 p-3 bg-white border rounded-md">
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
                  size="small"
                  clearButton
                />
              </div>
            )}
          </div>

          {/* Date Range Quick Picker */}
          <div className="mb-4">
            <Heading level="3" size="xsmall" spacing>
              Datoområde
            </Heading>
            
            <div className="flex flex-wrap gap-2 mt-2">
              {/* Add "Hele perioden" button as the first option */}
              <button 
                className={`px-3 py-2 rounded-md text-sm border transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 ${
                  !hasDateFilter() || selectedDateRange === 'all'
                    ? 'bg-blue-600 text-white border-blue-700' 
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
                onClick={() => applyDateRange('all')}
              >
                Alt
              </button>
              {DATE_RANGE_SUGGESTIONS.map((dateRange) => (
                <button
                  key={dateRange.id}
                  className={`px-3 py-2 rounded-md text-sm border transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 ${
                    selectedDateRange === dateRange.id 
                      ? 'bg-blue-600 text-white border-blue-700' 
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                  onClick={() => applyDateRange(dateRange.id)}
                >
                  {dateRange.label}
                </button>
              ))}
                            <button 
                className={`px-3 py-2 rounded-md text-sm border transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 ${
                  isCustomPeriodActive() 
                    ? 'bg-blue-600 text-white border-blue-700' 
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
                onClick={() => applyDateRange('custom')}
              >
                Egendefinert
              </button>
            </div>
            
            {/* Show info about available date range with actual date */}
            <div className="mt-2 text-xs text-gray-600">
              {getStartDateDisplay()}
            </div>
          </div>

          {/* Static Filters */}
          <div className="mt-6">
            <Heading level="3" size="xsmall" spacing>
              Statiske filter
            </Heading>
            <p className="text-sm text-gray-600 mb-4">
              Statiske filtre er låst til grafen eller tabellen du lager.
            </p>

            {/* Replace button with dropdown and button combo like in Summarize.tsx */}
            <div className="flex gap-2 items-center bg-white p-3 rounded-md border">
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
                <option value="">Velg felt...</option>
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
            </div>
            
            {filters.length > 0 && (
              <div className="space-y-3 mt-3">
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
                          {/* Only exclude operator dropdown for created_at column */}
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
                          {/* Special case for event_type - show dropdown instead of text field */}
                          {!['IS NULL', 'IS NOT NULL'].includes(filter.operator || '') && 
                          filter.column === 'event_type' && (
                            <Select
                              label="Hendelsestype"
                              value={filter.value || ''}
                              onChange={(e) => updateFilter(index, { value: e.target.value })}
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
                          {/* Regular text field for all other columns except event_name and created_at */}
                          {!['IS NULL', 'IS NOT NULL'].includes(filter.operator || '') && 
                          filter.column !== 'event_name' && 
                          filter.column !== 'created_at' &&
                          filter.column !== 'event_type' && 
                          !shouldUseCombobox(filter.column) && (
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
                            {filter.dateRangeType === 'preset' ? (
                              <div className="flex items-center">
                                <div className="text-sm text-blue-600 font-medium">
                                  Bruker forhåndsdefinert periode: {" "}
                                  {DATE_RANGE_SUGGESTIONS.find(dr => dr.sql === filter.value)?.label || 'Egendefinert'}
                                </div>
                                <Button 
                                  variant="tertiary-neutral" 
                                  size="small"
                                  onClick={() => {
                                    // Switch back to custom mode
                                    setSelectedDateRange('');
                                    const defaultDays = Math.min(7, maxDaysAvailable);
                                    const sql = `TIMESTAMP_ADD(CURRENT_TIMESTAMP(), INTERVAL -${defaultDays} DAY)`;
                                    updateFilter(index, {
                                      value: sql,
                                      dateRangeType: 'custom'
                                    });
                                    setCustomPeriodInputs(prev => ({
                                      ...prev,
                                      [index]: { amount: defaultDays.toString(), unit: 'DAY' }
                                    }));
                                  }}
                                  className="ml-2"
                                >
                                  Tilpass
                                </Button>
                              </div>
                            ) : (
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
                            )}
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
          
          </div>
        </div>
      </div>
    </section>
  );
};

export default ChartFilters;

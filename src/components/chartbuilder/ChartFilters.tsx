import { Button, Heading, Select, Switch, UNSAFE_Combobox, Chips, Tabs } from '@navikt/ds-react';
import { useMemo, useState, useEffect, useRef } from 'react';
import { Filter, Parameter } from '../../types/chart';
import { FILTER_COLUMNS, OPERATORS } from '../../lib/constants';
import DateRangePicker from './DateRangePicker';
import AlertWithCloseButton from './AlertWithCloseButton';

// Event type options for the dropdown
const EVENT_TYPES = [
  { label: 'Sidevisninger', value: '1' },
  { label: 'Egendefinerte hendelser', value: '2' }
];

// Filter suggestions to make common filters easier to apply
const FILTER_SUGGESTIONS = [
  { 
    id: 'pageviews',
    label: 'Besøk (sidevisninger)', 
    filters: [{ column: 'event_type', operator: '=', value: '1' }],
    description: 'Viser kun sidevisninger'
  },
  { 
    id: 'custom_events',
    label: 'Egendefinerte hendelser', 
    filters: [{ column: 'event_type', operator: '=', value: '2' }],
    description: 'Viser kun egendefinerte hendelser'
  },
  {
    id: 'all_events',
    label: 'Begge typer',
    filters: [], // No filters means we include all event types
    description: 'Viser både sidevisninger og egendefinerte hendelser'
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
  const [appliedSuggestion, setAppliedSuggestion] = useState<string>('pageviews'); // Pre-select pageviews
  // Add state for selected date range
  const [selectedDateRange, setSelectedDateRange] = useState<string>('');
  // Add state to track custom events selection
  const [customEvents, setCustomEvents] = useState<string[]>([]);
  // Add state to track selected URL paths
  const [selectedPaths, setSelectedPaths] = useState<string[]>([]);
  const [urlPathOperator, setUrlPathOperator] = useState<string>('IN'); // Add this state
  // Add this near other state declarations
  const [stagingFilter, setStagingFilter] = useState<Filter | null>(null);
  const [advancedFilters, setAdvancedFilters] = useState<boolean>(false);
  const [activeFilters, setActiveFilters] = useState<boolean>(false);
  // Add a new state for the event operator (near other state variables)
  const [eventNameOperator, setEventNameOperator] = useState<string>('IN');
  // Add these new state variables
  const [pageViewsMode, setPageViewsMode] = useState<'all' | 'specific' | 'interactive'>('all');
  const [customEventsMode, setCustomEventsMode] = useState<'all' | 'specific' | 'interactive'>('all');
  
  // Add alert state
  const [alertInfo, setAlertInfo] = useState<{show: boolean, message: string}>({
    show: false,
    message: ''
  });
  
  // Add a separate alert state for staging area
  const [stagingAlertInfo, setStagingAlertInfo] = useState<{show: boolean, message: string}>({
    show: false,
    message: ''
  });

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
      // Check if this is an interactive filter
      if (stagingFilter.operator === 'INTERACTIVE') {
        // Generate parameter name based on column name
        const paramName = stagingFilter.column === 'url_path' ? 'url_sti' : 
                          stagingFilter.column === 'event_name' ? 'hendelse' :
                          stagingFilter.column.toLowerCase().replace(/[^a-z0-9_]/g, '_');
        
        // Create interactive filter
        const interactiveFilter = {
          ...stagingFilter,
          operator: '=',
          value: `{{${paramName}}}`,
          metabaseParam: true,
          interactive: true
        };
        
        setFilters([...filters, interactiveFilter]);
      } else {
        // Regular filter
        setFilters([...filters, stagingFilter]);
      }
      
      setStagingFilter(null);
      
      // Show alert in the staging area
      setStagingAlertInfo({
        show: true,
        message: `Filter lagt til under aktive filter`
      });
      
      // Auto-hide staging alert after 5 seconds
      setTimeout(() => {
        setStagingAlertInfo(prev => ({...prev, show: false}));
      }, 5000);
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
    // Don't allow deselection by clicking the same tab again
    if (appliedSuggestion === suggestionId) {
      return;
    }

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
    
    // Add new suggestion filters (if any)
    const suggestion = FILTER_SUGGESTIONS.find(s => s.id === suggestionId);
    if (suggestion) {
      const filtersToApply = [...cleanerFilters];
      if (suggestion.filters.length > 0) {
        filtersToApply.push(...suggestion.filters);
      }
      setFilters(filtersToApply);
      
      // Reset selections when switching between suggestions
      setCustomEvents([]);
      setSelectedPaths([]);
      setPageViewsMode('all');
      setCustomEventsMode('all');
    }
    setAppliedSuggestion(suggestionId);
    
    // Auto-hide alert after 5 seconds
    setTimeout(() => {
      setAlertInfo(prev => ({...prev, show: false}));
    }, 5000);
  };

  // Update the handleCustomEventsChange function to handle different operators
  const handleCustomEventsChange = (selectedEvents: string[], operator: string = eventNameOperator) => {
    setCustomEvents(selectedEvents);
    setEventNameOperator(operator);
    
    // Find and remove any existing event_name filters
    const filtersWithoutEventNames = filters.filter(f => f.column !== 'event_name');
    
    // Only add event_name filter if events are selected
    if (selectedEvents.length > 0) {
      // For IN operator, use multipleValues
      if (operator === 'IN') {
        setFilters([
          ...filtersWithoutEventNames,
          { 
            column: 'event_name', 
            operator: 'IN', 
            value: selectedEvents[0],
            multipleValues: selectedEvents
          }
        ]);
      } 
      // For other operators (LIKE, STARTS_WITH, etc.), use normal format
      else {
        setFilters([
          ...filtersWithoutEventNames,
          { 
            column: 'event_name', 
            operator: operator,
            value: selectedEvents[0]
          }
        ]);
      }
    } else {
      // Keep just the event_type=2 filter without specific event names
      setFilters(filtersWithoutEventNames);
    }
  };

  // Update function to handle URL path selection
  const handlePathsChange = (paths: string[], operator: string = urlPathOperator) => {
    setSelectedPaths(paths);
    setUrlPathOperator(operator);
    
    // Find and remove any existing url_path filters
    const filtersWithoutPaths = filters.filter(f => 
      !(f.column === 'url_path')
    );
    
    // Only add url_path filter if paths are selected
    if (paths.length > 0) {
      // For IN operator, use multipleValues
      if (operator === 'IN') {
        setFilters([
          ...filtersWithoutPaths,
          { 
            column: 'url_path', 
            operator: 'IN', 
            value: paths[0],
            multipleValues: paths
          }
        ]);
      } 
      // For other operators (LIKE, STARTS_WITH, etc.), use normal format
      else {
        setFilters([
          ...filtersWithoutPaths,
          { 
            column: 'url_path', 
            operator: operator,
            value: paths[0]
          }
        ]);
      }
    } else {
      setFilters(filtersWithoutPaths);
    }
  };

  // Add this useEffect to sync operator state with filters
  useEffect(() => {
    const urlPathFilter = filters.find(f => f.column === 'url_path');
    if (urlPathFilter && urlPathFilter.operator) {
      setUrlPathOperator(urlPathFilter.operator);
    }
  }, [filters]);

  // Add useEffect to sync operator state with filters (near other useEffects)
  useEffect(() => {
    const eventNameFilter = filters.find(f => f.column === 'event_name');
    if (eventNameFilter && eventNameFilter.operator) {
      setEventNameOperator(eventNameFilter.operator);
    }
  }, [filters]);

  // Add useEffect to apply initial pageviews filter
  useEffect(() => {
    if (filters.length === 0) {
      const pageviewsFilter = FILTER_SUGGESTIONS.find(s => s.id === 'pageviews');
      if (pageviewsFilter) {
        setFilters([...pageviewsFilter.filters]);
      }
    }
  }, []); // Empty dependency array means this runs once on mount

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

  // Add this helper function near the top with other helpers
  const getOptionsForColumn = (column: string, availableEvents: string[], availablePaths: string[]): { label: string, value: string }[] => {
    switch (column) {
      case 'event_name':
        return availableEvents
          .filter(event => event != null)
          .map(event => ({
            label: event || '',
            value: event || ''
          }));
      case 'url_path':
        return availablePaths.map(path => ({
          label: path,
          value: path
        }));
      case 'event_type':
        return EVENT_TYPES;
      default:
        return []; // Empty array for free-form input fields
    }
  };

  // Create a reference to the DateRangePicker component
  const dateRangePickerRef = useRef<{ clearDateRange: () => void }>(null);

  // Update resetFilters function
  const resetFilters = () => {
    // Ensure filters are completely cleared
    setFilters([]);
    
    // Reset UI state but keep 'pageviews' suggestion active
    setAppliedSuggestion('pageviews');
    setSelectedDateRange('');
    setCustomEvents([]);
    setSelectedPaths([]);
    // Keep the pageViewsMode in 'all' state
    setPageViewsMode('all');
    setCustomEventsMode('all');
    setCustomPeriodInputs({});
    setStagingFilter(null);
    setInteractiveMode(false);
    
    // Close all filter panels
    setActiveFilters(false);
    setAdvancedFilters(false);
    
    // Force immediate UI update for filter count by using a setTimeout with 0ms
    setTimeout(() => {
      // Apply initial pageviews filter
      const pageviewsFilter = FILTER_SUGGESTIONS.find(s => s.id === 'pageviews');
      if (pageviewsFilter) {
        setFilters([...pageviewsFilter.filters]);
      }
    }, 0);
    
    // Clear date picker state through ref
    dateRangePickerRef.current?.clearDateRange();
    
    setAlertInfo({
      show: true,
      message: 'Alle filtre ble tilbakestilt'
    });
    
    setTimeout(() => {
      setAlertInfo(prev => ({...prev, show: false}));
    }, 7000);
  };

  // Add function to handle setting a filter as interactive
  const handleSetInteractiveFilter = (index: number, column: string) => {
    // Generate parameter name based on column name
    const paramName = column === 'url_path' ? 'url_sti' : 
                      column === 'event_name' ? 'hendelse' :
                      column.toLowerCase().replace(/[^a-z0-9_]/g, '_');
    
    updateFilter(index, {
      operator: '=',
      value: `{{${paramName}}}`,
      metabaseParam: true,
      interactive: true
    });
    
    // Show success alert
    setAlertInfo({
      show: true,
      message: `Filter for ${column} satt til interaktiv modus.`
    });
    
    // Auto-hide alert after 5 seconds
    setTimeout(() => {
      setAlertInfo(prev => ({...prev, show: false}));
    }, 5000);
  };

  // Add state for interactive mode at the top with other state declarations
  const [interactiveMode, setInteractiveMode] = useState<boolean>(false);

  return (
    <section>
      <div className="flex justify-between items-center">
        <Heading level="2" size="small" spacing>
          Hvilke hendelser vil du inkludere?
        </Heading>
        
        {/* Add reset button next to the heading */}
        <Button 
          variant="tertiary" 
          size="small" 
          onClick={resetFilters}
          className="mb-2"
        >
          Tilbakestill filtre
        </Button>
      </div>

      <div className="space-y-6 bg-gray-50 p-5 rounded-lg border shadow-sm relative"> 
        <div>
          {/* Show alert if it's active */}
          {alertInfo.show && (
            <div className="mb-4">
              <AlertWithCloseButton variant="success">
                {alertInfo.message}
              </AlertWithCloseButton>
            </div>
          )}
          
          {/* Replace the existing Type hendelse section with this */}
          <div className="mb-6">
            <Heading level="3" size="xsmall" spacing>
              Velg hendelse
            </Heading>
            
            <div className="mt-3 bg-white p-4 rounded-md border shadow-inner">
              <Tabs 
                value={appliedSuggestion || 'pageviews'}
                onChange={(value) => toggleFilterSuggestion(value)}
                size="small"
              >
                <Tabs.List>
                  <Tabs.Tab 
                    value="pageviews" 
                    label="Kun besøk"
                    title="Viser kun sidevisninger"
                  />
                  {customEventsList.length > 0 && (
                    <Tabs.Tab 
                      value="custom_events" 
                      label="Kun egendefinerte"
                      title="Viser kun egendefinerte hendelser"
                    />
                  )}
                  {customEventsList.length > 0 && (
                    <Tabs.Tab 
                      value="all_events" 
                      label="Begge kombinert"
                      title="Viser både sidevisninger og egendefinerte hendelser"
                    />
                  )}
                </Tabs.List>
              </Tabs>

              {/* Keep existing pageviews and custom events sections */}
              {(appliedSuggestion === 'pageviews' || appliedSuggestion === 'all_events') && (
                <div className="mt-4">
                  {/* Only show heading in "all_events" mode */}
                  {appliedSuggestion === 'all_events' && (
                    <Heading level="4" size="xsmall" spacing className="mb-2">
                      Besøk
                    </Heading>
                  )}
                  
                  <Chips>
                    <Chips.Toggle 
                      selected={pageViewsMode === 'all'}
                      onClick={() => {
                        setPageViewsMode('all');
                        // Clear any specific URL path filters
                        const filtersWithoutPaths = filters.filter(f => 
                          !(f.column === 'url_path')
                        );
                        setFilters(filtersWithoutPaths);
                        setSelectedPaths([]);
                      }}
                      checkmark={false}
                    >
                      Besøk til alle sider
                    </Chips.Toggle>
                    <Chips.Toggle 
                      selected={pageViewsMode === 'specific'}
                      onClick={() => setPageViewsMode('specific')}
                      checkmark={false}
                    >
                      Besøk til bestemte sider
                    </Chips.Toggle>
                    <Chips.Toggle 
                      selected={pageViewsMode === 'interactive'}
                      onClick={() => {
                        setPageViewsMode('interactive');
                        // Add Metabase parameter filter
                        const filtersWithoutPaths = filters.filter(f => 
                          !(f.column === 'url_path')
                        );
                        setFilters([
                          ...filtersWithoutPaths,
                          { 
                            column: 'url_path', 
                            operator: '=', 
                            value: '{{url_sti}}',
                            metabaseParam: true
                          }
                        ]);
                        setSelectedPaths([]);
                      }}
                      checkmark={false}
                    >
                      Interaktiv
                    </Chips.Toggle>
                  </Chips>
                  
                  {pageViewsMode === 'specific' && (
                    <>
                      <div className="flex gap-2 items-end mb-3 mt-4">
                        <Select
                          label="URL-sti"
                          value={urlPathOperator}
                          onChange={(e) => {
                            const newOperator = e.target.value;
                            setUrlPathOperator(newOperator);
                            
                            // Handle the transition between IN and other operators
                            if ((newOperator === 'IN' && selectedPaths.length <= 1) || 
                                (urlPathOperator === 'IN' && newOperator !== 'IN')) {
                              const pathValue = selectedPaths.length > 0 ? selectedPaths[0] : '';
                              handlePathsChange(
                                newOperator === 'IN' ? selectedPaths : [pathValue],  
                                newOperator
                              );
                            } else {
                              handlePathsChange(selectedPaths, newOperator);
                            }
                          }}
                          size="small"
                          className="w-full md:w-1/3"
                        >
                          {OPERATORS.map(op => (
                            <option key={op.value} value={op.value}>
                              {op.label}
                            </option>
                          ))}
                        </Select>
                      </div>
                      
                      {urlPathOperator === 'IN' ? (
                        <UNSAFE_Combobox
                          label="Velg URL-stier"
                          description="Flere stier kan velges for 'er lik' operator"
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
                              handlePathsChange(newSelection, urlPathOperator);
                            }
                          }}
                          isMultiSelect
                          size="small"
                          clearButton
                          allowNewValues
                        />
                      ) : (
                        <UNSAFE_Combobox
                          label="Legg til en eller flere URL-stier"
                          description={
                            urlPathOperator === 'LIKE' ? "Søket vil inneholde verdien uavhengig av posisjon" :
                            urlPathOperator === 'STARTS_WITH' ? "Søket vil finne stier som starter med verdien" :
                            urlPathOperator === 'ENDS_WITH' ? "Søket vil finne stier som slutter med verdien" :
                            null
                          }
                          options={availablePaths.map(path => ({
                            label: path,
                            value: path
                          }))}
                          selectedOptions={selectedPaths.length > 0 ? [selectedPaths[0]] : []}
                          onToggleSelected={(option, isSelected) => {
                            if (option) {
                              handlePathsChange(isSelected ? [option] : [], urlPathOperator);
                            }
                          }}
                          isMultiSelect={true}
                          size="small"
                          clearButton
                          allowNewValues
                        />
                      )}
                      
                      {selectedPaths.length === 0 && (
                        <div className="mt-2 text-xs text-gray-600">
                          Når tom vises alle sidevisninger
                        </div>
                      )}
                    </>
                  )}
                  
                  {pageViewsMode === 'interactive' && (
                    <div className="mt-4 text-sm text-gray-700 bg-white p-4 rounded border">
                    <div className="flex items-center gap-3">
                      <div className="flex-shrink-0">
                        <span className="flex items-center justify-center w-6 h-6 bg-green-100 rounded-full">
                          <svg 
                            width="16" 
                            height="16" 
                            viewBox="0 0 16 16" 
                            fill="none" 
                            className="text-green-600"
                          >
                            <path 
                              d="M13.3 4.3L6 11.6L2.7 8.3C2.3 7.9 1.7 7.9 1.3 8.3C0.9 8.7 0.9 9.3 1.3 9.7L5.3 13.7C5.5 13.9 5.7 14 6 14C6.3 14 6.5 13.9 6.7 13.7L14.7 5.7C15.1 5.3 15.1 4.7 14.7 4.3C14.3 3.9 13.7 3.9 13.3 4.3Z" 
                              fill="currentColor"
                            />
                          </svg>
                        </span>
                      </div>
                      <div>
                        <p className="font-medium mb-1">Aktivert som interaktivt filter for sidevisninger</p>
                        <p className="text-gray-600">URL-sti kan velges som et filtervalg i Metabase-dashbord</p>
                      </div>
                    </div>
                  </div>
                  )}
                </div>
              )}
              
              {(appliedSuggestion === 'custom_events' || appliedSuggestion === 'all_events') && (
                <div className="mt-4">
                  {/* Only show heading in "all_events" mode */}
                  {appliedSuggestion === 'all_events' && (
                    <Heading level="4" size="xsmall" spacing className="mb-2">
                      Egendefinerte hendelser
                    </Heading>
                  )}
                  
                  <Chips>
                    <Chips.Toggle 
                      selected={customEventsMode === 'all'}
                      onClick={() => {
                        setCustomEventsMode('all');
                        // Clear any specific event name filters
                        const filtersWithoutEventNames = filters.filter(f => f.column !== 'event_name');
                        setFilters(filtersWithoutEventNames);
                        setCustomEvents([]);
                      }}
                      checkmark={false}
                    >
                      Alle hendelser
                    </Chips.Toggle>
                    <Chips.Toggle 
                      selected={customEventsMode === 'specific'}
                      onClick={() => setCustomEventsMode('specific')}
                      checkmark={false}
                    >
                      Bestemte hendelser
                    </Chips.Toggle>
                    <Chips.Toggle 
                      selected={customEventsMode === 'interactive'}
                      onClick={() => {
                        setCustomEventsMode('interactive');
                        // Add Metabase parameter filter
                        const filtersWithoutEventNames = filters.filter(f => f.column !== 'event_name');
                        setFilters([
                          ...filtersWithoutEventNames,
                          { 
                            column: 'event_name', 
                            operator: '=', 
                            value: '{{hendelse}}',
                            metabaseParam: true
                          }
                        ]);
                        setCustomEvents([]);
                      }}
                      checkmark={false}
                    >
                      Interaktiv
                    </Chips.Toggle>
                  </Chips>
                  
                  {customEventsMode === 'specific' && (
                    <>
                      <div className="flex gap-2 items-end mb-3 mt-4">
                        <Select
                          label="Hendelser"
                          value={eventNameOperator}
                          onChange={(e) => {
                            const newOperator = e.target.value;
                            setEventNameOperator(newOperator);
                            
                            // Handle the transition between IN and other operators
                            if ((newOperator === 'IN' && customEvents.length <= 1) || 
                                (eventNameOperator === 'IN' && newOperator !== 'IN')) {
                              const eventValue = customEvents.length > 0 ? customEvents[0] : '';
                              handleCustomEventsChange(
                                newOperator === 'IN' ? customEvents : [eventValue],
                                newOperator
                              );
                            } else {
                              handleCustomEventsChange(customEvents, newOperator);
                            }
                          }}
                          size="small"
                          className="w-full md:w-1/3"
                        >
                          {OPERATORS.map(op => (
                            <option key={op.value} value={op.value}>
                              {op.label}
                            </option>
                          ))}
                        </Select>
                      </div>
                      
                      {eventNameOperator === 'IN' ? (
                        <UNSAFE_Combobox
                          label="Velg spesifikke hendelser"
                          description="Flere hendelser kan velges for 'er lik' operator"
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
                              handleCustomEventsChange(newSelection, eventNameOperator);
                            }
                          }}
                          isMultiSelect
                          size="small"
                          clearButton
                          allowNewValues
                        />
                      ) : (
                        <UNSAFE_Combobox
                          label="Legg til hendelse"
                          description={
                            eventNameOperator === 'LIKE' ? "Søket vil inneholde verdien uavhengig av posisjon" :
                            eventNameOperator === 'STARTS_WITH' ? "Søket vil finne hendelser som starter med verdien" :
                            eventNameOperator === 'ENDS_WITH' ? "Søket vil finne hendelser som slutter med verdien" :
                            null
                          }
                          options={customEventsList.map(event => ({
                            label: event,
                            value: event
                          }))}
                          selectedOptions={customEvents.length > 0 ? [customEvents[0]] : []}
                          onToggleSelected={(option, isSelected) => {
                            if (option) {
                              handleCustomEventsChange(isSelected ? [option] : [], eventNameOperator);
                            }
                          }}
                          isMultiSelect={false}
                          size="small"
                          clearButton
                          allowNewValues
                        />
                      )}

                      {customEvents.length === 0 && (
                        <div className="mt-2 text-xs text-gray-600">
                          Når tom vises alle egendefinerte hendelser
                        </div>
                      )}
                      {customEventsList.length === 0 && (
                        <div className="mt-2 text-sm text-amber-600">
                          Ingen egendefinerte hendelser funnet. Velg en nettside som har sporing av egendefinerte hendelser.
                        </div>
                      )}
                    </>
                  )}
                  
                  {customEventsMode === 'interactive' && (
                    <div className="mt-4 text-sm text-gray-700 bg-white p-4 rounded border">
                    <div className="flex items-center gap-3">
                      <div className="flex-shrink-0">
                        <span className="flex items-center justify-center w-6 h-6 bg-green-100 rounded-full">
                          <svg 
                            width="16" 
                            height="16" 
                            viewBox="0 0 16 16" 
                            fill="none" 
                            className="text-green-600"
                          >
                            <path 
                              d="M13.3 4.3L6 11.6L2.7 8.3C2.3 7.9 1.7 7.9 1.3 8.3C0.9 8.7 0.9 9.3 1.3 9.7L5.3 13.7C5.5 13.9 5.7 14 6 14C6.3 14 6.5 13.9 6.7 13.7L14.7 5.7C15.1 5.3 15.1 4.7 14.7 4.3C14.3 3.9 13.7 3.9 13.3 4.3Z" 
                              fill="currentColor"
                            />
                          </svg>
                        </span>
                      </div>
                      <div>
                        <p className="font-medium mb-1">Aktivert som interaktivt filter for egendefinerte hendelser</p>
                        <p className="text-gray-600">Egendefinerte hendelser kan velges via filtervalg i Metabase-dashbord</p>
                      </div>
                    </div>
                  </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Date Range Picker - Now AFTER event selection */}
          <DateRangePicker
            ref={dateRangePickerRef}
            filters={filters}
            setFilters={setFilters}
            maxDaysAvailable={maxDaysAvailable}
            selectedDateRange={selectedDateRange}
            setSelectedDateRange={setSelectedDateRange}
            customPeriodInputs={customPeriodInputs}
            setCustomPeriodInputs={setCustomPeriodInputs}
            interactiveMode={interactiveMode}
            setInteractiveMode={setInteractiveMode}
          />

          {/* Additional filters section */}
          <div>
            <Heading level="3" size="xsmall" className='mt-2'>
              Flere filtervalg
            </Heading>
            <Switch className="mt-1" checked={advancedFilters} onChange={() => setAdvancedFilters(!advancedFilters)}>Legg til flere filtre</Switch>
            
            {advancedFilters && (
              <div className="mb-4">

                <div className="flex gap-2 items-center bg-white p-3 rounded-md border mt-3">
                  <Select
                    label="Filtrér etter"
                    description="Legg til et filter for å velge hvilke data grafen/tabellen baseres på."
                    onChange={(e) => {
                      if (e.target.value) {
                        addFilter(e.target.value);
                        // Clear both alerts when adding a new filter
                        setAlertInfo({ show: false, message: '' });
                        setStagingAlertInfo({ show: false, message: '' });
                        (e.target as HTMLSelectElement).value = '';
                      }
                    }}
                    size="small"
                    className="flex-grow"
                  >
                    <option value="">Velg filtre...</option>
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

                {/* Show staging alert if it's active */}
                {stagingAlertInfo.show && (
                  <div className="mb-4 mt-4">
                    <AlertWithCloseButton variant="success">
                      {stagingAlertInfo.message}
                    </AlertWithCloseButton>
                  </div>
                )}

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
                            {/* Add the interactive operator option at the top */}
                            <option value="INTERACTIVE">Interaktiv</option>
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
                        {/* Show info for interactive filters */}
                        {stagingFilter.operator === 'INTERACTIVE' && (
                          <div className="mt-3 bg-blue-50 p-3 rounded text-sm">
                            <p>
                              <strong>Interaktiv filter:</strong> Dette filteret vil bli kontrollert av Metabase-dashbordet.
                            </p>
                            <p className="mt-1 text-xs text-gray-600">
                              Parameter vil være {stagingFilter.column === 'url_path' ? 'url_sti' : 
                                                stagingFilter.column === 'event_name' ? 'hendelse' :
                                                stagingFilter.column.toLowerCase().replace(/[^a-z0-9_]/g, '_')}
                            </p>
                          </div>
                        )}
                        
                        {/* Event type dropdown */}
                        {!['IS NULL', 'IS NOT NULL', 'INTERACTIVE'].includes(stagingFilter.operator || '') && 
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

                        {/* Replace all other value inputs with Combobox */}
                        {!['IS NULL', 'IS NOT NULL', 'INTERACTIVE'].includes(stagingFilter.operator || '') && 
                        stagingFilter.column !== 'event_type' && 
                        stagingFilter.column !== 'created_at' && (
                          <UNSAFE_Combobox
                            label="Verdi"
                            description={stagingFilter.column === 'url_path' ? "Velg eller skriv inn URL-stier" : 
                                        stagingFilter.column === 'event_name' ? "Velg eller skriv inn hendelser" : 
                                        "Velg eller skriv inn verdier"}
                            options={getOptionsForColumn(stagingFilter.column, availableEvents, availablePaths)}
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
                            allowNewValues={stagingFilter.column !== 'event_type'}
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
            )}
          </div>
          
          {/* Active filters section */}
          <Switch className="-mt-1 -mb-1" checked={activeFilters} onChange={() => setActiveFilters(!activeFilters)}>
            {filters.length === 0 ? 'Vis aktive filtre' : `Vis aktive filter (${getActiveFilterCount()})`}
          </Switch>
          
          {activeFilters && (
            <>
              <div className="mt-3 bg-white p-4 rounded-md border shadow-inner">
                {filters.length === 0 && (
                  <div className="text-sm text-gray-600">
                    Ingen aktive filtre. Legg til et filter for å få mer spesifikke data.
                  </div>
                )}

                {filters.length > 0 && (
                  <div className="space-y-3">
                    {/* Add a single date range message if any date filters exist */}
                    {filters.some(isDateRangeFilter) && (
                      <div className="bg-gray-50 p-4 rounded-md border shadow-sm">Datofilter er lagt til</div>
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
                              
                              {/* Add interactive toggle button */}
                              {filter.interactive ? (
                                <div className="ml-2 mb-1">
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                    Interaktiv
                                  </span>
                                </div>
                              ) : (
                                <Button
                                  variant="tertiary"
                                  size="small"
                                  className="ml-2 mb-1"
                                  onClick={() => handleSetInteractiveFilter(index, filter.column)}
                                >
                                  Gjør interaktiv
                                </Button>
                              )}
                              
                              {filter.column !== 'created_at' && !filter.interactive && (
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
                            </div>
                            
                            {/* Show parameter name for interactive filters */}
                            {filter.interactive ? (
                              <div className="mt-3 bg-blue-50 p-3 rounded text-sm">
                                <p>
                                  <strong>Parameter:</strong> {filter.value?.replace('{{', '').replace('}}', '')}
                                </p>
                                <p className="mt-1 text-xs text-gray-600">
                                  Denne filteret vil bli kontrollert av Metabase-dashbordet.
                                </p>
                              </div>
                            ) : (
                              // Existing value inputs for non-interactive filters
                              !['IS NULL', 'IS NOT NULL'].includes(filter.operator || '') && (
                                <div className="mt-3">
                                  <UNSAFE_Combobox
                                    label="Verdi"
                                    description={filter.column === 'url_path' ? "Velg eller skriv inn URL-stier" : 
                                                filter.column === 'event_name' ? "Velg eller skriv inn hendelser" : 
                                                "Velg eller skriv inn verdier"}
                                    options={getOptionsForColumn(filter.column, availableEvents, availablePaths)}
                                    selectedOptions={filter.multipleValues?.map(v => v || '') || 
                                                    (filter.value ? [filter.value] : [])}
                                    onToggleSelected={(option, isSelected) => {
                                      if (option) {
                                        const currentValues = filter.multipleValues || 
                                                            (filter.value ? [filter.value] : []);
                                        const newValues = isSelected 
                                          ? [...currentValues, option]
                                          : currentValues.filter(val => val !== option);
                                        
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
                                    allowNewValues={filter.column !== 'event_type'}
                                  />
                                </div>
                              )
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
            </>
          )}
        </div>
      </div>
    </section>
  );
};

export default ChartFilters;
import { Heading, RadioGroup, Radio, Select, UNSAFE_Combobox, Tabs, Button } from '@navikt/ds-react';
import { Filter, Parameter } from '../../types/chart';
import AlertWithCloseButton from './AlertWithCloseButton';

interface EventSelectorProps {
  selectedEventTypes: string[];
  handleEventTypeChange: (eventType: string, isChecked: boolean) => void;
  pageViewsMode: 'all' | 'specific' | 'interactive';
  setPageViewsMode: (mode: 'all' | 'specific' | 'interactive') => void;
  customEventsMode: 'all' | 'specific' | 'interactive';
  setCustomEventsMode: (mode: 'all' | 'specific' | 'interactive') => void;
  urlPathOperator: string;
  setUrlPathOperator: (operator: string) => void;
  selectedPaths: string[];
  handlePathsChange: (paths: string[], operator: string, isInteractive?: boolean) => void;
  eventNameOperator: string;
  setEventNameOperator: (operator: string) => void;
  customEvents: string[];
  handleCustomEventsChange: (events: string[], operator: string) => void;
  availablePaths: string[];
  customEventsList: string[];
  filters: Filter[];
  OPERATORS: { value: string; label: string }[];
  onEnableCustomEvents?: () => void;
  // Advanced filters props
  stagingFilter?: Filter | null;
  setStagingFilter?: (filter: Filter | null) => void;
  addFilter?: (column: string) => void;
  commitStagingFilter?: () => void;
  parameters?: Parameter[];
  uniqueParameters?: any[];
  stagingAlertInfo?: { show: boolean, message: string };
  handleStagingAlertClose?: () => void;
  FILTER_COLUMNS?: any;
  EVENT_TYPES?: any[];
  // Active filter props
  removeFilter: (index: number) => void;
  updateFilter: (index: number, updates: Partial<Filter>) => void;
  isDateRangeFilter: (filter: Filter) => boolean;
  isEventsLoading?: boolean;
}

const EventSelector = ({
  selectedEventTypes,
  handleEventTypeChange,
  pageViewsMode,
  setPageViewsMode,
  customEventsMode,
  setCustomEventsMode,
  urlPathOperator,
  setUrlPathOperator,
  selectedPaths,
  handlePathsChange,
  availablePaths,
  customEventsList,
  OPERATORS,
  eventNameOperator,
  setEventNameOperator,
  customEvents,
  handleCustomEventsChange,
  onEnableCustomEvents,
  filters, // Ensure filters is destructured
  // Advanced filters props
  stagingFilter,
  setStagingFilter,
  addFilter,
  commitStagingFilter,
  parameters = [],
  uniqueParameters = [],
  stagingAlertInfo,
  handleStagingAlertClose,
  FILTER_COLUMNS,
  EVENT_TYPES,
  // Active filter props
  removeFilter,
  updateFilter,
  isDateRangeFilter,
  isEventsLoading = false
}: EventSelectorProps) => {

  const getCleanParamName = (param: Parameter): string => {
    const parts = param.key.split('.');
    return parts[parts.length - 1];
  };

  const getParamDisplayName = (param: Parameter): string => {
    const parts = param.key.split('.');
    return parts[parts.length - 1];
  };

  // Helper function for combobox options
  const getOptionsForColumn = (column: string, customEventsList: string[], availablePaths: string[]): { label: string, value: string }[] => {
    switch (column) {
      case 'event_name':
        return customEventsList.map(event => ({
          label: event || '',
          value: event || ''
        }));
      case 'url_path':
        return availablePaths.map(path => ({
          label: path,
          value: path
        }));
      case 'event_type':
        return EVENT_TYPES || [];
      default:
        return [];
    }
  };

  const activeFilterCount = filters.filter(f => !isDateRangeFilter(f)).length;

  return (
    <div className='mb-4'>
      <Heading level="3" size="xsmall" spacing>
        Hva vil du inkludere?
      </Heading>

      <div className="mt-3 bg-white p-4 rounded-md border shadow-inner">
        <Tabs defaultValue="sidestier" size="small">
          <Tabs.List>
            <Tabs.Tab value="sidestier" label="Sidevisninger" />
            <Tabs.Tab value="hendelser" label="Hendelser" />
            <Tabs.Tab value="flere_valg" label="Flere filtervalg" />
            <Tabs.Tab value="active_filters" label={`Aktive filtre (${activeFilterCount})`} />
          </Tabs.List>

          <Tabs.Panel value="sidestier" className="pt-6">
            <div className="space-y-4">

              {/*<Switch
                checked={selectedEventTypes.includes('pageviews')}
                onChange={(e) => handleEventTypeChange('pageviews', e.target.checked)}
              >
                Inkluder sidevisninger i grafen
              </Switch>*/}

              {selectedEventTypes.includes('pageviews') && (
                <div className="pl-0 mt-4">
                  <RadioGroup
                    legend="Hvilke sider?"
                    value={pageViewsMode}
                    onChange={(val) => {
                      const newMode = val as 'all' | 'specific' | 'interactive';
                      setPageViewsMode(newMode);

                      // Clear existing paths
                      handlePathsChange([], 'IN');

                      // Add interactive filter if selected - use Metabase parameter syntax directly
                      if (newMode === 'interactive') {
                        // Use Metabase parameter syntax: {{url_sti}}
                        handlePathsChange(['{{url_sti}}'], '=', true);
                      }
                    }}
                  >
                    <Radio value="all">Alle (hele nettstedet)</Radio>
                    <Radio value="specific">Utvalgte sider</Radio>
                    <Radio value="interactive">Mottaker velger selv</Radio>
                  </RadioGroup>

                  <div className="mt-4">
                    {pageViewsMode === 'specific' && (
                      <div className="bg-white p-4 rounded border">
                        <div className="mb-3">
                          <Select
                            label="URL-sti"
                            value={urlPathOperator}
                            onChange={(e) => {
                              const newOperator = e.target.value;
                              setUrlPathOperator(newOperator);

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
                            isMultiSelect={false}
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
                      </div>
                    )}
                    {pageViewsMode === 'interactive' && (
                      <div className="bg-white p-4 rounded border">
                        <div className="flex items-center gap-3">
                          <div className="flex-shrink-0">
                            <span className="flex items-center justify-center w-6 h-6 bg-green-100 rounded-full">
                              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-green-600">
                                <path d="M13.3 4.3L6 11.6L2.7 8.3C2.3 7.9 1.7 7.9 1.3 8.3C0.9 8.7 0.9 9.3 1.3 9.7L5.3 13.7C5.5 13.9 5.7 14 6 14C6.3 14 6.5 13.9 6.7 13.7L14.7 5.7C15.1 5.3 15.1 4.7 14.7 4.3C14.3 3.9 13.7 3.9 13.3 4.3Z" fill="currentColor" />
                              </svg>
                            </span>
                          </div>
                          <div>
                            <p className="text-gray-800">URL-sti kan velges som et filtervalg</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </Tabs.Panel>

          <Tabs.Panel value="hendelser" className="pt-6">
            <div className="space-y-4">
              <RadioGroup
                legend="Hvilke hendelser?"
                value={customEventsMode}
                onChange={(val) => {
                  const newMode = val as 'all' | 'specific' | 'interactive';

                  // Always trigger data loading for specific/interactive modes
                  if ((newMode === 'specific' || newMode === 'interactive') && onEnableCustomEvents) {
                    onEnableCustomEvents();
                  }

                  // Force update custom_events type if entering specific/interactive mode
                  // We remove the check to ensure filters are always re-synced correctly
                  if (newMode === 'specific' || newMode === 'interactive') {
                    handleEventTypeChange('custom_events', true);
                  }
                  // Also for 'all' mode, if we selected 'hendelser' tab, we probably want custom events?
                  // No, 'all' might mean just viewing filters.
                  // But if I click "Alle (ingen avgrensning)" inside "Hvilke hendelser", 
                  // I probably still want "custom_events" enabled if I am in the Events tab.
                  // But let's focus on the user's specific complaint about specific/interactive.

                  setCustomEventsMode(newMode);

                  // Clear events selection when changing modes
                  if (newMode === 'all' || newMode === 'interactive') {
                    handleCustomEventsChange([], 'IN');
                  }

                  // Special handling for interactive mode
                  if (newMode === 'interactive') {
                    handleCustomEventsChange(['{{event_name}}'], '=');
                  }
                }}
              >
                <Radio value="all">Alle (ingen avgrensning)</Radio>
                <Radio value="specific">Utvalgte hendelser</Radio>
                <Radio value="interactive">Mottaker velger selv</Radio>
              </RadioGroup>
              <div className="mt-4">
                {customEventsMode === 'specific' && (
                  <div className="bg-white p-4 rounded border">
                    {isEventsLoading && (
                      <div className="mb-4 text-sm text-gray-600 flex items-center gap-2">
                        <span className="w-4 h-4 border-2 border-gray-600 border-t-transparent rounded-full animate-spin" />
                        Laster hendelser...
                      </div>
                    )}
                    <div className="mb-3">
                      <Select
                        label="Hendelsesnavn"
                        value={eventNameOperator}
                        disabled={isEventsLoading}
                        onChange={(e) => {
                          const newOperator = e.target.value;
                          setEventNameOperator(newOperator);

                          // Update events format when switching between operators
                          if (customEvents.length > 0) {
                            if (newOperator === 'IN' || eventNameOperator === 'IN') {
                              handleCustomEventsChange(
                                customEvents,
                                newOperator
                              );
                            }
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
                        label="Velg hendelser"
                        description="Flere hendelser kan velges for 'er lik' operator"
                        disabled={isEventsLoading}
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
                        label="Velg hendelse"
                        description={
                          eventNameOperator === 'LIKE' ? "Søket vil matche hendelser som inneholder verdien" :
                            eventNameOperator === 'STARTS_WITH' ? "Søket vil finne hendelser som starter med verdien" :
                              eventNameOperator === 'ENDS_WITH' ? "Søket vil finne hendelser som slutter med verdien" :
                                null
                        }
                        disabled={isEventsLoading}
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
                  </div>
                )}
                {customEventsMode === 'interactive' && (
                  <div className="bg-white p-4 rounded border">
                    <div className="flex items-center gap-3">
                      <div className="flex-shrink-0">
                        <span className="flex items-center justify-center w-6 h-6 bg-green-100 rounded-full">
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-green-600">
                            <path d="M13.3 4.3L6 11.6L2.7 8.3C2.3 7.9 1.7 7.9 1.3 8.3C0.9 8.7 0.9 9.3 1.3 9.7L5.3 13.7C5.5 13.9 5.7 14 6 14C6.3 14 6.5 13.9 6.7 13.7L14.7 5.7C15.1 5.3 15.1 4.7 14.7 4.3C14.3 3.9 13.7 3.9 13.3 4.3Z" fill="currentColor" />
                          </svg>
                        </span>
                      </div>
                      <div>
                        <p className="text-gray-800">Hendelsesnavn kan velges som filtervalg</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

          </Tabs.Panel>

          <Tabs.Panel value="flere_valg" className="pt-6">
            <div className="mb-4">
              <Heading level="4" size="xsmall" className="mb-2">Legg til flere filtre</Heading>

              <div className="flex gap-2 items-center bg-white p-3 rounded-md border mt-3">
                <Select
                  label="Filtrér etter"
                  description="Legg til et filter for å velge hvilke data grafen/tabellen baseres på."
                  onChange={(e) => {
                    if (e.target.value && addFilter) {
                      addFilter(e.target.value);
                      (e.target as HTMLSelectElement).value = '';
                    }
                  }}
                  size="small"
                  className="flex-grow"
                >
                  <option value="">Velg filtre...</option>
                  {FILTER_COLUMNS && Object.entries(FILTER_COLUMNS).map(([groupKey, group]: [string, any]) => (
                    <optgroup key={groupKey} label={group.label}>
                      {group.columns
                        .filter((col: any) => col.value !== 'created_at')
                        .map((col: any) => (
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

              {stagingAlertInfo?.show && (
                <div className="mb-4 mt-4">
                  <AlertWithCloseButton variant="success" onClose={handleStagingAlertClose}>
                    {stagingAlertInfo.message}
                  </AlertWithCloseButton>
                </div>
              )}

              {stagingFilter && setStagingFilter && (
                <div className="mt-3 bg-white p-4 rounded-md border shadow-sm">
                  <div className="flex-1">
                    <div className="flex gap-2 items-end">
                      <Select
                        label="Kolonne"
                        value={stagingFilter.column}
                        onChange={(e) => setStagingFilter({ ...stagingFilter, column: e.target.value, operator: '=', value: '' })}
                        size="small"
                      >
                        {FILTER_COLUMNS && Object.entries(FILTER_COLUMNS).map(([groupKey, group]: [string, any]) => (
                          <optgroup key={groupKey} label={group.label}>
                            {group.columns.map((col: any) => (
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
                          <option value="INTERACTIVE">Filtervalg i Metabase</option>
                          {OPERATORS.map(op => (
                            <option key={op.value} value={op.value}>
                              {op.label}
                            </option>
                          ))}
                        </Select>
                      )}
                    </div>

                    <div className="mt-3">
                      {stagingFilter.operator === 'INTERACTIVE' && (
                        <div className="mt-3 bg-blue-50 p-3 rounded text-sm">
                          <p>
                            <strong>Filtervalg i Metabase:</strong> Dette filteret vil bli brukt som filtervalg i Metabase.
                          </p>
                          <p className="mt-1 text-xs text-gray-600">
                            Parameter vil være {stagingFilter.column === 'url_path' ? 'url_sti' :
                              stagingFilter.column === 'event_name' ? 'hendelse' :
                                stagingFilter.column.toLowerCase().replace(/[^a-z0-9_]/g, '_')}
                          </p>
                        </div>
                      )}

                      {!['IS NULL', 'IS NOT NULL', 'INTERACTIVE'].includes(stagingFilter.operator || '') &&
                        stagingFilter.column === 'event_type' && EVENT_TYPES && (
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

                      {!['IS NULL', 'IS NOT NULL', 'INTERACTIVE'].includes(stagingFilter.operator || '') &&
                        stagingFilter.column !== 'event_type' &&
                        stagingFilter.column !== 'created_at' && (
                          <UNSAFE_Combobox
                            label="Verdi"
                            description={stagingFilter.column === 'url_path' ? "Velg eller skriv inn URL-stier" :
                              stagingFilter.column === 'event_name' ? "Velg eller skriv inn hendelser" :
                                "Velg eller skriv inn verdier"}
                            options={getOptionsForColumn(stagingFilter.column, customEventsList, availablePaths)}
                            selectedOptions={stagingFilter.multipleValues?.map(v => v || '') ||
                              (stagingFilter.value ? [stagingFilter.value as string] : [])}
                            onToggleSelected={(option, isSelected) => {
                              if (option) {
                                const currentValues = stagingFilter.multipleValues ||
                                  (stagingFilter.value ? [stagingFilter.value as string] : []);
                                const newValues = isSelected
                                  ? [...new Set([...currentValues, option])]  // Ensure unique values
                                  : currentValues.filter(val => val !== option);

                                setStagingFilter({
                                  ...stagingFilter,
                                  operator: newValues.length > 1 ? 'IN' : stagingFilter.operator,
                                  multipleValues: newValues.length > 0 ? newValues : undefined,
                                  value: newValues.length > 0 ? newValues[0] : ''
                                });
                              }
                            }}
                            isMultiSelect={true}
                            size="small"
                            clearButton
                            allowNewValues={stagingFilter.column !== 'event_type'}
                            shouldAutocomplete={false}
                          />
                        )}
                    </div>
                  </div>
                  <div className="mt-4 flex justify-end gap-2">
                    <Button
                      variant="primary"
                      size="small"
                      onClick={commitStagingFilter}
                      disabled={!stagingFilter.operator || (!['IS NULL', 'IS NOT NULL', 'INTERACTIVE'].includes(stagingFilter.operator) && !stagingFilter.value)}
                    >
                      Legg til filter
                    </Button>
                    <Button
                      variant="tertiary"
                      size="small"
                      onClick={() => setStagingFilter(null)}
                    >
                      Avbryt
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </Tabs.Panel>

          <Tabs.Panel value="active_filters" className="pt-6">
            {filters.length === 0 && (
              <div className="text-sm text-gray-600">
                Ingen aktive filtre. Legg til et filter for å få mer spesifikke data.
              </div>
            )}

            {filters.length > 0 && (
              <div className="space-y-3">
                {/* Only show non-date range filters in the regular filter list */}
                {filters.map((filter, index) => !isDateRangeFilter(filter) && (
                  <div key={index} className="bg-white p-3 rounded border border-gray-200">
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex-1 space-y-2">
                        <div className="flex gap-2 items-end flex-wrap">
                          <Select
                            label="Kolonne"
                            value={filter.column}
                            onChange={(e) => updateFilter(index, { column: e.target.value, operator: '=', value: '' })}
                            size="small"
                            className="min-w-[150px]"
                          >
                            {FILTER_COLUMNS && Object.entries(FILTER_COLUMNS).map(([groupKey, group]: [string, any]) => (
                              <optgroup key={groupKey} label={group.label}>
                                {group.columns.map((col: any) => (
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
                            <div className="mb-1">
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                Filtervalg i Metabase
                              </span>
                            </div>
                          ) : (
                            // Only show for non-interactive eligible filters
                            <Button
                              variant="tertiary"
                              size="small"
                              className="mb-1"
                              onClick={() => {
                                // Simple inline interactive toggle without alert
                                const paramName = filter.column === 'url_path' ? 'url_sti' :
                                  filter.column === 'event_name' ? 'hendelse' :
                                    filter.column.toLowerCase().replace(/[^a-z0-9_]/g, '_');
                                updateFilter(index, {
                                  operator: '=',
                                  value: `{{${paramName}}}`,
                                  metabaseParam: true,
                                  interactive: true
                                });
                              }}
                            >
                              Gjør til filtervalg
                            </Button>
                          )}

                          {filter.column !== 'created_at' && !filter.interactive && (
                            <Select
                              label="Operator"
                              value={filter.operator || '='}
                              onChange={(e) => updateFilter(index, { operator: e.target.value, value: '' })}
                              size="small"
                              className="min-w-[100px]"
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
                          <div className="bg-blue-50 p-2 rounded text-sm">
                            Parameter: <strong>{filter.value?.toString().replace('{{', '').replace('}}', '')}</strong>
                          </div>
                        ) : (
                          // Existing value inputs for non-interactive filters
                          !['IS NULL', 'IS NOT NULL'].includes(filter.operator || '') && (
                            <div>
                              <UNSAFE_Combobox
                                label="Verdi"
                                description={null}
                                options={getOptionsForColumn(filter.column, customEventsList, availablePaths)} // Pass correct arrays
                                selectedOptions={Array.isArray(filter.multipleValues) ? filter.multipleValues.map(v => v || '') :
                                  (filter.value ? [filter.value as string] : [])}
                                onToggleSelected={(option, isSelected) => {
                                  if (option) {
                                    const currentValues = Array.isArray(filter.multipleValues) ? filter.multipleValues :
                                      (filter.value ? [filter.value as string] : []);
                                    const newValues = isSelected
                                      ? [...new Set([...currentValues, option])]
                                      : currentValues.filter(val => val !== option);

                                    updateFilter(index, {
                                      operator: newValues.length > 1 ? 'IN' : filter.operator,
                                      multipleValues: newValues.length > 0 ? newValues : undefined,
                                      value: newValues.length > 0 ? newValues[0] : ''
                                    });
                                  }
                                }}
                                isMultiSelect={true}
                                size="small"
                                clearButton
                                allowNewValues={filter.column !== 'event_type'}
                                shouldAutocomplete={false}
                              />
                            </div>
                          )
                        )}
                      </div>
                      <Button
                        variant="tertiary-neutral"
                        size="small"
                        onClick={() => removeFilter(index)}
                        className="mt-6"
                      >
                        Fjern
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Tabs.Panel>
        </Tabs>
      </div>
    </div >
  );
};

export default EventSelector;
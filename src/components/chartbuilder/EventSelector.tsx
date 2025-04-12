import { Heading, Checkbox, RadioGroup, Radio, Select, UNSAFE_Combobox } from '@navikt/ds-react';
import { Filter } from '../../types/chart';

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
  OPERATORS
}: EventSelectorProps) => {
  return (
    <div className='mb-4'>
      <Heading level="3" size="xsmall" spacing>
        Velg hendelse
      </Heading>
      
      <div className="mt-3 bg-white p-4 rounded-md border shadow-inner">
        <div className="space-y-2">
          {/* Pageviews section */}
          <div className="space-y-2">
            <Checkbox
              checked={selectedEventTypes.includes('pageviews')}
              onChange={(e) => handleEventTypeChange('pageviews', e.target.checked)}
            >
              Besøk
            </Checkbox>
            
            {selectedEventTypes.includes('pageviews') && (
              <div className="pl-4 ml-3 border-l">
                <RadioGroup 
                  legend="" 
                  hideLegend
                  value={pageViewsMode}
                  onChange={(val) => {
                    const newMode = val as 'all' | 'specific' | 'interactive';
                    setPageViewsMode(newMode);
                    
                    // Clear existing paths
                    handlePathsChange([], 'IN');
                    
                    // Add interactive filter if selected - create a special object with metabase parameter
                    if (newMode === 'interactive') {
                      // Create a parameter object that will signal the parent not to add quotes
                      const metabaseParam = {
                        type: 'metabase_param',
                        paramName: 'url_sti'
                      };
                      
                      // Pass this special object to the parent
                      handlePathsChange([metabaseParam] as any, '=', true);
                    }
                  }}
                >
                  <Radio value="all">Alle sider</Radio>
                  <Radio value="specific">Bestemte sider</Radio>
                  <Radio value="interactive">Interaktiv</Radio>
                </RadioGroup>
                
                {pageViewsMode === 'specific' && (
                  <div className="mt-4 pl-6">
                    <div className="flex gap-2 items-end mb-3 mt-4">
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
                  </div>
                )}
                
                {pageViewsMode === 'interactive' && (
                  <div className="mt-4 pl-6">
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
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Custom events section */}
          {customEventsList.length > 0 && (
            <div className="space-y-2">
              <Checkbox
                checked={selectedEventTypes.includes('custom_events')}
                onChange={(e) => handleEventTypeChange('custom_events', e.target.checked)}
              >
                Egendefinerte hendelser
              </Checkbox>
              
              {selectedEventTypes.includes('custom_events') && (
                <div className="pl-4 ml-3 border-l">
                  <RadioGroup 
                    legend="" 
                    hideLegend
                    value={customEventsMode}
                    onChange={(val) => setCustomEventsMode(val as 'all' | 'specific' | 'interactive')}
                  >
                    <Radio value="all">Alle hendelser</Radio>
                    <Radio value="specific">Bestemte hendelser</Radio>
                    <Radio value="interactive">Interaktiv</Radio>
                  </RadioGroup>
                  
                  {/* Rest of custom events UI */}
                  {/* ...existing code... */}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EventSelector;
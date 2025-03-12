import { useState, KeyboardEvent, ChangeEvent, useEffect } from 'react';
import { 
  Button, 
  VStack, 
  TextField, 
  HStack, 
  Accordion,
  Checkbox,
  BodyShort,
  Detail,
  Heading,
  Alert,
  Switch,
  Modal,
  Box,
  Tag,
  Loader
} from '@navikt/ds-react';
import { 
  PlusCircleIcon, 
  TrashIcon,
} from '@navikt/aksel-icons';
import { Parameter } from '../../types/chart';

interface EventParameterSelectorProps {
  availableEvents: string[];
  parameters: Parameter[];
  setParameters: (parameters: Parameter[]) => void;
}

// Enhanced structure to maintain event-parameter relationships
interface EventParams {
  [eventName: string]: string[];
}

// Constants for the fake event
const MANUAL_EVENT_NAME = '_manual_parameters_';
const MANUAL_EVENT_DISPLAY_NAME = 'Manuelt lagt til parametere';

const EventParameterSelector: React.FC<EventParameterSelectorProps> = ({
  availableEvents,
  parameters,
  setParameters
}) => {
  // State for selected events and UI controls
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);
  const [newParamKey, setNewParamKey] = useState<string>('');
  const [customParamAccordionOpen, setCustomParamAccordionOpen] = useState<boolean>(false);
  const [showGroupedView, setShowGroupedView] = useState<boolean>(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  
  // @ts-ignore Store event-parameter mapping to ensure proper relationship
  const [eventParamsMap, setEventParamsMap] = useState<EventParams>({});
  
  // Track if we have manually added parameters
  const [hasManualParameters, setHasManualParameters] = useState<boolean>(false);
  
  // Add loading state
  const [isLoading, setIsLoading] = useState<boolean>(true);
  
  // Cache for remembering parameters by event
  const [eventParameterCache, setEventParameterCache] = useState<Record<string, Parameter[]>>({});
  
  // Extract event-parameter map from the input parameters list
  useEffect(() => {
    const eventMap: EventParams = {};

    // Build a map of events to their parameters
    parameters.forEach(param => {
      if (param.key.includes('.')) {
        const [eventName, ...rest] = param.key.split('.');
        const paramName = rest.join('.');
        
        if (!eventMap[eventName]) {
          eventMap[eventName] = [];
        }
        
        if (!eventMap[eventName].includes(paramName)) {
          eventMap[eventName].push(paramName);
        }
      }
    });
    
    setEventParamsMap(eventMap);
  }, [parameters]);

  // Extract event-parameter map and cache all parameters by event
  useEffect(() => {
    const eventMap: EventParams = {};

    // Build a map of events to their parameters
    parameters.forEach(param => {
      if (param.key.includes('.')) {
        const [eventName, ...rest] = param.key.split('.');
        const paramName = rest.join('.');
        
        if (!eventMap[eventName]) {
          eventMap[eventName] = [];
        }
        
        if (!eventMap[eventName].includes(paramName)) {
          eventMap[eventName].push(paramName);
        }
      }
    });
    
    setEventParamsMap(eventMap);

    // Update our cache of parameters by event
    const parametersByEvent: Record<string, Parameter[]> = {};
    
    parameters.forEach(param => {
      if (param.key.includes('.')) {
        const [eventName] = param.key.split('.');
        
        if (!parametersByEvent[eventName]) {
          parametersByEvent[eventName] = [];
        }
        
        // Only add if not already in the cache
        if (!parametersByEvent[eventName].some(p => p.key === param.key)) {
          parametersByEvent[eventName].push(param);
        }
      }
    });
    
    // Merge with existing cache (don't overwrite what we have)
    setEventParameterCache(prev => {
      const newCache = {...prev};
      
      // For each event in the parameters, update the cache
      Object.keys(parametersByEvent).forEach(eventName => {
        if (!newCache[eventName]) {
          newCache[eventName] = [];
        }
        
        // Add any parameters not already in cache
        parametersByEvent[eventName].forEach(param => {
          if (!newCache[eventName].some(p => p.key === param.key)) {
            newCache[eventName].push(param);
          }
        });
      });
      
      return newCache;
    });
    
    // Indicate we're done loading after initial parameters are processed
    setIsLoading(false);
  }, [parameters]);

  // Check if we already have manual parameters on component mount
  useEffect(() => {
    const hasManual = parameters.some(p => p.key.startsWith(`${MANUAL_EVENT_NAME}.`));
    setHasManualParameters(hasManual);
    
    // If we have manual parameters but the event is not selected, select it
    if (hasManual && !selectedEvents.includes(MANUAL_EVENT_NAME)) {
      setSelectedEvents(prev => [...prev, MANUAL_EVENT_NAME]);
    }
  }, [parameters]);

  // Toggle event selection with proper parameter handling
  const toggleEvent = (event: string): void => {
    // Show confirmation dialog when trying to deselect manual event with parameters
    if (event === MANUAL_EVENT_NAME && 
        hasManualParameters && 
        selectedEvents.includes(MANUAL_EVENT_NAME)) {
      setShowConfirmModal(true);
      return;
    }

    if (selectedEvents.includes(event)) {
      // Remove event
      setSelectedEvents(prev => prev.filter(e => e !== event));
      
      // @ts-ignore Remove its parameters
      setParameters(prev => prev.filter(p => !p.key.startsWith(`${event}.`)));
      
      // If it was the manual event, update the flag
      if (event === MANUAL_EVENT_NAME) {
        setHasManualParameters(false);
      }
    } else {
      // Add event
      setSelectedEvents(prev => [...prev, event]);
      
      // Here's the key change: Use our cache to restore parameters
      if (eventParameterCache[event] && eventParameterCache[event].length > 0) {
        // @ts-ignore Add all cached parameters for this event
        setParameters(prev => {
          // Filter out any parameters already in the list
          const newParams = eventParameterCache[event].filter(
            cachedParam => !prev.some((p: Parameter) => p.key === cachedParam.key)
          );
          return [...prev, ...newParams];
        });
      }
    }
  };

  // Remove manual parameters and deselect manual event
  const confirmRemoveManualParameters = () => {
    // @ts-ignore
    setParameters(prev => prev.filter(p => !p.key.startsWith(`${MANUAL_EVENT_NAME}.`)));
    setSelectedEvents(prev => prev.filter(e => e !== MANUAL_EVENT_NAME));
    setHasManualParameters(false);
    setShowConfirmModal(false);
  };

  // Add custom parameter
  const addParameter = (): void => {
    if (!newParamKey.trim()) return;
    
    // Split by newlines and commas
    const newParams = newParamKey
      .split(/[\n,]/)
      .map(key => key.trim())
      .filter(key => key);

    if (newParams.length === 0) return;

    const paramsToAdd: Parameter[] = [];

    // Process each new parameter
    newParams.forEach(paramName => {
      // For manually added parameters, always use the manual event as prefix
      if (paramName.includes('.')) {
        // If it already has a dot, keep as is but change the event part
        const parts = paramName.split('.');
        const paramPart = parts.slice(1).join('.');
        paramsToAdd.push({ key: `${MANUAL_EVENT_NAME}.${paramPart}`, type: 'string' });
      } else {
        // Simple parameter, add with manual prefix
        paramsToAdd.push({ key: `${MANUAL_EVENT_NAME}.${paramName}`, type: 'string' });
      }
    });

    // Filter out duplicates
    const uniqueParams = paramsToAdd.filter(
      newParam => !parameters.some(p => p.key === newParam.key)
    );

    if (uniqueParams.length > 0) {
      // Add the manual event to selected events if not already there
      if (!selectedEvents.includes(MANUAL_EVENT_NAME)) {
        setSelectedEvents(prev => [...prev, MANUAL_EVENT_NAME]);
        setHasManualParameters(true);
      }
      
      // Add the parameters
      setParameters([...parameters, ...uniqueParams]);
      setNewParamKey('');
    }
  };

  // Add missing getUniqueParameters function
  const getUniqueParameters = () => {
    // Only include parameters from selected events
    const uniqueParams = new Map<string, Parameter>();
    
    parameters
      .filter(param => {
        if (!param.key.includes('.')) return false; // Skip non-event parameters
        const eventName = param.key.split('.')[0];
        return selectedEvents.includes(eventName);
      })
      .forEach(param => {
        const paramBase = param.key.split('.')[1]; // Get the parameter name without event
        if (!uniqueParams.has(paramBase)) {
          uniqueParams.set(paramBase, param);
        }
      });
    
    return Array.from(uniqueParams.values());
  };

  // Fix missing functions
  const removeParameter = (paramKey: string): void => {
    // @ts-ignore - paramBase might be undefined but it's handled by the filter
    const paramBase = paramKey.split('.')[1];
    setParameters(parameters.filter(p => !p.key.includes(`.${paramBase}`)));
  };

  const toggleParameterType = (paramKey: string, currentType: 'string' | 'number'): void => {
    const newType = currentType === 'string' ? 'number' : 'string';
    // @ts-ignore - paramBase might be undefined but it's handled by the filter
    const paramBase = paramKey.split('.')[1];
    // @ts-ignore
    setParameters(prev => prev.map(p => {
      if (p.key.includes(`.${paramBase}`)) {
        return { ...p, type: newType };
      }
      return p;
    }));
  };

  // Update the getGroupedParameters function
  const getGroupedParameters = () => {
    const groups: Record<string, Parameter[]> = {};
    
    // Create a group for each selected event
    selectedEvents.forEach(event => {
      // Get all parameters for this event
      const eventParams = parameters.filter(p => p.key.startsWith(`${event}.`));
      
      // Deduplicate parameters by their base name
      const uniqueParams = new Map<string, Parameter>();
      
      eventParams.forEach(param => {
        const baseName = param.key.split('.')[1]; // Get parameter name without event prefix
        if (!uniqueParams.has(baseName)) {
          uniqueParams.set(baseName, param);
        }
      });
      
      // Only add the group if we have parameters
      if (uniqueParams.size > 0) {
        groups[event] = Array.from(uniqueParams.values());
      }
    });
    
    return groups;
  };
  
  const uniqueParameters = getUniqueParameters();
  const groupedParameters = getGroupedParameters();
  const hasSelectedEvents = selectedEvents.length > 0;
  const hasParameters = parameters.length > 0;
  
  // Helper to generate a display name for parameters
  const getParameterDisplayName = (param: Parameter): string => {
    // For non-prefixed parameters, just show the key
    if (!param.key.includes('.')) {
      return param.key;
    }
    
    // For prefixed parameters, strip the prefix
    return param.key.split('.').slice(1).join('.');
  };

  // Get a display name for the events in the UI
  const getEventDisplayName = (eventName: string): string => {
    return eventName === MANUAL_EVENT_NAME ? MANUAL_EVENT_DISPLAY_NAME : eventName;
  };
  
  return (
    <VStack gap="6">
      <Box background="surface-subtle" borderRadius="medium">
        <div>
          <Heading level="3" size="small" spacing className="text-blue-600">
            Hendelser du ønsker å hente detaljer om
          </Heading>
        </div>

        {/* Available Events - With Loading State */}
        <div className="mt-4">
          {isLoading ? (
            <div className="p-4">
              <div className="flex items-center justify-center p-8">
                <div className="text-center">
                  <Loader size="2xlarge" />
                  <div className="mt-4 text-gray-600">Laster hendelser...</div>
                </div>
              </div>
            </div>
          ) : availableEvents.length === 0 ? (
            <div>
              <Alert variant="info" inline>
                Ingen egendefinerte hendelser funnet for denne nettsiden.
                <div className="mt-2">Du kan fortsatt legge til egendefinerte parametere manuelt.</div>
              </Alert>
            </div>
          ) : (
            <div className="p-4 bg-white">
              <div className="space-y-2">
                {/* Section for real events */}
                <div className="mb-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2">
                    {availableEvents.map(event => (
                      <div key={event} className="flex items-center">
                        <Checkbox 
                          checked={selectedEvents.includes(event)}
                          onChange={() => toggleEvent(event)}
                          className="items-center"
                        >
                          <div className="flex items-center">
                            <span>{event}</span>
                          </div>
                        </Checkbox>
                      </div>
                    ))}
                  </div>
                </div>
                
                {/* Separator if needed */}
                {hasManualParameters && availableEvents.length > 0 && (
                  <div className="border-t border-gray-200 my-3"></div>
                )}
                
                {/* Section for manual parameters */}
                {hasManualParameters && (
                  <div className="pt-1">
                    <div className="flex items-center">
                      <Checkbox
                        checked={selectedEvents.includes(MANUAL_EVENT_NAME)}
                        onChange={() => toggleEvent(MANUAL_EVENT_NAME)}
                      >
                        <div className="flex items-center">
                          <span>{MANUAL_EVENT_DISPLAY_NAME}</span>
                        </div>
                      </Checkbox>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </Box>

      {/* Parameters Section - Only shown when events are selected and not loading */}
      {hasSelectedEvents && !isLoading && (
        <Box background="surface-subtle" borderRadius="medium">
          <div className="flex justify-between items-center pb-2">
            <Heading level="3" size="small" className="text-blue-600">
              Detaljer du vil inkludere
            </Heading>
            {hasParameters && (
              <div className="flex items-center gap-2">
                <Switch 
                  size="small"
                  checked={showGroupedView}
                  onChange={() => setShowGroupedView(!showGroupedView)}
                >
                  Gruppert visning
                </Switch>
              </div>
            )}
          </div>
          
          <BodyShort size="small" spacing className="text-gray-600 mb-4">
            {showGroupedView
              ? "Viser detaljer gruppert etter hendelse."
              : "En og samme detalje kan tilhøre flere hendelser."
            }
          </BodyShort>
          
          {!showGroupedView ? (
            // Simple ungrouped view - with improved styling
            <div>
              {uniqueParameters.length === 0 ? (
                <Alert variant="info" inline>
                  Ingen detaljer er valgt enda. Legg til egendefinerte detaljer nedenfor.
                </Alert>
              ) : (
                <VStack gap="3">
                  {uniqueParameters.map((param) => {
                    const displayName = getParameterDisplayName(param);
                    const eventName = param.key.split('.')[0];
                    const isManual = eventName === MANUAL_EVENT_NAME;
                    
                    return (
                      <div 
                        key={param.key}
                        className={`flex items-center justify-between p-3 rounded border ${isManual ? 'bg-blue-50' : 'bg-white'}`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{displayName}</span>
                          {isManual && <Tag variant="info" size="xsmall">Manuelt lagt til</Tag>}
                        </div>
                        <HStack gap="2">
                          <Button
                            variant="secondary"
                            size="small"
                            onClick={() => toggleParameterType(param.key, param.type)}
                            className="min-w-[80px]"
                          >
                            {param.type === 'string' ? '📝 Tekst' : '🔢 Tall'}
                          </Button>
                          <Button
                            variant="secondary"
                            size="small"
                            icon={<TrashIcon title="Fjern" />}
                            onClick={() => removeParameter(param.key)}
                          />
                        </HStack>
                      </div>
                    );
                  })}
                </VStack>
              )}
            </div>
          ) : (
            // Grouped view by event - with improved styling
            <Accordion>
              {/* Add selected event parameters */}
              {Object.keys(groupedParameters).map(eventName => (
                <Accordion.Item key={eventName}>
                  <Accordion.Header className={eventName === MANUAL_EVENT_NAME ? 'bg-blue-50' : 'bg-white'}>
                    <span className="flex items-center gap-2">
                      {eventName === MANUAL_EVENT_NAME ? '✍️' : '🎯'} {getEventDisplayName(eventName)}
                      <span className="text-sm text-gray-600">
                        ({groupedParameters[eventName]?.length || 0} {groupedParameters[eventName]?.length === 1 ? 'detalj' : 'detaljer'})
                      </span>
                    </span>
                  </Accordion.Header>
                  <Accordion.Content className={eventName === MANUAL_EVENT_NAME ? 'bg-blue-50/30' : ''}>
                    <VStack gap="3" className="-ml-8 mt-5">
                      {groupedParameters[eventName]?.map((param) => {
                        const displayName = getParameterDisplayName(param);
                        
                        return (
                          <div 
                            key={param.key}
                            className="flex items-center justify-between p-3 bg-white rounded border"
                          >
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{displayName}</span>
                            </div>
                            <HStack gap="2">
                              <Button
                                variant="tertiary"
                                size="small"
                                onClick={() => toggleParameterType(param.key, param.type)}
                                className="min-w-[80px]"
                              >
                                {param.type === 'string' ? '📝 Tekst' : '🔢 Tall'}
                              </Button>
                              <Button
                                variant="danger"
                                size="small"
                                icon={<TrashIcon title="Fjern" />}
                                onClick={() => removeParameter(param.key)}
                              />
                            </HStack>
                          </div>
                        );
                      })}
                    </VStack>
                  </Accordion.Content>
                </Accordion.Item>
              ))}
            </Accordion>
          )}
        </Box>
      )}
      
      {/* Add Custom Parameters Section - Only when not loading */}
      {!isLoading && (
        <Box background="surface-subtle" borderRadius="medium">
          <Accordion className="pt-0">
            <Accordion.Item open={customParamAccordionOpen}>
              <Accordion.Header 
                onClick={() => setCustomParamAccordionOpen(!customParamAccordionOpen)}
                className="bg-blue-50"
              >
                <span className="flex items-center gap-2">
                  <span className="font-medium">Legg til parametere manuelt</span>
                </span>
              </Accordion.Header>
              <Accordion.Content className="bg-blue-50/30">
                <VStack gap="4">      
                  <div className="flex gap-2 mt-4 items-end">
                    <TextField 
                      label="Parameter"
                      description="Du kan legge til flere parametere med komma"
                      value={newParamKey}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => setNewParamKey(e.target.value)}
                      onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => e.key === 'Enter' && addParameter()}
                      style={{ width: '100%' }}
                    />
                    <Button 
                      variant="secondary" 
                      onClick={addParameter}
                      icon={<PlusCircleIcon aria-hidden />}
                      style={{ height: '50px' }}
                    >
                      Legg til
                    </Button>
                  </div>
                  
                  <Detail className="text-gray-600">
                    Parametere vil legges til under "Manuelt lagt til parametere".
                  </Detail>
                </VStack>
              </Accordion.Content>
            </Accordion.Item>
          </Accordion>
        </Box>
      )}

      {/* Confirmation Modal for removing manual parameters */}
      <Modal
        open={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        header={{ heading: "Fjerne manuelt lagt til parametere?" }}
        width="small"
      >
        <Modal.Body>
          <p>
            Ved å fjerne denne gruppen vil alle manuelt lagt til parametere bli slettet.
            Er du sikker på at du vil fortsette?
          </p>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="danger" onClick={confirmRemoveManualParameters}>
            Ja, fjern parametere
          </Button>
          <Button variant="secondary" onClick={() => setShowConfirmModal(false)}>
            Avbryt
          </Button>
        </Modal.Footer>
      </Modal>
    </VStack>
  );
};

export default EventParameterSelector;

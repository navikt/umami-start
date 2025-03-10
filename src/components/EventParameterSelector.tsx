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
  Panel,
  Alert,
  Switch,
  Tooltip,
  Modal,
  Box,
  Tag
} from '@navikt/ds-react';
import { 
  PlusCircleIcon, 
  TrashIcon,
  InformationSquareIcon
} from '@navikt/aksel-icons';
import { Parameter } from '../types/chart';

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
      
      // Find parameters for this event from the input parameters list
      const eventParams = parameters
        .filter(p => p.key.startsWith(`${event}.`))
        .map(p => p);
        
      // If we have specific parameters for this event, add them
      if (eventParams.length > 0) {
        // @ts-ignore
        setParameters(prev => [...prev, ...eventParams]);
      }
    }
  };

  // Remove manual parameters and deselect manual event
  const confirmRemoveManualParameters = () => {
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
      // Handle parameters with or without prefixes
      if (paramName.includes('.')) {
        // Parameter already has a dot - check if it's for a selected event
        const [eventPart, ...rest] = paramName.split('.');
        const paramPart = rest.join('.');
        
        if (selectedEvents.includes(eventPart)) {
          // Add to specified event if it's selected
          paramsToAdd.push({ key: paramName, type: 'string' });
        } else {
          // If event not selected, add to manual parameters
          paramsToAdd.push({ key: `${MANUAL_EVENT_NAME}.${paramPart}`, type: 'string' });
        }
      } else if (selectedEvents.length === 1 && selectedEvents[0] !== MANUAL_EVENT_NAME) {
        // One non-manual event selected, use it as prefix
        paramsToAdd.push({ key: `${selectedEvents[0]}.${paramName}`, type: 'string' });
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
      // Check if we're adding manual parameters
      const hasNewManualParams = uniqueParams.some(p => p.key.startsWith(`${MANUAL_EVENT_NAME}.`));
      
      // Add the manual event to selected events if needed
      if (hasNewManualParams && !selectedEvents.includes(MANUAL_EVENT_NAME)) {
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
            1. Velg hendelser
          </Heading>
          <BodyShort size="small" spacing className="text-gray-600">
            Velg hvilke hendelser du vil inkludere i grafen / tabellen din.
          </BodyShort>
        </div>

        {/* Available Events - Improved Layout */}
        <div className="mt-4">
          {availableEvents.length === 0 ? (
            <Panel border>
              <Alert variant="info" inline>
                Ingen egendefinerte hendelser funnet for denne nettsiden.
                <div className="mt-2">Du kan fortsatt legge til egendefinerte parametere manuelt nedenfor.</div>
              </Alert>
            </Panel>
          ) : (
            <Panel border className="p-4 bg-white">
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
                          <Tag variant="info" size="small" className="ml-2">Manuell</Tag>
                        </div>
                      </Checkbox>
                    </div>
                  </div>
                )}
              </div>
            </Panel>
          )}
        </div>
      </Box>

      {/* Parameters Section - Only shown when events are selected */}
      {hasSelectedEvents && (
        <Box background="surface-subtle" borderRadius="medium">
          <div className="flex justify-between items-center pb-2">
            <Heading level="3" size="small" className="text-blue-600">
              2. Velg detaljer til analysen
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
            Velg hvilke detaljer du vil inkludere i analysen.
          </BodyShort>
          
          {!showGroupedView ? (
            // Simple ungrouped view - with improved styling
            <Panel border>
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
                          {isManual && <Tag variant="info" size="xsmall">Manuell</Tag>}
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
              )}
            </Panel>
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
                      {eventName === MANUAL_EVENT_NAME && <Tag variant="info" size="xsmall">Manuell</Tag>}
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
      
      {/* Add Custom Parameters Section - Improved */}
      <Box background="surface-subtle" borderRadius="medium">
        <Accordion className="pt-0">
          <Accordion.Item open={customParamAccordionOpen}>
            <Accordion.Header 
              onClick={() => setCustomParamAccordionOpen(!customParamAccordionOpen)}
              className="bg-blue-50"
            >
              <span className="flex items-center gap-2">
                <PlusCircleIcon aria-hidden width="1.25rem" height="1.25rem" />
                <span className="font-medium">Legg til parametere manuelt</span>
              </span>
            </Accordion.Header>
            <Accordion.Content className="bg-blue-50/30">
              <VStack gap="4">      
                <div className="flex gap-2 items-end">
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
                  {selectedEvents.length === 1 && selectedEvents[0] !== MANUAL_EVENT_NAME ? (
                    <>Parametere vil legges til under <strong>{selectedEvents[0]}</strong>.</>
                  ) : (
                    'Parametere vil legges til under "Manuelt lagt til parametere".'
                  )}
                </Detail>
              </VStack>
            </Accordion.Content>
          </Accordion.Item>
        </Accordion>
      </Box>

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

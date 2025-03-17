import { useState, KeyboardEvent, ChangeEvent, useEffect } from 'react';
import { 
  Button, 
  VStack, 
  TextField, 
  HStack, 
  Accordion,
  BodyShort,
  Alert,
  Heading,
  Modal,
  Box,
  Tag,
  ReadMore
} from '@navikt/ds-react';
import { 
  PlusCircleIcon
} from '@navikt/aksel-icons';
import { Parameter } from '../../types/chart';

interface EventParameterSelectorProps {
  availableEvents: string[];
  parameters: Parameter[];
  setParameters: (parameters: Parameter[]) => void;
  initiallySelectAll?: boolean; // New optional prop to control initial selection
}
// Enhanced structure to maintain event-parameter relationships
interface EventParams {
  [eventName: string]: string[];
}

// Constants for the fake event
const MANUAL_EVENT_NAME = '_manual_parameters_';
const MANUAL_EVENT_DISPLAY_NAME = 'manuelt lagt til';

const EventParameterSelector: React.FC<EventParameterSelectorProps> = ({
  availableEvents,
  parameters,
  setParameters,
  initiallySelectAll = true // Default to true to select all events initially
}) => {
  const [selectedEvents, setSelectedEvents] = useState<string[]>(
    initiallySelectAll ? availableEvents : []
  );
  // State for selected events and UI controls
  const [newParamKey, setNewParamKey] = useState<string>('');
  const [customParamAccordionOpen, setCustomParamAccordionOpen] = useState<boolean>(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  
  // @ts-ignore Store event-parameter mapping to ensure proper relationship
  const [eventParamsMap, setEventParamsMap] = useState<EventParams>({});
  
  // Add loading state
  const [isLoading, setIsLoading] = useState<boolean>(true);
  
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
    
    
    // Indicate we're done loading after initial parameters are processed
    setIsLoading(false);
  }, [parameters]);

  // Check if we already have manual parameters on component mount
  useEffect(() => {
    const hasManual = parameters.some(p => p.key.startsWith(`${MANUAL_EVENT_NAME}.`));
    
    // If we have manual parameters but the event is not selected, select it
    if (hasManual && !selectedEvents.includes(MANUAL_EVENT_NAME)) {
      setSelectedEvents(prev => [...prev, MANUAL_EVENT_NAME]);
    }
  }, [parameters]);

  // Remove manual parameters and deselect manual event
  const confirmRemoveManualParameters = () => {
    // @ts-ignore
    setParameters(prev => prev.filter(p => !p.key.startsWith(`${MANUAL_EVENT_NAME}.`)));
    setSelectedEvents(prev => prev.filter(e => e !== MANUAL_EVENT_NAME));
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
      }
      
      // Add the parameters
      setParameters([...parameters, ...uniqueParams]);
      setNewParamKey('');
    }
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

  useEffect(() => {
    console.log('Initial available events:', availableEvents);
    if (initiallySelectAll && availableEvents.length > 0) {
      setSelectedEvents(availableEvents);
    }
  }, [availableEvents]);

const getGroupedParameters = () => {
  const groups: Record<string, Parameter[]> = {};
  
  // Create a group for each selected event
  selectedEvents.forEach(event => {
    // Initialize the group even if there are no parameters
    groups[event] = [];
    
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
    
    // Add parameters if we have any
    if (uniqueParams.size > 0) {
      groups[event] = Array.from(uniqueParams.values());
    }
  });
  
  return groups;
};
  
  const groupedParameters = getGroupedParameters();
  
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
      {/* Parameters Section - Only shown when events are selected and not loading */}
      {!isLoading && (
        <Box background="surface-subtle" borderRadius="medium">
          <div className="flex justify-between items-center pb-2">
            <Heading level="3" size="small" className="text-blue-600">
              Utforsk egendefinerte hendelser og detaljer
            </Heading>
          </div>

          {!isLoading && availableEvents.length === 0 && !parameters.some(p => p.key.startsWith(MANUAL_EVENT_NAME)) && (
            <Alert variant="info" inline className="mt-3">
              Ingen egendefinerte hendelser eller detaljer funnet.
            </Alert>
          )}

          {!isLoading && (parameters.some(p => p.key.startsWith(MANUAL_EVENT_NAME)) || availableEvents.length > 0) && (
            <BodyShort size="small" spacing className="text-gray-600 pt-1 pb-3">
              Detaljer er forhåndsatt som tekst. Du kan endre til tall der det er relevant.
            </BodyShort>
          )}
  
          {!isLoading && availableEvents.length > 0 && (
            <Accordion>
              {Object.keys(groupedParameters).map(eventName => (
                <Accordion.Item key={eventName}>
                  <Accordion.Header className={eventName === MANUAL_EVENT_NAME ? 'bg-white' : 'bg-white'}>
                    <span className="flex items-center gap-2">
                     {
                        (eventName && getEventDisplayName(eventName) && 
                        getEventDisplayName(eventName) !== "null") ? 
                          getEventDisplayName(eventName) : 
                          <>
                          sidevisning
                          <Tag size="xsmall" variant="info" className="whitespace-nowrap">standard</Tag>
                        </>
                      }
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
                                variant="secondary"
                                size="small"
                                onClick={() => toggleParameterType(param.key, param.type)}
                                className="min-w-[80px]"
                              >
                                {param.type === 'string' ? '📝 Tekst' : '🔢 Tall'}
                              </Button>
                              {parameters.some(p => p.key.startsWith(MANUAL_EVENT_NAME)) && (
                              <Button
                                variant="tertiary"
                                size="small"
                                onClick={() => removeParameter(param.key)}
                              >Fjern</Button>
                              )}
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
        <div className="-mt-2">
          <ReadMore 
            header="Legg til hendelsesdetaljer manuelt" 
            defaultOpen={customParamAccordionOpen}
            onClick={() => setCustomParamAccordionOpen(!customParamAccordionOpen)}
          >
            <VStack gap="4">      
              <div className="flex gap-2 mt-4 items-end">
                <TextField 
                  label="Hendelsesdetalj"
                  description="Du kan legge til flere med komma"
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
            </VStack>
          </ReadMore>
        </div>
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

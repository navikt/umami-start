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
  Tag,
  ReadMore,
  Panel,
  Alert,
  Switch,
  Tooltip,
  Badge
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
  
  // Store event-parameter mapping to ensure proper relationship
  const [eventParamsMap, setEventParamsMap] = useState<EventParams>({});
  
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

  // Toggle event selection with proper parameter handling
  const toggleEvent = (event: string): void => {
    if (selectedEvents.includes(event)) {
      // Remove event
      setSelectedEvents(prev => prev.filter(e => e !== event));
      
      // Remove its parameters
      setParameters(prev => prev.filter(p => !p.key.startsWith(`${event}.`)));
    } else {
      // Add event
      setSelectedEvents(prev => [...prev, event]);
      
      // Find parameters for this event from the input parameters list
      const eventParams = parameters
        .filter(p => p.key.startsWith(`${event}.`))
        .map(p => p);
        
      // If we have specific parameters for this event, add them
      if (eventParams.length > 0) {
        setParameters(prev => [...prev, ...eventParams]);
      }
    }
  };

  // Add custom parameter
  const addParameter = (): void => {
    if (!newParamKey.trim()) return;
    
    // Split by newlines and commas
    const newParams = newParamKey
      .split(/[\n,]/)
      .map(key => key.trim())
      .filter(key => key);

    const paramsToAdd: Parameter[] = [];

    // Process each new parameter
    newParams.forEach(paramName => {
      // Check if parameter already contains event prefix (has a dot)
      if (paramName.includes('.')) {
        // Keep as is
        paramsToAdd.push({ key: paramName, type: 'string' });
      } else if (selectedEvents.length === 1) {
        // If there's a selected event and only one, use it as prefix
        paramsToAdd.push({ key: `${selectedEvents[0]}.${paramName}`, type: 'string' });
      } else {
        // Otherwise, handle as generic parameter (with warning)
        if (selectedEvents.length > 1) {
          // Multiple events selected, show warning or add to all
          selectedEvents.forEach(event => {
            paramsToAdd.push({ key: `${event}.${paramName}`, type: 'string' });
          });
        } else {
          // No events selected, can't add parameter
          alert("Velg minst én hendelse før du legger til detaljer");
          return;
        }
      }
    });

    // Filter out duplicates 
    const uniqueParams = paramsToAdd.filter(
      newParam => !parameters.some(p => p.key === newParam.key)
    );

    setParameters([...parameters, ...uniqueParams]);
    setNewParamKey('');
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
  
  return (
    <VStack gap="6">
      <div>
        <Heading level="3" size="small" spacing>
          1. Velg hendelsene du vil analysere
        </Heading>
        <BodyShort size="small" spacing>
          Velg hvilke hendelser du vil inkludere i analysen.
        </BodyShort>
      </div>

      {/* Available Events */}
      <div>
        {availableEvents.length === 0 ? (
          <Alert variant="info" inline>
            Ingen egendefinerte hendelser funnet for denne nettsiden.
          </Alert>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {availableEvents.map(event => (
              <Checkbox 
                key={event}
                checked={selectedEvents.includes(event)}
                onChange={() => toggleEvent(event)}
              >
                {event}
              </Checkbox>
            ))}
          </div>
        )}
      </div>

      {/* Parameters Section - Only shown when events are selected */}
      {hasSelectedEvents && (
        <div className="border-t pt-4">
          <div className="flex justify-between items-center pb-2">
            <Heading level="3" size="small">
              2. Velg detaljer til analysen
            </Heading>
            {hasParameters && (
              <div className="flex items-center gap-2">
                <BodyShort size="small">Vis alle</BodyShort>
                <Switch 
                  size="small"
                  checked={showGroupedView}
                  onChange={() => setShowGroupedView(!showGroupedView)}
                />
                <BodyShort size="small">Vis gruppert</BodyShort>
                <Tooltip content="Grupperer detaljene etter hendelsestype">
                  <Button 
                    icon={<InformationSquareIcon aria-hidden />} 
                    size="xsmall" 
                    variant="tertiary"
                  />
                </Tooltip>
              </div>
            )}
          </div>
          
          {!showGroupedView ? (
            // Simple ungrouped view - unique parameters shown in a flat list
            <Panel border className="bg-gray-50">
              {uniqueParameters.length === 0 ? (
                <Alert variant="info" inline>
                  Ingen detaljer er valgt enda. Legg til egendefinerte detaljer nedenfor.
                </Alert>
              ) : (
                <VStack gap="3">
                  {uniqueParameters.map((param) => {
                    const displayName = getParameterDisplayName(param);
                    
                    return (
                      <div 
                        key={param.key}
                        className="flex items-center justify-between p-2 bg-white rounded border"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{displayName}</span>
                        </div>
                        <HStack gap="2">
                          <Button
                            variant="tertiary"
                            size="small"
                            onClick={() => toggleParameterType(param.key, param.type)}
                          >
                            {param.type === 'string' ? '📝 Tekst' : '🔢 Tall'}
                          </Button>
                          <Button
                            variant="danger-tertiary"
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
            // Grouped view by event
            <Accordion>
              {/* Add selected event parameters */}
              {Object.keys(groupedParameters).map(eventName => (
                <Accordion.Item key={eventName}>
                  <Accordion.Header>
                    <span className="flex items-center gap-2">
                      🎯 {eventName}
                      <span className="text-sm text-gray-600">
                        ({groupedParameters[eventName]?.length || 0} {groupedParameters[eventName]?.length === 1 ? 'detalj' : 'detaljer'})
                      </span>
                    </span>
                  </Accordion.Header>
                  <Accordion.Content>
                    <VStack gap="3">
                      {groupedParameters[eventName]?.map((param) => {
                        const displayName = getParameterDisplayName(param);
                        
                        return (
                          <div 
                            key={param.key}
                            className="flex items-center justify-between p-2 bg-white rounded border"
                          >
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{displayName}</span>
                            </div>
                            <HStack gap="2">
                              <Button
                                variant="tertiary"
                                size="small"
                                onClick={() => toggleParameterType(param.key, param.type)}
                              >
                                {param.type === 'string' ? '📝 Tekst' : '🔢 Tall'}
                              </Button>
                              <Button
                                variant="danger-tertiary"
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
        </div>
      )}
      
      {/* Add Custom Parameters Section */}
      <div className="mt-2 border-t">
        <Accordion className="pt-6">
          <Accordion.Item open={customParamAccordionOpen}>
            <Accordion.Header 
              onClick={() => setCustomParamAccordionOpen(!customParamAccordionOpen)}
            >
              <span className="flex items-center gap-2">
                <PlusCircleIcon aria-hidden size="1.25rem" />
                Legg til parametere manuelt
              </span>
            </Accordion.Header>
            <Accordion.Content>
              <VStack gap="4">
                <ReadMore header="Hva er egendefinerte detaljer?">
                  <BodyShort spacing>
                    Egendefinerte detaljer er ekstra informasjon som sendes med hendelser. 
                    For eksempel kan en "skjema fullført"-hendelse ha detaljer som "skjemanavn" eller "tid_brukt".
                  </BodyShort>
                  <BodyShort spacing>
                    Hvis du sender med egendefinerte detaljer når du sporer hendelser, kan du legge dem til her for å inkludere dem i analysen.
                  </BodyShort>
                </ReadMore>
                
                <div className="flex gap-2 items-end">
                  <TextField 
                    label="Legg til detaljer"
                    description="Skriv inn ett eller flere detalj-navn (kommaseparert)"
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
                
                {selectedEvents.length === 1 && (
                  <Detail className="text-gray-600">
                    Detaljene vil automatisk knyttes til hendelsen <strong>{selectedEvents[0]}</strong>
                  </Detail>
                )}
                
                {selectedEvents.length === 0 && (
                  <Detail className="text-gray-600">
                    Velg én hendelse først for å knytte detaljer til den hendelsen
                  </Detail>
                )}
              </VStack>
            </Accordion.Content>
          </Accordion.Item>
        </Accordion>
      </div>
    </VStack>
  );
};

export default EventParameterSelector;

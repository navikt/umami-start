import { KeyboardEvent, useState, useEffect } from 'react';
import { Button, TextField, Label, Select, Chips } from '@navikt/ds-react';
import { Parameter } from '../types/chart';

interface CustomParametersProps {
  parameters: Parameter[];
  newParameter: string;
  setNewParameter: (value: string) => void;
  setParameters: (parameters: Parameter[]) => void;
  suggestedEvents?: string[];
}

const CustomParameters = ({
  parameters,
  newParameter,
  setNewParameter,
  setParameters,
  suggestedEvents = []
}: CustomParametersProps) => {
  const [showSuggestions, setShowSuggestions] = useState<boolean>(false);
  
  // Show suggestions if we have them and no parameters yet
  useEffect(() => {
    if (suggestedEvents.length > 0 && parameters.length === 0) {
      setShowSuggestions(true);
    }
  }, [suggestedEvents, parameters.length]);

  const addParameter = (): void => {
    if (!newParameter.trim()) return;
    
    const params = newParameter
      .split(/[\n,]/)
      .map(param => param.trim())
      .filter(param => param && !parameters.some(p => p.key === param));
    
    if (params.length) {
      setParameters([
        ...parameters,
        ...params.map(param => ({ key: param, type: 'string' as 'string' }))
      ]);
      setNewParameter('');
    }
  };

  const addSuggestedEvent = (event: string): void => {
    if (!parameters.some(p => p.key === event)) {
      setParameters([
        ...parameters,
        { key: event, type: 'string' }
      ]);
    }
  };
  
  const removeParameter = (keyToRemove: string): void => {
    setParameters(parameters.filter(param => param.key !== keyToRemove));
  };
  
  const toggleParameterType = (key: string) => {
    // @ts-ignore
    setParameters(prev => prev.map(param => 
      param.key === key 
        ? { ...param, type: param.type === 'string' ? 'number' : 'string' }
        : param
    ));
  };
  
  const handleParameterKeyPress = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addParameter();
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <Label as="p">Legg til egendefinerte parametere</Label>
        <p className="text-sm text-gray-600 mt-1">
          Legg til parametere du vil hente ut fra hendelsene (f.eks. knapp-navn, skjemanavn, osv)
        </p>
      </div>

      <div className="flex gap-2 items-end">
        <TextField
          label="Parameter"
          description="Eksempel: skjemanavn (legg til flere med komma)"
          value={newParameter}
          onChange={(e) => setNewParameter(e.target.value)}
          onKeyUp={handleParameterKeyPress}
          style={{ width: '100%' }}
        />
        <Button 
          variant="secondary" 
          onClick={addParameter}
          style={{ height: '42px' }}
        >
          Legg til
        </Button>
      </div>

      {/* Suggested events section */}
      {suggestedEvents.length > 0 && (
        <div className="bg-blue-50 p-3 rounded-md border border-blue-100">
          <div className="flex justify-between items-center mb-2">
            <Label as="p" size="small">
              Oppdagede hendelser på nettsiden:
            </Label>
            <Button 
              variant="tertiary" 
              size="small" 
              onClick={() => setShowSuggestions(!showSuggestions)}
            >
              {showSuggestions ? 'Skjul' : 'Vis'} ({suggestedEvents.length})
            </Button>
          </div>
          
          {showSuggestions && (
            <Chips className="flex-wrap gap-2">
              {suggestedEvents.map(event => (
                <Chips.Toggle 
                  key={event} 
                  variant="action" 
                  onClick={() => addSuggestedEvent(event)}
                  checkmark={parameters.some(p => p.key === event)}
                >
                  {event}
                </Chips.Toggle>
              ))}
            </Chips>
          )}
        </div>
      )}

      {parameters.length > 0 && (
        <div className="space-y-2 mt-4">
          <Label as="p" size="small">
            Valgte parametere:
          </Label>
          <div className="flex flex-col gap-2">
            {parameters.map((param) => (
              <div 
                key={param.key} 
                className="flex items-center justify-between bg-white px-4 py-2 rounded-md border"
              >
                <span className="font-medium">
                  {param.key}
                </span>
                <div className="flex items-center gap-2">
                  <Select 
                    label=""
                    size="small"
                    value={param.type}
                    className="!w-auto min-w-[120px]"
                    onChange={() => toggleParameterType(param.key)}
                  >
                    <option value="string">📝 Tekst</option>
                    <option value="number">🔢 Tall</option>
                  </Select>
                  <Button
                    variant="tertiary-neutral"
                    size="small"
                    onClick={() => removeParameter(param.key)}
                  >
                    Fjern
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomParameters;

import { KeyboardEvent } from 'react';
import { Button, TextField, Label, Link, Select } from '@navikt/ds-react';

interface Parameter {
  key: string;
  type: 'string' | 'number';
}

interface CustomParametersProps {
  parameters: Parameter[];
  newParameter: string;
  setNewParameter: (value: string) => void;
  setParameters: (parameters: Parameter[]) => void;
}

const CustomParameters = ({
  parameters,
  newParameter,
  setNewParameter,
  setParameters
}: CustomParametersProps) => {
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
  
  const removeParameter = (keyToRemove: string): void => {
    setParameters(parameters.filter(param => param.key !== keyToRemove));
  };
  
  const toggleParameterType = (key: string) => {
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
    <div className="space-y-6 bg-gray-50 p-5 rounded-md border">  
      <div className="space-y-4">
        <div className="flex gap-2 items-end">
          <TextField
            label="Egendefinerte event-parametere"
            description="Eksempel: skjemanavn (legg til flere med komma)"
            value={newParameter}
            onChange={(e) => setNewParameter(e.target.value)}
            onKeyUp={handleParameterKeyPress}
            style={{ width: '100%' }}
          />
          <Button 
            variant="secondary" 
            onClick={addParameter}
            style={{ height: '50px' }}
          >
            Legg til
          </Button>
        </div>

        {parameters.length > 0 && (
          <div className="space-y-2">
            <Label as="p" size="small">
              Valgte parametere:
            </Label>
            <div className="flex flex-col gap-2">
              {parameters.map((param) => (
                <div 
                  key={param.key} 
                  className="flex items-center justify-between bg-white px-4 py-3 rounded-md border"
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
        
        <div className="mt-2 text-sm italic text-gray-600">
          <p>
            For å finne tilgjengelige parametere for din nettside / app, bruk <Link href="/datastruktur" target='_blank'>Datastruktur-verktøyet</Link>.
          </p>
        </div>
      </div>
    </div>
  );
};

export default CustomParameters;

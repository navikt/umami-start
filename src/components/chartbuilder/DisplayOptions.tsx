import { Button, Heading, Select, Label, TextField, Switch, HelpText, Tabs } from '@navikt/ds-react';
import { MoveUp, MoveDown, Calendar, Link2, Activity, Smartphone } from 'lucide-react';
import { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { 
  Parameter, 
  DateFormat, 
  ColumnGroup,
  OrderBy,
  Metric
} from '../../types/chart';
import AlertWithCloseButton from './AlertWithCloseButton'; // Import AlertWithCloseButton

interface DisplayOptionsProps {
  groupByFields: string[];
  parameters: Parameter[];
  dateFormat: string | null;
  orderBy: OrderBy | null;
  paramAggregation: 'representative' | 'unique';
  limit: number | null;
  DATE_FORMATS: DateFormat[];
  COLUMN_GROUPS: Record<string, ColumnGroup>;
  sanitizeColumnName: (key: string) => string;
  addGroupByField: (field: string) => void;
  removeGroupByField: (field: string) => void;
  moveGroupField: (index: number, direction: 'up' | 'down') => void;
  setOrderBy: (column: string, direction: 'ASC' | 'DESC') => void;
  clearOrderBy: () => void;
  setDateFormat: (format: string) => void;
  setParamAggregation: (strategy: 'representative' | 'unique') => void;
  setLimit: (limit: number | null) => void;
  metrics: Metric[];
}

const DisplayOptions = forwardRef(({
  groupByFields,
  parameters,
  dateFormat,
  orderBy,
  limit,
  DATE_FORMATS,
  COLUMN_GROUPS,
  sanitizeColumnName,
  addGroupByField,
  removeGroupByField,
  moveGroupField,
  setOrderBy,
  clearOrderBy,
  setDateFormat,
  setParamAggregation,
  setLimit,
  metrics
}: DisplayOptionsProps, ref) => {
  const [activeGroupingsTab, setActiveGroupingsTab] = useState<string>('basic');
  const [showCustomSort, setShowCustomSort] = useState<boolean>(false);
  const [activeGroupings, setActiveGroupings] = useState<string[]>([]);
  const [alertInfo, setAlertInfo] = useState<{show: boolean, message: string}>({
    show: false,
    message: ''
  });

  const getUniqueParameters = (params: Parameter[]): Parameter[] => {
    const uniqueParams = new Map<string, Parameter>();
    
    params.forEach(param => {
      const baseName = param.key.split('.').pop()!;
      if (!uniqueParams.has(baseName)) {
        uniqueParams.set(baseName, {
          key: baseName,
          type: param.type
        });
      }
    });
    
    return Array.from(uniqueParams.values());
  };

  const uniqueParameters = getUniqueParameters(parameters);
  
  const handleAddGroupField = (field: string) => {
    setActiveGroupings([...activeGroupings, field]);
    addGroupByField(field);
  };

  const resetOptions = (silent = false) => {
    const fieldsCopy = [...groupByFields];
    fieldsCopy.forEach(field => {
      removeGroupByField(field);
    });
    
    clearOrderBy();
    setDateFormat('day');
    setLimit(null);
    setParamAggregation('representative');
    
    setActiveGroupingsTab('basic');
    setShowCustomSort(false);
    
    if (!silent) {
      setAlertInfo({
        show: true,
        message: 'Alle visningsvalg ble tilbakestilt'
      });
      
      setTimeout(() => {
        setAlertInfo(prev => ({...prev, show: false}));
      }, 4000);
    }
  };

  useImperativeHandle(ref, () => ({
    resetOptions
  }));

  useEffect(() => {
    setActiveGroupings(groupByFields);
  }, [groupByFields]);

  const hasCustomParameters = uniqueParameters.length > 0;

  return (
    <>
    <div className="flex justify-between items-center mb-4">
      <Heading level="2" size="small">
        Hvordan vil du vise resultatene?
      </Heading>
      
      <Button 
        variant="tertiary" 
        size="small" 
        onClick={() => resetOptions(false)} // Explicitly pass false to show alert
      >
        Tilbakestill visningsvalg
      </Button>
    </div>
    <div className="bg-gray-50 p-5 rounded-md border">
        {alertInfo.show && (
          <div className="mb-4">
            <AlertWithCloseButton variant="success">
              {alertInfo.message}
            </AlertWithCloseButton>
          </div>
        )}
        
        <div className="space-y-4 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Heading level="3" size="xsmall" >
              Velg gruppering
            </Heading>
            <HelpText title="Hva er en gruppering?">
              Legg til en eller flere grupperinger, disse vises som kolonner i tabeller.
            </HelpText>
          </div>
          
          <div className="bg-white p-4 rounded-md border shadow-inner mb-2">
            <Tabs
              value={activeGroupingsTab}
              onChange={value => setActiveGroupingsTab(value)}
              size="small"
            >
              <Tabs.List>
                <Tabs.Tab value="basic" label="Ofte brukte" />
                {hasCustomParameters && (
                  <Tabs.Tab value="custom" label="Egendefinerte" />
                )}
                <Tabs.Tab value="advanced" label="Flere valg" />
              </Tabs.List>
            
              <Tabs.Panel value="basic" className="pt-4">
                <div className="flex flex-wrap gap-2">
                  <Button 
                    variant={activeGroupings.includes('created_at') ? "primary" : "secondary"}
                    size="small"
                    onClick={() => handleAddGroupField('created_at')}
                    disabled={activeGroupings.includes('created_at')}
                    icon={<Calendar size={16} />}
                  >
                    Dato
                  </Button>
                  <Button 
                    variant={activeGroupings.includes('url_path') ? "primary" : "secondary"}
                    size="small"
                    onClick={() => handleAddGroupField('url_path')}
                    disabled={activeGroupings.includes('url_path')}
                    icon={<Link2 size={16} />}
                  >
                    URL-sti
                  </Button>
                  <Button 
                    variant={activeGroupings.includes('referrer_domain') ? "primary" : "secondary"}
                    size="small"
                    onClick={() => handleAddGroupField('referrer_domain')}
                    disabled={activeGroupings.includes('referrer_domain')}
                    icon={<Link2 size={16} />}
                  >
                    Henvisningsdomene
                  </Button>
                  <Button 
                    variant={activeGroupings.includes('event_name') ? "primary" : "secondary"}
                    size="small"
                    onClick={() => handleAddGroupField('event_name')}
                    disabled={activeGroupings.includes('event_name')}
                    icon={<Activity size={16} />}
                  >
                    Hendelsesnavn
                  </Button>
                  <Button 
                    variant={activeGroupings.includes('device') ? "primary" : "secondary"}
                    size="small"
                    onClick={() => handleAddGroupField('device')}
                    disabled={activeGroupings.includes('device')}
                    icon={<Smartphone size={16} />}
                  >
                    Enhet
                  </Button>  
                  <Button 
                    variant={activeGroupings.includes('browser') ? "primary" : "secondary"}
                    size="small"
                    onClick={() => handleAddGroupField('browser')}
                    disabled={activeGroupings.includes('browser')}
                    icon={<Smartphone size={16} />}
                  >
                    Nettleser
                  </Button>  
                  <Button 
                    variant={activeGroupings.includes('os') ? "primary" : "secondary"}
                    size="small"
                    onClick={() => handleAddGroupField('os')}
                    disabled={activeGroupings.includes('os')}
                    icon={<Smartphone size={16} />}
                  >
                    OS
                  </Button>  
                </div>
              </Tabs.Panel>
              
              {hasCustomParameters && (
                <Tabs.Panel value="custom" className="pt-4">
                  <div className="flex flex-wrap gap-2">
                    {uniqueParameters.map(param => (
                      <Button 
                        key={`param_${param.key}`}
                        variant={activeGroupings.includes(`param_${sanitizeColumnName(param.key)}`) ? "primary" : "secondary"}
                        size="small"
                        onClick={() => handleAddGroupField(`param_${sanitizeColumnName(param.key)}`)}
                        disabled={activeGroupings.includes(`param_${sanitizeColumnName(param.key)}`)}
                      >
                        {param.key}
                      </Button>
                    ))}
                  </div>
                  {uniqueParameters.length === 0 && (
                    <div className="text-sm text-gray-600 mt-2">
                      Ingen egendefinerte parametere funnet for denne nettsiden.
                    </div>
                  )}
                </Tabs.Panel>
              )}
              
              <Tabs.Panel value="advanced" className="pt-4">
                <div className="flex gap-2 items-center">
                  <Select
                    label="Grupper etter"
                    description="F.eks. dato (dag, uker, måneder), enhet, nettlesertype, etc."
                    onChange={(e) => {
                      if (e.target.value) {
                        addGroupByField(e.target.value);
                        (e.target as HTMLSelectElement).value = '';
                      }
                    }}
                    size="small"
                    className="flex-grow"
                  >
                    <option value="">Velg gruppering...</option>
                    {Object.entries(COLUMN_GROUPS).map(([groupKey, group]) => (
                      <optgroup key={groupKey} label={group.label}>
                        {group.columns
                          .filter(col => !groupByFields.includes(col.value))
                          .map(col => (
                            <option key={col.value} value={col.value}>
                              {col.label}
                            </option>
                          ))}
                      </optgroup>
                    ))}
                    
                    {uniqueParameters.length > 0 && (
                      <optgroup label="Egendefinerte">
                        {uniqueParameters
                          .filter(param => !groupByFields.includes(`param_${sanitizeColumnName(param.key)}`))
                          .map(param => (
                            <option key={`param_${param.key}`} value={`param_${sanitizeColumnName(param.key)}`}>
                              {param.key}
                            </option>
                          ))}
                      </optgroup>
                    )}
                  </Select>
                </div>
              </Tabs.Panel>
            </Tabs>
          </div>

          {groupByFields.length > 0 && (
            <div className="space-y-2">
              <Label as="p" size="small">
                Valgte grupperinger (sorter med pilene):
              </Label>
              <div className="flex flex-col gap-2">
                {groupByFields.map((field, index) => {
                  const column = Object.values(COLUMN_GROUPS)
                    .flatMap(group => group.columns)
                    .find(col => col.value === field);
                  
                  const paramName = field.startsWith('param_') ? uniqueParameters.find(
                    p => `param_${sanitizeColumnName(p.key)}` === field
                  )?.key : undefined;
         
                  return (
                    <div key={field} className="flex items-center justify-between bg-white px-4 py-3 rounded-md border">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-3">
                          <span className="text-sm text-gray-500">
                            {index + 1}.
                          </span>
                          <span className="font-medium">
                            {paramName || column?.label || field}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {field === 'created_at' && (
                          <Select
                            label=""
                            value={dateFormat || 'day'}
                            onChange={(e) => setDateFormat(e.target.value)}
                            size="small"
                            className="!w-auto min-w-[120px]"
                          >
                            {DATE_FORMATS.map(format => (
                              <option key={format.value} value={format.value}>
                                {format.label}
                              </option>
                            ))}
                          </Select>
                        )}
                        
                        <div className="flex gap-1">
                          {index > 0 && (
                            <Button
                              variant="secondary"
                              size="small"
                              icon={<MoveUp size={16} />}
                              onClick={() => moveGroupField(index, 'up')}
                              title="Flytt opp"
                            />
                          )}
                          {index < groupByFields.length - 1 && (
                            <Button
                              variant="secondary"
                              size="small"
                              icon={<MoveDown size={16} />}
                              onClick={() => moveGroupField(index, 'down')}
                              title="Flytt ned"
                            />
                          )}
                        </div>
                        
                        <Button
                          variant="tertiary-neutral"
                          size="small"
                          onClick={() => removeGroupByField(field)}
                        >
                          Fjern
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="border-t pt-4">
          <Heading level="3" size="xsmall" spacing>
            Visningsvalg
          </Heading>
          <div className="flex flex-col gap-4 pb-4">
            <Switch 
              className="mt-1"
              size="small"
              description={orderBy
                ? `Sorterer etter ${orderBy.column ? orderBy.column.toLowerCase() : 'første kolonne'} i ${orderBy.direction === 'ASC' ? 'stigende' : 'synkende'} rekkefølge`
                : 'Sorterer etter første kolonne i synkende rekkefølge'}
              checked={showCustomSort}
              onChange={() => setShowCustomSort(!showCustomSort)}
            >
              Tilpass sortering
            </Switch>

            {showCustomSort && (
              <>
              <div className="flex flex-col gap-2 bg-white p-3 rounded-md border"> 
                <div className="flex gap-2">
                  <Select
                    label="Sorter etter"
                    value={orderBy?.column || ""}
                    onChange={(e) => {
                      if (e.target.value) {
                        const direction = e.target.value === 'dato' ? 'ASC' : 'DESC';
                        setOrderBy(e.target.value, direction);
                      } else {
                        clearOrderBy();
                      }
                    }}
                    size="small"
                    className="flex-grow"
                  >
                    <option value="">Standard sortering</option>
                    <optgroup label="Grupperinger">
                      {groupByFields.map((field) => {
                        const column = Object.values(COLUMN_GROUPS)
                          .flatMap(group => group.columns)
                          .find(col => col.value === field);
                        
                        return (
                          <option key={field} value={field === 'created_at' ? 'dato' : field}>
                            {field === "created_at" ? "Dato" : column?.label || field}
                          </option>
                        );
                      })}
                    </optgroup>
                    <optgroup label="Metrikker">
                      {metrics.map((metric, index) => (
                        <option 
                          key={`metrikk_${index}`} 
                          value={metric.alias || `metrikk_${index + 1}`}
                        >
                          {metric.alias || `metrikk_${index + 1}`}
                        </option>
                      ))}
                    </optgroup>
                  </Select>

                  <Select
                    label="Retning"
                    value={orderBy?.direction || 'ASC'}
                    onChange={(e) => setOrderBy(
                      orderBy?.column || "", 
                      e.target.value as 'ASC' | 'DESC'
                    )}
                    size="small"
                  >
                    <option value="ASC">Stigende (A-Å, 0-9)</option>
                    <option value="DESC">Synkende (Å-A, 9-0)</option>
                  </Select>
                </div>
              </div>
              </>
            )}
          </div>
        </div>

        <div>
          <div className="flex flex-col gap-4">
            <Switch className="-mt-1"
              size="small"
              checked={limit !== null}
              onChange={() => setLimit(limit === null ? 10 : null)}
            >
              Begrens antall rader
            </Switch>
            
            {limit !== null && (
              <>
              <div className="flex gap-2 items-center bg-white p-3 rounded-md border">
                <TextField
                  label="Maksimalt antall rader"
                  description="F.eks. for en topp 10-liste"
                  type="number"
                  value={limit.toString()}
                  onChange={(e) => {
                    const value = e.target.value.trim();
                    if (value === "") {
                      setLimit(null);
                    } else {
                      const numValue = parseInt(value, 10);
                      if (!isNaN(numValue) && numValue > 0) {
                        setLimit(numValue);
                      }
                    }
                  }}
                  min="1"
                  size="small"
                  className="flex-grow"
                />
              </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
});

export default DisplayOptions;

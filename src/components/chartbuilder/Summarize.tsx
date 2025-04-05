import { Button, Heading, Select, TextField, HelpText, Tabs } from '@navikt/ds-react';
import { MoveUp, MoveDown, Users, BarChart2, PieChart, Clock, LogOut } from 'lucide-react';
import { useState, useEffect, forwardRef, useImperativeHandle } from 'react'; 
import { 
  Parameter, 
  Metric, 
  MetricOption,
  ColumnOption,
  Filter
} from '../../types/chart';
import AlertWithCloseButton from './AlertWithCloseButton';

interface SummarizeProps {
  metrics: Metric[];
  parameters: Parameter[];
  METRICS: MetricOption[];
  COLUMN_GROUPS: Record<string, any>;
  getMetricColumns: (parameters: Parameter[], metric: string) => ColumnOption[];
  sanitizeColumnName: (key: string) => string;
  updateMetric: (index: number, updates: Partial<Metric>) => void;
  removeMetric: (index: number) => void;
  addMetric: (metricFunction: string) => void;
  moveMetric: (index: number, direction: 'up' | 'down') => void;
  filters: Filter[];
}

const Summarize = forwardRef(({
  metrics,
  parameters,
  METRICS,
  COLUMN_GROUPS,
  getMetricColumns,
  sanitizeColumnName,
  updateMetric,
  removeMetric,
  addMetric,
  moveMetric
}: SummarizeProps, ref) => {
  const [alertInfo, setAlertInfo] = useState<{show: boolean, message: string}>({
    show: false,
    message: ''
  });
  
  const [activeCalculations, setActiveCalculations] = useState<string[]>([]);
  const [activeMetricCategory, setActiveMetricCategory] = useState<string>('antall');

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

  const resetConfig = (silent = false) => {
    const metricsCopy = [...metrics];
    metricsCopy.forEach((_) => {
      removeMetric(0);
    });
    
    if (!silent) {
      setAlertInfo({
        show: true,
        message: 'Alle målinger ble tilbakestilt'
      });
      
      setTimeout(() => {
        setAlertInfo(prev => ({...prev, show: false}));
      }, 4000);
    }
  };

  const addConfiguredMetric = (metricType: string, column?: string, alias?: string) => {
    const newIndex = metrics.length;
    
    setActiveCalculations([...activeCalculations, `${metricType}_${column || ''}`]);
    
    addMetric(metricType);
    
    setTimeout(() => {
      const updates: Partial<Metric> = {};
      if (column) updates.column = column;
      if (alias) updates.alias = alias;
      updateMetric(newIndex, updates);
    }, 0);
  };

  useEffect(() => {
    const calculationIds = metrics.map(m => `${m.function}_${m.column || ''}`);
    setActiveCalculations(calculationIds);
  }, [metrics]);

  useEffect(() => {
    // Force step 2 to remain active until user explicitly adds metrics
    // This is done by dispatching a custom event that the parent can listen for
    const event = new CustomEvent('summarizeStepStatus', {
      detail: { 
        hasUserSelectedMetrics: metrics.length > 0
      }
    });
    document.dispatchEvent(event);
  }, [metrics]);

  // Expose resetConfig method through ref
  useImperativeHandle(ref, () => ({
    resetConfig
  }));

  return (
    <>
    <div className="flex justify-between items-center mb-4">
      <Heading level="2" size="small">
        Hva vil du måle?
      </Heading>
      
      <Button 
        variant="tertiary" 
        size="small" 
        onClick={() => resetConfig(false)} // Explicitly pass false to show alert
      >
        Tilbakestill målinger
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
        
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Heading level="3" size="xsmall" >
              Velg målinger
            </Heading>
            <HelpText title="Hva er en måling?">
              Legg til en eller flere målinger, disse vises som kolonner i tabeller og grafer.
            </HelpText>
          </div>
          
          <div className="space-y-4">
            <div className="mb-2">              
              <div className="bg-white p-4 rounded-md border shadow-inner">
                <Tabs
                  value={activeMetricCategory}
                  onChange={value => setActiveMetricCategory(value)}
                  size="small"
                >
                  <Tabs.List>
                    <Tabs.Tab value="antall" label="Antall" />
                    <Tabs.Tab value="andel" label="Andel" />
                    <Tabs.Tab value="gjennomsnitt" label="Gjennomsnitt" />
                    <Tabs.Tab value="avansert" label="Flere målingsvalg" />
                  </Tabs.List>
                
                  <Tabs.Panel value="antall" className="pt-4">
                    <div className="flex flex-wrap gap-2">
                      <Button 
                        variant="secondary" 
                        size="small"
                        onClick={() => addConfiguredMetric('distinct', 'session_id', 'Unike besøkende')}
                        icon={<Users size={16} />}
                      >
                        Unike besøkende
                      </Button>
                      <Button 
                        variant="secondary" 
                        size="small"
                        onClick={() => addConfiguredMetric('count', 'session_id', 'Antall besøk')}
                        icon={<BarChart2 size={16} />}
                      >
                        Antall besøk
                      </Button>
                      <Button 
                        variant="secondary" 
                        size="small"
                        onClick={() => addConfiguredMetric('count', undefined, 'Antall sidevisninger')}
                        icon={<BarChart2 size={16} />}
                      >
                        Antall sidevisninger
                      </Button>
                      <Button 
                        variant="secondary" 
                        size="small"
                        onClick={() => addConfiguredMetric('count', undefined, 'Antall hendelser')}
                        icon={<BarChart2 size={16} />}
                      >
                        Antall hendelser
                      </Button>
                    </div>
                  </Tabs.Panel>
                  
                  <Tabs.Panel value="andel" className="pt-4">
                    <div className="flex flex-wrap gap-2">
                      <Button 
                        variant="secondary" 
                        size="small"
                        onClick={() => addConfiguredMetric('percentage', 'session_id', 'Andel av besøkende')}
                        icon={<PieChart size={16} />}
                      >
                        Andel av besøkende
                      </Button>
                      <Button 
                        variant="secondary" 
                        size="small"
                        onClick={() => addConfiguredMetric('percentage', 'event_id', 'Andel av hendelser')}
                        icon={<PieChart size={16} />}
                      >
                        Andel av hendelser
                      </Button>
                      <Button 
                        variant="secondary" 
                        size="small"
                        onClick={() => addConfiguredMetric('bounce_rate', 'visit_id', 'Fluktrate')}
                        icon={<LogOut size={16} />}
                      >
                        Fluktrate
                      </Button>
                    </div>
                  </Tabs.Panel>
                  
                  <Tabs.Panel value="gjennomsnitt" className="pt-4">
                    <div className="flex flex-wrap gap-2">
                      <Button 
                        variant="secondary" 
                        size="small"
                        onClick={() => addConfiguredMetric('average', 'visit_duration', 'Gjennomsnittlig besøkstid')}
                        icon={<Clock size={16} />}
                      >
                        Besøksvarighet i sekunder
                      </Button>
                    </div>
                  </Tabs.Panel>
                  
                  <Tabs.Panel value="avansert" className="pt-4">
                    <div className="flex flex-col gap-2">
                      <Select
                        label="Målt som"
                        description="F.eks. antall, andel, sum, gjennomsnitt, etc."
                        onChange={(e) => {
                          if (e.target.value) {
                            addMetric(e.target.value);
                            
                            if (e.target.value === 'percentage' || e.target.value === 'andel') {
                              const newIndex = metrics.length;
                              
                              setTimeout(() => {
                                updateMetric(newIndex, { column: 'session_id' });
                              }, 0);
                            }
                            
                            (e.target as HTMLSelectElement).value = '';
                          }
                        }}
                        size="small"
                        className="w-full"
                      >
                        <option value="">Velg måling...</option>
                        {METRICS.map(metric => (
                          <option key={metric.value} value={metric.value}>
                            {metric.label}
                          </option>
                        ))}
                      </Select>
                    </div>
                  </Tabs.Panel>
                </Tabs>
              </div>
            </div>

            {metrics.length > 0 && (
              <Heading level="3" size="xsmall" spacing>
                Valgte målinger
              </Heading>
            )}

            {metrics.map((metric, index) => (
              <div key={index} className="flex flex-col bg-white p-3 rounded-md border">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    {metrics.length > 0 && (
                      <span className="text-sm bg-gray-100 px-2 py-1 rounded-md text-blue-900 font-medium">
                        {index + 1}
                      </span>
                    )}
                    
                    <div className="flex items-center gap-2">
                      <span className="font-small text-blue-900">
                        {METRICS.find(m => m.value === metric.function)?.label || 'Måling'}
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-1">
                    <div className="flex gap-1">
                      {index > 0 && (
                        <Button
                          variant="secondary"
                          size="small"
                          icon={<MoveUp size={16} />}
                          onClick={() => moveMetric(index, 'up')}
                          title="Flytt opp"
                        />
                      )}
                      {index < metrics.length - 1 && (
                        <Button
                          variant="secondary"
                          size="small"
                          icon={<MoveDown size={16} />}
                          onClick={() => moveMetric(index, 'down')}
                          title="Flytt ned"
                        />
                      )}
                      {(index === 0 || index === metrics.length - 1) && metrics.length > 1 && (
                        <div className="w-8"></div>
                      )}
                    </div>
                    
                    <Button
                      variant="tertiary-neutral"
                      size="small"
                      onClick={() => removeMetric(index)}
                    >
                      Fjern
                    </Button>
                  </div>
                </div>
            
                <div className="mt-2">
                  {metric.function === 'count_where' ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* ... existing code for count_where metric type ... */}
                    </div>
                  ) : (
                    <div className="flex flex-col md:flex-row gap-4">
                      {metric.function !== 'count' && (
                        <div className="flex-grow">
                          <Select
                            label="Kolonne"
                            value={metric.column || ''}
                            onChange={(e) => updateMetric(index, { column: e.target.value })}
                            size="small"
                            className="w-full"
                          >
                            <option value="">Velg kolonne</option>
                            
                            {(metric.function === 'percentage' || metric.function === 'andel') ? (
                              getMetricColumns(parameters, metric.function).map(col => (
                                <option key={col.value} value={col.value}>
                                  {col.label}
                                </option>
                              ))
                            ) : (
                              <>
                                {Object.entries(COLUMN_GROUPS).map(([groupKey, group]) => (
                                    <optgroup key={groupKey} label={(group as { label: string }).label}>
                                    {(group as { columns: { value: string; label: string }[] }).columns.map(col => (
                                      <option key={col.value} value={col.value}>
                                      {col.label}
                                      </option>
                                    ))}
                                    </optgroup>
                                ))}
                                
                                {uniqueParameters.length > 0 && (
                                  <optgroup label="Egendefinerte">
                                    {uniqueParameters.map(param => (
                                      <option key={`param_${param.key}`} value={`param_${sanitizeColumnName(param.key)}`}>
                                        {param.key}
                                      </option>
                                    ))}
                                  </optgroup>
                                )}
                              </>
                            )}
                          </Select>
                        </div>
                      )}
                      
                      <div className="md:w-1/3">
                        <TextField
                          label="Kolonnetittel (valgfritt)"
                          value={metric.alias || ''}
                          onChange={(e) => updateMetric(index, { alias: e.target.value })}
                          placeholder={`metrikk_${index + 1}`}
                          size="small"
                          className="w-full"
                        />
                      </div>
                    </div>
                  )}
                </div> 
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
});

export default Summarize;

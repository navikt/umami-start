import { Heading, Select, Label, TextField, UNSAFE_Combobox, Switch, HelpText } from '@navikt/ds-react';
import { MoveUp, MoveDown, Users, BarChart2, PieChart, Calendar, Link2, Activity, Smartphone, Clock } from 'lucide-react'; // Added Clock iconimports
import { useState, useEffect } from 'react'; 
import { 
  Parameter, 
  Metric, 
  DateFormat, 
  ColumnGroup,
  MetricOption,
  OrderBy,
  ColumnOption,
  Filter
} from '../../types/chart';
import AlertWithCloseButton from './AlertWithCloseButton'; // Import AlertWithCloseButton

interface SummarizeProps {
  metrics: Metric[];
  groupByFields: string[];
  parameters: Parameter[];
  dateFormat: string | null;
  orderBy: OrderBy | null;
  paramAggregation: 'representative' | 'unique';
  limit: number | null;
  METRICS: MetricOption[];
  DATE_FORMATS: DateFormat[];
  COLUMN_GROUPS: Record<string, ColumnGroup>;
  getMetricColumns: (parameters: Parameter[], metric: string) => ColumnOption[];
  sanitizeColumnName: (key: string) => string;
  updateMetric: (index: number, updates: Partial<Metric>) => void;
  removeMetric: (index: number) => void;
  addMetric: (metricFunction: string) => void;
  addGroupByField: (field: string) => void;
  removeGroupByField: (field: string) => void;
  moveGroupField: (index: number, direction: 'up' | 'down') => void;
  moveMetric: (index: number, direction: 'up' | 'down') => void;
  setOrderBy: (column: string, direction: 'ASC' | 'DESC') => void;
  clearOrderBy: () => void;
  setDateFormat: (format: string) => void;
  setParamAggregation: (strategy: 'representative' | 'unique') => void;
  setLimit: (limit: number | null) => void;
  availableEvents?: string[];
  filters: Filter[]; // Add this prop
  setFilters: (filters: Filter[]) => void; // Add this prop
}

const Summarize = ({
  metrics,
  groupByFields,
  parameters,
  dateFormat,
  orderBy,
  limit,
  METRICS,
  DATE_FORMATS,
  COLUMN_GROUPS,
  getMetricColumns,
  sanitizeColumnName,
  updateMetric,
  removeMetric,
  addMetric,
  addGroupByField,
  removeGroupByField,
  moveGroupField,
  moveMetric,
  setOrderBy,
  clearOrderBy,
  setDateFormat,
  setParamAggregation, // Add this missing prop
  setLimit,
  availableEvents = []
}: SummarizeProps) => {
  // Add alert state
  const [alertInfo, setAlertInfo] = useState<{show: boolean, message: string}>({
    show: false,
    message: ''
  });
  
  // Add state for showing advanced options
  const [showAdvancedGrouping, setShowAdvancedGrouping] = useState<boolean>(false);
  const [showAdvancedCalculations, setShowAdvancedCalculations] = useState<boolean>(false);
  const [showCustomSort, setShowCustomSort] = useState<boolean>(false); // Add state for custom sort visibility

  // Add state to track which grouping and calculation buttons are active
  const [activeGroupings, setActiveGroupings] = useState<string[]>([]);
  const [activeCalculations, setActiveCalculations] = useState<string[]>([]);

  // Add helper function to deduplicate parameters
  const getUniqueParameters = (params: Parameter[]): Parameter[] => {
    const uniqueParams = new Map<string, Parameter>();
    
    params.forEach(param => {
      const baseName = param.key.split('.').pop()!;
      if (!uniqueParams.has(baseName)) {
        // Store simplified version of the parameter
        uniqueParams.set(baseName, {
          key: baseName,
          type: param.type
        });
      }
    });
    
    return Array.from(uniqueParams.values());
  };

  // Get deduplicated parameters once
  const uniqueParameters = getUniqueParameters(parameters);
  
  // Helper function to extract unique event names
  const getUniqueEventNames = (): string[] => {
    return availableEvents
      .filter(event => event != null)
      .filter((event, index, self) => self.indexOf(event) === index)
      .sort();
  };
  
  // Filter for operators relevant to count_where
  const OPERATORS = [
    { value: '=', label: 'Er lik' },
    { value: '!=', label: 'Er ikke lik' },
    { value: '>', label: 'Større enn' },
    { value: '<', label: 'Mindre enn' },
    { value: '>=', label: 'Større eller lik' },
    { value: '<=', label: 'Mindre eller lik' },
    { value: 'LIKE', label: 'Inneholder' },
    { value: 'NOT LIKE', label: 'Inneholder ikke' },
    { value: 'IN', label: 'Er en av' },
    { value: 'NOT IN', label: 'Er ikke en av' }
  ];

  // Add a reset function that clears all configurations
  const resetConfig = () => {
    // Instead of a while loop, which might not work with state updates,
    // reset everything at once to avoid race conditions
    
    // Clear all metrics (create a temporary copy to avoid modification during iteration)
    const metricsCopy = [...metrics];
    metricsCopy.forEach((_) => {
      // Always remove the first one as the array shifts each time
      removeMetric(0);
    });
    
    // Clear all group by fields (create a temporary copy to avoid modification during iteration)
    const fieldsCopy = [...groupByFields];
    fieldsCopy.forEach(field => {
      removeGroupByField(field);
    });
    
    // Reset orderBy
    clearOrderBy();
    
    // Reset date format to default
    setDateFormat('day');
    
    // Reset limit
    setLimit(null);
    
    // Reset parameter aggregation
    setParamAggregation('representative');
    
    // Show alert
    setAlertInfo({
      show: true,
      message: 'Alle tilpasninger ble tilbakestilt'
    });
    
    // Auto-hide alert after 7 seconds
    setTimeout(() => {
      setAlertInfo(prev => ({...prev, show: false}));
    }, 7000);
  };

  // Helper function to set sort order based on the state of metrics and groupByFields
  const updateSortOrderIfNeeded = () => {
    // If no metrics yet, nothing to do
    if (metrics.length === 0) return;
    
    // Check if we have a date grouping
    const hasDateGrouping = groupByFields.includes('created_at');
    
    // If no date grouping and either no sort order or current sort is date
    if (!hasDateGrouping && 
        (!orderBy || orderBy.column === 'dato')) {
      // Sort by the first metric descending
      const firstMetric = metrics[0];
      const metricName = firstMetric.alias || `metrikk_1`;
      setOrderBy(metricName, 'DESC');
    }
  };

  // Call this function whenever metrics are added in the parent component
  useEffect(() => {
    updateSortOrderIfNeeded();
  }, [metrics.length]);

  // Add helper function for quick metric addition with active state tracking
  const addConfiguredMetric = (metricType: string, column?: string, alias?: string) => {
    // Get the new metric index (after the metric is added)
    const newIndex = metrics.length;
    
    // Add to active calculations
    setActiveCalculations([...activeCalculations, `${metricType}_${column || ''}`]);
    
    // First add the basic metric
    addMetric(metricType);
    
    // Then update with specific configuration using setTimeout to ensure the metric was added
    setTimeout(() => {
      const updates: Partial<Metric> = {};
      if (column) updates.column = column;
      if (alias) updates.alias = alias;
      updateMetric(newIndex, updates);
    }, 0);
  };

  // Add helper function for adding group fields with active state tracking
  const handleAddGroupField = (field: string) => {
    setActiveGroupings([...activeGroupings, field]);
    addGroupByField(field);
  };

  // Update effect to sync active states with actual data
  useEffect(() => {
    // Sync activeGroupings with groupByFields
    setActiveGroupings(groupByFields);
    
    // Sync activeCalculations based on metrics
    const calculationIds = metrics.map(m => `${m.function}_${m.column || ''}`);
    setActiveCalculations(calculationIds);
  }, [groupByFields, metrics]);

  return (
    <>
    <div className="flex justify-between items-center mb-4">
      <Heading level="2" size="small">
        Tilpass visningen
      </Heading>
      
      {/* Update reset button to match style */}
      <button 
        className="px-3 py-2 rounded-md text-sm border transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 bg-gray-50 text-gray-900 border-gray-400 hover:bg-gray-100 shadow-sm"
        onClick={resetConfig}
      >
        Tilbakestill tilpasninger
      </button>
    </div>
    <div className="bg-gray-50 p-5 rounded-md border"> 
        {/* Add alert at the top if it's visible */}
        {alertInfo.show && (
          <div className="mb-4">
            <AlertWithCloseButton variant="success">
              {alertInfo.message}
            </AlertWithCloseButton>
          </div>
        )}
        
        {/* Group By section */} 

        <div className="flex items-center gap-2 mb-4">
          <Heading level="3" size="xsmall" >
            Gruppering
          </Heading>
          <HelpText title="Hva er en gruppering?">
            Legg til en eller flere grupperinger, disse vises som kolonner i tabeller.
          </HelpText>
        </div>
        
        <div className="space-y-4 mb-6">
          {/* Replace quick grouping buttons with consistent styling */}
          <div className="mb-2">
            <Label as="p" size="small" className="mb-2">
              Legg til vanlige grupperinger:
            </Label>
            <div className="flex flex-wrap gap-2">
              <button 
                className={`px-3 py-2 rounded-md text-sm border transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 flex items-center gap-1.5 ${
                  activeGroupings.includes('created_at')
                    ? 'bg-blue-600 text-white border-blue-700' 
                    : 'bg-gray-50 text-gray-900 border-gray-400 hover:bg-gray-100 shadow-sm'
                }`}
                onClick={() => handleAddGroupField('created_at')}
                disabled={activeGroupings.includes('created_at')}
              >
                <Calendar size={16} />
                Dato
              </button>
              <button 
                className={`px-3 py-2 rounded-md text-sm border transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 flex items-center gap-1.5 ${
                  activeGroupings.includes('url_path')
                    ? 'bg-blue-600 text-white border-blue-700' 
                    : 'bg-gray-50 text-gray-900 border-gray-400 hover:bg-gray-100 shadow-sm'
                }`}
                onClick={() => handleAddGroupField('url_path')}
                disabled={activeGroupings.includes('url_path')}
              >
                <Link2 size={16} />
                URL-sti
              </button>
              <button 
                className={`px-3 py-2 rounded-md text-sm border transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 flex items-center gap-1.5 ${
                  activeGroupings.includes('event_name')
                    ? 'bg-blue-600 text-white border-blue-700' 
                    : 'bg-gray-50 text-gray-900 border-gray-400 hover:bg-gray-100 shadow-sm'
                }`}
                onClick={() => handleAddGroupField('event_name')}
                disabled={activeGroupings.includes('event_name')}
              >
                <Activity size={16} />
                Hendelsesnavn
              </button>
              <button 
                className={`px-3 py-2 rounded-md text-sm border transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 flex items-center gap-1.5 ${
                  activeGroupings.includes('device')
                    ? 'bg-blue-600 text-white border-blue-700' 
                    : 'bg-gray-50 text-gray-900 border-gray-400 hover:bg-gray-100 shadow-sm'
                }`}
                onClick={() => handleAddGroupField('device')}
                disabled={activeGroupings.includes('device')}
              >
                <Smartphone size={16} />
                Enhet
              </button>
            </div>
          </div>
          
          {/* Switch for showing advanced grouping options */}
          <Switch
            className="mt-2"
            size="small"
            checked={showAdvancedGrouping} 
            onChange={() => setShowAdvancedGrouping(!showAdvancedGrouping)}
          >
            Vis alle grupperingsvalg
          </Switch>
          {/* Original dropdown for other groupings - now conditional */}
          {showAdvancedGrouping && (
            <div className="flex gap-2 items-center bg-white p-3 rounded-md border">
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
          )}

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
                            <button
                              className="px-2 py-1 rounded-md text-sm border transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 bg-gray-50 text-gray-900 border-gray-400 hover:bg-gray-100 shadow-sm"
                              onClick={() => moveGroupField(index, 'up')}
                              title="Flytt opp"
                            >
                              <MoveUp size={16} />
                            </button>
                          )}
                          {index < groupByFields.length - 1 && (
                            <button
                              className="px-2 py-1 rounded-md text-sm border transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 bg-gray-50 text-gray-900 border-gray-400 hover:bg-gray-100 shadow-sm"
                              onClick={() => moveGroupField(index, 'down')}
                              title="Flytt ned"
                            >
                              <MoveDown size={16} />
                            </button>
                          )}
                        </div>
                        
                        <button
                          className="px-2 py-1 rounded-md text-sm border transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 bg-gray-50 text-gray-900 border-gray-400 hover:bg-gray-100 shadow-sm"
                          onClick={() => removeGroupByField(field)}
                        >
                          Fjern
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
      </div>

      {/* Metrics section */}
      <div className="border-t pt-4">
      <div className="flex items-center gap-2 mb-4">
        <Heading level="3" size="xsmall" >
          Beregninger
        </Heading>
        <HelpText title="Hva er en beregning?">
          Legg til en eller flere beregninger, disse vises som kolonner i tabeller.
        </HelpText>
      </div>
        
        <div className="space-y-4 mb-6">
          {/* Replace regular metrics buttons with consistent styling */}
          <div className="mb-2">
            <Label as="p" size="small" className="mb-2">
              Legg til vanlige beregninger:
            </Label>
            <div className="flex flex-wrap gap-2">
              <button 
                className="px-3 py-2 rounded-md text-sm border transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 flex items-center gap-1.5 bg-gray-50 text-gray-900 border-gray-400 hover:bg-gray-100 shadow-sm"
                onClick={() => addConfiguredMetric('distinct', 'session_id', 'Unike besøkende')}
              >
                <Users size={16} />
                Unike besøkende
              </button>
              <button 
                className="px-3 py-2 rounded-md text-sm border transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 flex items-center gap-1.5 bg-gray-50 text-gray-900 border-gray-400 hover:bg-gray-100 shadow-sm"
                onClick={() => addConfiguredMetric('distinct', 'event_id', 'Unike hendelser')}
              >
                <BarChart2 size={16} />
                Unike hendelser
              </button>
              <button 
                className="px-3 py-2 rounded-md text-sm border transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 flex items-center gap-1.5 bg-gray-50 text-gray-900 border-gray-400 hover:bg-gray-100 shadow-sm"
                onClick={() => addConfiguredMetric('count', undefined, 'Totalt antall')}
              >
                <BarChart2 size={16} />
                Hendelser totalt
              </button>
              <button 
                className="px-3 py-2 rounded-md text-sm border transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 flex items-center gap-1.5 bg-gray-50 text-gray-900 border-gray-400 hover:bg-gray-100 shadow-sm"
                onClick={() => addConfiguredMetric('percentage', 'session_id', 'Andel av resultater')}
              >
                <PieChart size={16} />
                Andel av besøkende 
              </button>
              <button 
                className="px-3 py-2 rounded-md text-sm border transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 flex items-center gap-1.5 bg-gray-50 text-gray-900 border-gray-400 hover:bg-gray-100 shadow-sm"
                onClick={() => addConfiguredMetric('average', 'visit_duration', 'Gjennomsnittlig besøkstid')}
              >
                <Clock size={16} />
                Gjennomsnitt besøkstid
              </button>
            </div>
          </div>
          
          {/* Switch for showing advanced calculation options */}
          <Switch 
            className="mt-2"
            size="small"
            checked={showAdvancedCalculations} 
            onChange={() => setShowAdvancedCalculations(!showAdvancedCalculations)}
          >
            Vis alle beregningsvalg
          </Switch>
          
          {/* Original dropdown for advanced metrics - now conditional */}
          {showAdvancedCalculations && (
            <div className="flex flex-col gap-2 bg-white p-3 rounded-md border">
              <Select
                label="Målt som"
                description="F.eks. antall, andel, sum, gjennomsnitt, etc."
                onChange={(e) => {
                  if (e.target.value) {
                    // Add the metric
                    addMetric(e.target.value);
                    
                    // If it's a percentage metric, set default column to 'visitors' (Besøkende)
                    if (e.target.value === 'percentage' || e.target.value === 'andel') {
                      // Get the index of the newly added metric (it will be the last one)
                      const newIndex = metrics.length; // This will be the index after addMetric completes
                      
                      // Set timeout to let the addMetric finish processing
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
                <option value="">Velg beregning...</option>
                {METRICS.map(metric => (
                  <option key={metric.value} value={metric.value}>
                    {metric.label}
                  </option>
                ))}
              </Select>
            </div>
          )}

          {metrics.map((metric, index) => (
            <div key={index} className="flex flex-col bg-white p-3 rounded-md border">
              {/* Metric header with function label instead of dropdown */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  {metrics.length > 0 && (
                    <span className="text-sm bg-gray-100 px-2 py-1 rounded-md text-blue-900 font-medium">
                      {index + 1}
                    </span>
                  )}
                  
                  {/* Replace function dropdown with static label */}
                  <div className="flex items-center gap-2">
                    <span className="font-small text-blue-900">
                      {METRICS.find(m => m.value === metric.function)?.label || 'Beregning'}
                    </span>
                  </div>
                </div>
                
                {/* Update control buttons in the header */}
                <div className="flex items-center gap-1">
                  <div className="flex gap-1">
                    {index > 0 && (
                      <button
                        className="px-2 py-1 rounded-md text-sm border transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 bg-gray-50 text-gray-900 border-gray-400 hover:bg-gray-100 shadow-sm"
                        onClick={() => moveMetric(index, 'up')}
                        title="Flytt opp"
                      >
                        <MoveUp size={16} />
                      </button>
                    )}
                    {index < metrics.length - 1 && (
                      <button
                        className="px-2 py-1 rounded-md text-sm border transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 bg-gray-50 text-gray-900 border-gray-400 hover:bg-gray-100 shadow-sm"
                        onClick={() => moveMetric(index, 'down')}
                        title="Flytt ned"
                      >
                        <MoveDown size={16} />
                      </button>
                    )}
                    {(index === 0 || index === metrics.length - 1) && metrics.length > 1 && (
                      <div className="w-8"></div>
                    )}
                  </div>
                  
                  <button
                    className="px-2 py-1 rounded-md text-sm border transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 bg-gray-50 text-gray-900 border-gray-400 hover:bg-gray-100 shadow-sm"
                    onClick={() => removeMetric(index)}
                  >
                    Fjern
                  </button>
                </div>
              </div>
          
              {/* Metric configuration - different for each type */}
              <div className="mt-2">
                {/* Add special case for count_where */}
                {metric.function === 'count_where' ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Column select */}
                    <div className="flex flex-col gap-1">
                      <Select
                        label="Kolonne"
                        value={metric.whereColumn || 'event_name'}
                        onChange={(e) => updateMetric(index, { whereColumn: e.target.value })}
                        size="small"
                        className="w-full"
                      >
                        {Object.entries(COLUMN_GROUPS).map(([groupKey, group]) => (
                          <optgroup key={groupKey} label={group.label}>
                            {group.columns.map(col => (
                              <option key={col.value} value={col.value}>
                                {col.label}
                              </option>
                            ))}
                          </optgroup>
                        ))}
                        
                        {uniqueParameters.length > 0 && (
                          <optgroup label="Egendefinerte">
                            {uniqueParameters.map(param => (
                              <option 
                                key={`param_${param.key}`} 
                                value={`param_${sanitizeColumnName(param.key)}`}
                              >
                                {param.key}
                              </option>
                            ))}
                          </optgroup>
                        )}
                      </Select>
                    </div>
          
                    {/* Operator select */}
                    <div className="flex flex-col gap-1">
                      <Select
                        value={metric.whereOperator || '='}
                        onChange={(e) => updateMetric(index, { whereOperator: e.target.value })}
                        size="small"
                        label="Operator"
                        className="w-full"
                      >
                        {OPERATORS.map(op => (
                          <option key={op.value} value={op.value}>
                            {op.label}
                          </option>
                        ))}
                      </Select>
                    </div>
          
                    {/* Value combobox - full width across */}
                    <div className="flex flex-col gap-1 col-span-1 md:col-span-2">
                      <UNSAFE_Combobox
                        label="Verdi"
                        description={
                          metric.whereColumn === 'event_name' ? "Velg eller skriv inn hendelsesnavn" :
                          metric.whereColumn === 'url_path' ? "Velg eller skriv inn URL-sti" :
                          null
                        }
                        options={(metric.whereColumn === 'event_name' ? getUniqueEventNames() : [])
                          .map(val => ({ label: val, value: val }))}
                        selectedOptions={metric.whereMultipleValues?.map(v => v || '') || 
                                        (metric.whereValue ? [metric.whereValue] : [])}
                        onToggleSelected={(option, isSelected) => {
                          if (option) {
                            const currentValues = metric.whereMultipleValues || 
                                                (metric.whereValue ? [metric.whereValue] : []);
                            const newValues = isSelected 
                              ? [...currentValues, option]
                              : currentValues.filter(val => val !== option);
                            
                            const newOperator = newValues.length > 1 && ['IN', 'NOT IN'].includes(metric.whereOperator || '=') 
                              ? metric.whereOperator 
                              : newValues.length > 1 ? 'IN' : metric.whereOperator || '=';
                            
                            updateMetric(index, {
                              whereMultipleValues: newValues.length > 0 ? newValues : undefined,
                              whereValue: newValues.length > 0 ? newValues[0] : '',
                              whereOperator: newOperator
                            });
                          }
                        }}
                        isMultiSelect={['IN', 'NOT IN'].includes(metric.whereOperator || '=')}
                        size="small"
                        clearButton
                        allowNewValues
                      />
                    </div>
          
                    {/* Alias - at the bottom */}
                    <div className="flex flex-col gap-1 col-span-1 md:col-span-2">
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
                ) : (
                  <div className="flex flex-col md:flex-row gap-4">
                    {/* Original metric column selection */}
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
                          
                          {/* For percentage and andel, use the simplified dropdown */}
                          {(metric.function === 'percentage' || metric.function === 'andel') ? (
                            getMetricColumns(parameters, metric.function).map(col => (
                              <option key={col.value} value={col.value}>
                                {col.label}
                              </option>
                            ))
                          ) : (
                            /* For all other functions, use the original grouped dropdowns */
                            <>
                              {Object.entries(COLUMN_GROUPS).map(([groupKey, group]) => (
                                <optgroup key={groupKey} label={group.label}>
                                  {group.columns.map(col => (
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
                    
                    {/* Alias field */}
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

      {/* Order By section */}
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
            checked={showCustomSort} // Use showCustomSort state
            onChange={() => setShowCustomSort(!showCustomSort)} // Toggle showCustomSort
          >
            Tilpass sortering
          </Switch>

          {showCustomSort && ( // Use showCustomSort state
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

      {/* Result Limit section */}
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
};

export default Summarize;

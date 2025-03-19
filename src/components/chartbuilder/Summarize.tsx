import { Button, Heading, Select, Label, TextField, UNSAFE_Combobox, Switch } from '@navikt/ds-react';
import { MoveUp, MoveDown } from 'lucide-react';
import { 
  Parameter, 
  Metric, 
  DateFormat, 
  ColumnGroup,
  MetricOption,
  OrderBy,
  ColumnOption
} from '../../types/chart';

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
  setLimit,
  availableEvents = []
}: SummarizeProps) => {
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

  return (
    <div className="bg-gray-50 p-5 rounded-md border"> 
        {/* Group By section */} 
        <Heading level="3" size="xsmall" spacing>
          Gruppering
        </Heading>
        <p className="text-sm text-gray-600 mb-4">
          Du kan legge til en eller flere grupperinger, disse vises som kolonner i tabeller.
        </p>
        
        <div className="space-y-4 mb-6">
          <div className="flex gap-2 items-center bg-white p-3 rounded-md border">
            <Select
              label="Grupper etter"
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
                              variant="tertiary"
                              size="small"
                              icon={<MoveUp size={16} />}
                              onClick={() => moveGroupField(index, 'up')}
                              title="Flytt opp"
                            />
                          )}
                          {index < groupByFields.length - 1 && (
                            <Button
                              variant="tertiary"
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

      {/* Metrics section */}
      <div className="border-t pt-4">
        <Heading level="3" size="xsmall" spacing>
          Beregninger
        </Heading>
         <p className="text-sm text-gray-600 mb-4">
          Du kan legge til en eller flere beregninger, disse vises som kolonner i tabeller.
        </p>
        
        <div className="space-y-4 mb-6">
          {/* Move dropdown to the top */}
          <div className="flex gap-2 items-center bg-white p-3 rounded-md border">
            <Select
              label="Legg til beregning"
              onChange={(e) => {
                if (e.target.value) {
                  addMetric(e.target.value);
                  (e.target as HTMLSelectElement).value = '';
                }
              }}
              size="small"
              className="flex-grow"
            >
              <option value="">Velg utregning...</option>
              {METRICS.map(metric => (
                <option key={metric.value} value={metric.value}>
                  {metric.label}
                </option>
              ))}
            </Select>
          </div>

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
                
                {/* Control buttons in the header */}
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
                        label="Alias (valgfritt)"
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
                        label="Alias (valgfritt)"
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

      {/* Add new Parameter Aggregation section 
      {parameters.length > 0 && parameters.some(p => p.type === 'string') && (
        <div className="mt-4 pb-4 border-b border-gray-200">
          <Box paddingBlock="4">
            <Heading level="3" size="xsmall" spacing>
              Parameter aggregering
            </Heading>
            <div className="flex items-center mt-2">
              <Switch
                size="small"
                checked={paramAggregation === 'unique'}
                onChange={() => setParamAggregation(
                  paramAggregation === 'unique' ? 'representative' : 'unique'
                )}
              >
                Vis sammendrag
              </Switch>
              <span className="ml-2 text-sm">
                Vis alle unike verdier (standard) eller sammendrag
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Som standard vises alle unike verdier for tekst-parametere.
              Når deaktivert vil spørringen vise én representativ verdi per gruppering.
            </p>
          </Box>
        </div>
      )}
      */}

      {/* Order By section */}
      <div className="border-t pt-4">
        <Heading level="3" size="xsmall" spacing>
          Sortering
        </Heading>
        {!orderBy && (
        <p className="text-sm text-gray-600 mb-4">
          Standard sorterer etter første kolonne i synkende rekkefølge.
        </p>
      )}
            
        <div className="mb-6 space-y-4">
          <div className="flex gap-2 items-center bg-white p-3 rounded-md border">
            <Select
              label="Sorter etter"
              value={orderBy?.column || ""}
              onChange={(e) => {
                if (e.target.value) {
                  // Use ascending order for dates, descending for other metrics
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

            {orderBy && (
              <Select
                label="Retning"
                value={orderBy.direction}
                onChange={(e) => setOrderBy(
                  orderBy.column || "", 
                  e.target.value as 'ASC' | 'DESC'
                )}
                size="small"
              >
                <option value="ASC">Stigende (A-Å, 0-9)</option>
                <option value="DESC">Synkende (Å-A, 9-0)</option>
              </Select>
            )}
          </div>
        </div>
      </div>

      {/* Result Limit section */}
      <div className="border-t pt-4">
        <Heading level="3" size="xsmall" spacing>
          Maks rader
        </Heading>
        <div className="flex flex-col gap-4">
          <Switch 
            size="small"
            checked={limit !== null}
            onChange={() => setLimit(limit === null ? 10 : null)}
          >
            Begrens antall rader
          </Switch>
          
          {limit !== null && (
            <div className="flex gap-2 items-center bg-white p-3 rounded-md border">
              <TextField
                label="Maksimalt antall rader"
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
          )}
        </div>
      </div>

    </div>
  );
};

export default Summarize;

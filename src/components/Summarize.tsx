import { Button, Heading, Select, Label, TextField } from '@navikt/ds-react';
import { MoveUp, MoveDown } from 'lucide-react';
import { 
  Parameter, 
  Metric, 
  DateFormat, 
  ColumnGroup,
  MetricOption,
  OrderBy,
  ColumnOption
} from '../types/chart';

interface SummarizeProps {
  metrics: Metric[];
  groupByFields: string[];
  parameters: Parameter[];
  dateFormat: string | null;
  orderBy: OrderBy | null;
  METRICS: MetricOption[];
  DATE_FORMATS: DateFormat[];
  COLUMN_GROUPS: Record<string, ColumnGroup>;
  getMetricColumns: (parameters: Parameter[], metric: string) => ColumnOption[];
  sanitizeColumnName: (key: string) => string;
  updateMetric: (index: number, updates: Partial<Metric>) => void;
  removeMetric: (index: number) => void;
  addMetric: () => void;
  addGroupByField: (field: string) => void;
  removeGroupByField: (field: string) => void;
  moveGroupField: (index: number, direction: 'up' | 'down') => void;
  setOrderBy: (column: string, direction: 'ASC' | 'DESC') => void;
  clearOrderBy: () => void;
  setDateFormat: (format: string) => void;
}

const Summarize = ({
  metrics,
  groupByFields,
  parameters,
  dateFormat,
  orderBy,
  METRICS,
  DATE_FORMATS,
  COLUMN_GROUPS,
  sanitizeColumnName,
  updateMetric,
  removeMetric,
  addMetric,
  addGroupByField,
  removeGroupByField,
  moveGroupField,
  setOrderBy,
  clearOrderBy,
  setDateFormat
}: SummarizeProps) => {
  return (
    <div className="space-y-6 bg-gray-50 p-5 rounded-md border">
      {/* Metrics section */}
      <div>
        <Heading level="3" size="xsmall" spacing>
          Beregninger
        </Heading>
        <p className="text-sm text-gray-600 mb-4">
          Velg hvilke beregninger som skal vises i resultatet.
        </p>
        
        <div className="space-y-4">
          {metrics.map((metric, index) => (
            <div key={index} className="flex gap-2 items-end bg-white p-3 rounded-md border">
              <Select
                label="Funksjon"
                value={metric.function}
                onChange={(e) => updateMetric(index, { function: e.target.value })}
                size="small"
              >
                {METRICS.map(m => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </Select>
              
              {metric.function !== 'count' && (
                <Select
                  label="Kolonne"
                  value={metric.column || ''}
                  onChange={(e) => updateMetric(index, { column: e.target.value })}
                  size="small"
                >
                  <option value="">Velg kolonne</option>
                  {Object.entries(COLUMN_GROUPS).map(([groupKey, group]) => (
                    <optgroup key={groupKey} label={group.label}>
                      {group.columns.map(col => (
                        <option key={col.value} value={col.value}>
                          {col.label}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                  {parameters.length > 0 && (
                    <optgroup label="Egendefinerte parametere">
                      {parameters.map(param => (
                        <option key={`param_${param.key}`} value={`param_${sanitizeColumnName(param.key)}`}>
                          {param.key}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </Select>
              )}
              
              <TextField
                label="Alias (valgfritt)"
                value={metric.alias || ''}
                onChange={(e) => updateMetric(index, { alias: e.target.value })}
                placeholder={`metric_${index + 1}`}
                size="small"
              />
              
              <Button
                variant="tertiary-neutral"
                size="small"
                onClick={() => removeMetric(index)}
                className="mb-1"
              >
                Fjern
              </Button>
            </div>
          ))}
          
          <Button
            variant="secondary"
            onClick={addMetric}
            size="small"
          >
            Legg til flere beregninger
          </Button>
        </div>
      </div>
      
      {/* Group By section */}
      <div className="border-t pt-4">
        <Heading level="3" size="xsmall" spacing>
          Gruppering
        </Heading>
        <p className="text-sm text-gray-600 mb-4">
          Velg hvordan dataene skal grupperes og vises.
        </p>
        
        <div className="space-y-4">
          <div className="flex gap-2 items-center bg-white p-3 rounded-md border">
            <Select
              label="Legg til gruppering"
              onChange={(e) => {
                if (e.target.value) {
                  addGroupByField(e.target.value);
                  (e.target as HTMLSelectElement).value = '';
                }
              }}
              size="small"
              className="flex-grow"
            >
              <option value="">Velg felt...</option>
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
              
              {parameters.length > 0 && (
                <optgroup label="Egendefinerte parametere">
                  {parameters
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
                  
                  const paramName = field.startsWith('param_') ? parameters.find(
                    p => `param_${sanitizeColumnName(p.key)}` === field
                  )?.key : undefined;
                  
                  return (
                    <div key={field} className="flex items-center justify-between bg-white px-4 py-3 rounded-md border">
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-gray-500">
                          {index + 1}.
                        </span>
                        <span className="font-medium">
                          {paramName || column?.label || field}
                        </span>
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
      </div>

      {/* Order By section */}
      <div className="border-t pt-4">
        <Heading level="3" size="xsmall" spacing>
          Sortering
        </Heading>
        <p className="text-sm text-gray-600 mb-4">
          Velg hvordan resultatene skal sorteres.
        </p>
        
        <div className="space-y-4">
          <div className="flex gap-2 items-center bg-white p-3 rounded-md border">
            <Select
              label="Sorter etter"
              value={orderBy?.column || ""}
              onChange={(e) => {
                if (e.target.value) {
                  setOrderBy(e.target.value, 'DESC');
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
                    key={`metric_${index}`} 
                    value={metric.alias || `metric_${index + 1}`}
                  >
                    {metric.alias || `metric_${index + 1}`}
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
    </div>
  );
};

export default Summarize;

import { Button, Heading, Select, Label, TextField } from '@navikt/ds-react';
import { Filter, DynamicFilterOption, Parameter } from '../types/chart';
import { DYNAMIC_FILTER_OPTIONS, FILTER_COLUMNS, OPERATORS } from '../lib/constants';
import { sanitizeColumnName } from '../lib/utils';

interface ChartFiltersProps {
  filters: Filter[];
  dynamicFilters: string[];
  parameters: Parameter[];
  setFilters: (filters: Filter[]) => void;
  setDynamicFilters: (filters: string[]) => void;
}

const ChartFilters = ({
  filters,
  dynamicFilters,
  parameters,
  setFilters,
  setDynamicFilters
}: ChartFiltersProps) => {
  const addFilter = () => {
    setFilters([...filters, { column: 'url_path', operator: '=', value: '' }]);
  };

  const removeFilter = (index: number) => {
    setFilters(filters.filter((_, i) => i !== index));
  };

  const updateFilter = (index: number, updates: Partial<Filter>) => {
    setFilters(filters.map((filter, i) => 
      i === index ? { ...filter, ...updates } : filter
    ));
  };

  return (
    <section>
      <Heading level="2" size="small" spacing>
        Filtre
      </Heading>

      <div className="space-y-6 bg-gray-50 p-5 rounded-md border">
        {/* Dynamic Filters */}
        <div>
          <Heading level="3" size="xsmall" spacing>
            Dynamiske filtre for dashboard
          </Heading>
          <p className="text-sm text-gray-600 mb-4">
            Legg til filtre som kan endres direkte i Metabase-dashboardet.
          </p>

          <div className="flex flex-col gap-4">
            <div className="flex gap-2 items-center bg-white p-3 rounded-md border">
              <Select
                label="Legg til dynamisk filter"
                onChange={(e) => {
                  if (e.target.value && !dynamicFilters.includes(e.target.value)) {
                    setDynamicFilters([...dynamicFilters, e.target.value]);
                  }
                }}
                value=""
                size="small"
                className="flex-grow"
              >
                <option value="">Velg filter...</option>
                {DYNAMIC_FILTER_OPTIONS
                  .filter(option => !dynamicFilters.includes(option.value))
                  .map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
              </Select>
            </div>

            {dynamicFilters.length > 0 && (
              <div className="space-y-2 pl-1">
                <Label as="p" size="small">Valgte dynamiske filtre:</Label>
                <div className="space-y-2">
                  {dynamicFilters.map((filterValue) => {
                    const filter = DYNAMIC_FILTER_OPTIONS.find(f => f.value === filterValue);
                    if (!filter) return null;
                    
                    return (
                      <div key={filter.value} className="flex items-center justify-between bg-white p-3 rounded-md border">
                        <div>
                          <span className="font-medium">{filter.label}</span>
                          <div className="text-xs text-gray-600 mt-1">
                            <code className="bg-gray-100 px-1 rounded">
                              {filter.template}
                            </code>
                          </div>
                        </div>
                        <Button
                          variant="tertiary-neutral"
                          size="small"
                          onClick={() => {
                            setDynamicFilters(dynamicFilters.filter(f => f !== filter.value));
                          }}
                          className="ml-2"
                        >
                          Fjern
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Static Filters */}
        <div className="border-t pt-4">
          <Heading level="3" size="xsmall" spacing>
            Statiske filtre
          </Heading>
          <p className="text-sm text-gray-600 mb-4">
            Legg til faste filtre som vil være låst i grafen/tabellen.
          </p>

          {filters.length > 0 && (
            <div className="space-y-3 mb-4">
              {filters.map((filter, index) => (
                <div key={index} className="flex gap-2 items-end bg-white p-3 rounded-md border">
                  <Select
                    label="Kolonne"
                    value={filter.column}
                    onChange={(e) => updateFilter(index, { column: e.target.value, operator: '=', value: '' })}
                    size="small"
                  >
                    {Object.entries(FILTER_COLUMNS).map(([groupKey, group]) => (
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

                  <Select
                    label="Operator"
                    value={filter.operator}
                    onChange={(e) => updateFilter(index, { operator: e.target.value, value: '' })}
                    size="small"
                  >
                    {OPERATORS.map(op => (
                      <option key={op.value} value={op.value}>
                        {op.label}
                      </option>
                    ))}
                  </Select>

                  {!['IS NULL', 'IS NOT NULL'].includes(filter.operator) && (
                    <TextField
                      label="Verdi"
                      value={filter.value}
                      onChange={(e) => updateFilter(index, { value: e.target.value })}
                      size="small"
                    />
                  )}

                  <Button
                    variant="tertiary-neutral"
                    size="small"
                    onClick={() => removeFilter(index)}
                    className="mb-1"
                  >
                    Fjern
                  </Button>
                </div>
              ))}
            </div>
          )}

          <Button
            variant="secondary"
            onClick={addFilter}
            size="small"
            className="mb-2"
          >
            Legg til statisk filter
          </Button>
        </div>
      </div>
    </section>
  );
};

export default ChartFilters;

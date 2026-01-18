import { Button, Heading, Select, TextField, HelpText, Tabs, Label, UNSAFE_Combobox } from '@navikt/ds-react';
import { MoveUp, MoveDown, Users, BarChart2, PieChart, Clock, LogOut } from 'lucide-react';
import { useState, useEffect, forwardRef, useImperativeHandle, useRef } from 'react';
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
  hideHeader?: boolean;
  availableEvents?: string[];
  isEventsLoading?: boolean;
}

const MetricSelector = forwardRef(({
  metrics,
  parameters,
  METRICS,
  COLUMN_GROUPS,
  getMetricColumns,
  sanitizeColumnName,
  updateMetric,
  removeMetric,
  addMetric,
  moveMetric,
  hideHeader = false,
  availableEvents = [],
  isEventsLoading = false
}: SummarizeProps, ref) => {
  const [alertInfo, setAlertInfo] = useState<{ show: boolean, message: string }>({
    show: false,
    message: ''
  });

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [activeCalculations, setActiveCalculations] = useState<string[]>([]);
  const [activeMetricCategory, setActiveMetricCategory] = useState<string>('antall');

  const [editingMetrics, setEditingMetrics] = useState<number[]>([]);

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

    setActiveMetricCategory('antall');

    if (!silent) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      setAlertInfo({
        show: true,
        message: 'Alle målinger ble tilbakestilt'
      });

      timeoutRef.current = setTimeout(() => {
        setAlertInfo(prev => ({ ...prev, show: false }));
        timeoutRef.current = null;
      }, 4000);
    }
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const handleAlertClose = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setAlertInfo(prev => ({ ...prev, show: false }));
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

  const isMetricAdded = (functionType: string, column?: string, checkMinutes?: boolean): boolean => {
    return metrics.some(metric =>
      metric.function === functionType &&
      metric.column === column &&
      (checkMinutes === undefined || metric.showInMinutes === checkMinutes)
    );
  };

  useEffect(() => {
    const calculationIds = metrics.map(m => `${m.function}_${m.column || ''}`);
    setActiveCalculations(calculationIds);
  }, [metrics]);

  useEffect(() => {
    const event = new CustomEvent('summarizeStepStatus', {
      detail: {
        hasUserSelectedMetrics: metrics.length > 0
      }
    });
    document.dispatchEvent(event);
  }, [metrics]);

  useImperativeHandle(ref, () => ({
    resetConfig
  }));

  const isShortcutMetric = (metric: Metric): boolean => {
    const shortcutMetrics = [
      { function: 'distinct', column: 'session_id' },
      { function: 'count', column: 'session_id' },
      { function: 'count', column: undefined, alias: 'Antall_sidevisninger' },
      { function: 'count', column: undefined, alias: 'Antall_hendelser' },
      { function: 'percentage', column: 'session_id', alias: 'Andel_av_besokende_pa_side' },
      { function: 'percentage', column: 'session_id' },
      { function: 'percentage', column: 'event_id', alias: 'Andel_av_hendelser_pa_side' },
      { function: 'percentage', column: 'event_id' },
      { function: 'andel', column: 'session_id' },
      { function: 'bounce_rate', column: 'visit_id' },
      { function: 'average', column: 'visit_duration', showInMinutes: true },
      { function: 'average', column: 'visit_duration', showInMinutes: false }
    ];

    return shortcutMetrics.some(shortcut => {
      if (shortcut.function !== metric.function) return false;
      if (shortcut.column !== metric.column) return false;
      if (shortcut.alias && shortcut.alias !== metric.alias) return false;
      if (shortcut.showInMinutes !== undefined && shortcut.showInMinutes !== metric.showInMinutes) return false;
      return true;
    });
  };

  const toggleEditMetric = (index: number) => {
    setEditingMetrics(prev => {
      if (prev.includes(index)) {
        return prev.filter(i => i !== index);
      } else {
        return [...prev, index];
      }
    });
  };

  const shouldShowDetailedView = (metric: Metric, index: number): boolean => {
    return editingMetrics.includes(index) || !isShortcutMetric(metric);
  };

  const getMetricDisplayName = (metric: Metric): string => {
    if (metric.function === 'distinct' && metric.column === 'session_id') {
      return 'Antall unike besøkende';
    }

    if (metric.function === 'count' && metric.alias === 'Antall_sidevisninger') {
      return 'Antall sidevisninger';
    }
    if (metric.function === 'count' && metric.alias === 'Antall_hendelser') {
      return 'Antall hendelser';
    }
    if (metric.function === 'percentage' && metric.column === 'session_id' && metric.alias === 'Andel_av_besokende_pa_side') {
      return 'Andel av besøkende på side';
    }
    if (metric.function === 'percentage' && metric.column === 'session_id') {
      return 'Andel av besøkende';
    }
    if (metric.function === 'percentage' && metric.column === 'event_id' && metric.alias === 'Andel_av_hendelser_pa_side') {
      return 'Andel av hendelser på side';
    }
    if (metric.function === 'percentage' && metric.column === 'event_id') {
      return 'Andel av hendelser';
    }
    if (metric.function === 'andel' && metric.column === 'session_id') {
      return 'Andel av totale besøkende';
    }
    if (metric.function === 'bounce_rate' && metric.column === 'visit_id') {
      return 'Fluktrate';
    }
    if (metric.function === 'average' && metric.column === 'visit_duration') {
      return metric.showInMinutes
        ? 'Besøksvarighet i minutter'
        : 'Besøksvarighet i sekunder';
    }
    return METRICS.find(m => m.value === metric.function)?.label || 'Måling';
  };

  return (
    <>
      {!hideHeader && (
        <div className="flex justify-between items-center mb-4">
          <Heading level="2" size="small">
            Hva vil du måle?
          </Heading>

          <Button
            variant="tertiary"
            size="small"
            onClick={() => resetConfig(false)}
          >
            Tilbakestill målinger
          </Button>
        </div>
      )}
      <div>
        {alertInfo.show && (
          <div className="mb-4">
            <AlertWithCloseButton
              variant="success"
              onClose={handleAlertClose}
            >
              {alertInfo.message}
            </AlertWithCloseButton>
          </div>
        )}

        <div>
          <div className="flex items-center gap-2 mb-4">
            <Heading level="3" size="xsmall" >
              Hva vil du måle?
            </Heading>
            <HelpText title="Hva er en måling?">
              Legg til en eller flere målinger, disse vises som kolonner i tabeller og grafer.
            </HelpText>
          </div>

          <div className="space-y-4">
            <div className="mb-2">
              <div className="bg-[var(--ax-bg-default)] p-4 rounded-md border shadow-inner">
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
                        onClick={() => addConfiguredMetric('distinct', 'session_id', 'Unike_besokende')}
                        icon={<Users size={16} />}
                        disabled={isMetricAdded('distinct', 'session_id')}
                      >
                        Antall unike besøkende
                      </Button>
                      <Button
                        variant="secondary"
                        size="small"
                        onClick={() => addConfiguredMetric('count', undefined, 'Antall_sidevisninger')}
                        icon={<BarChart2 size={16} />}
                        disabled={metrics.some(m => m.function === 'count' && m.alias === 'Antall_sidevisninger')}
                      >
                        Antall sidevisninger
                      </Button>
                      <Button
                        variant="secondary"
                        size="small"
                        onClick={() => addConfiguredMetric('count', undefined, 'Antall_hendelser')}
                        icon={<BarChart2 size={16} />}
                        disabled={metrics.some(m => m.function === 'count' && m.alias === 'Antall_hendelser')}
                      >
                        Antall hendelser
                      </Button>
                    </div>
                  </Tabs.Panel>

                  <Tabs.Panel value="andel" className="pt-4">
                    <div className="space-y-4">
                      <div>
                        <h4 className="text-sm font-medium mb-2 text-[var(--ax-text-subtle)]">Andel av alle besøkende på hele nettsiden</h4>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="secondary"
                            size="small"
                            onClick={() => addConfiguredMetric('andel', 'session_id', 'Andel_av_totale_besokende')}
                            icon={<PieChart size={16} />}
                            disabled={isMetricAdded('andel', 'session_id')}
                          >
                            Andel av totale besøkende
                          </Button>
                        </div>
                      </div>

                      <div>
                        <h4 className="text-sm font-medium mb-2 text-[var(--ax-text-subtle)]">Andel av besøkende på en side</h4>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="secondary"
                            size="small"
                            onClick={() => addConfiguredMetric('percentage', 'session_id', 'Andel_av_besokende_pa_side')}
                            icon={<PieChart size={16} />}
                            disabled={isMetricAdded('percentage', 'session_id')}
                          >
                            Andel av besøkende på side
                          </Button>
                        </div>
                      </div>

                      <div>
                        <h4 className="text-sm font-medium mb-2 text-[var(--ax-text-subtle)]">Andel av hendelser på en side</h4>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="secondary"
                            size="small"
                            onClick={() => addConfiguredMetric('percentage', 'event_id', 'Andel_av_hendelser_pa_side')}
                            icon={<PieChart size={16} />}
                            disabled={isMetricAdded('percentage', 'event_id')}
                          >
                            Andel av hendelser på side
                          </Button>
                        </div>
                      </div>

                      <div>
                        <h4 className="text-sm font-medium mb-2 text-[var(--ax-text-subtle)]">Fluktrate - andel besøkende som kun ser én side før de forlater nettstedet</h4>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="secondary"
                            size="small"
                            onClick={() => addConfiguredMetric('bounce_rate', 'visit_id', 'Fluktrate')}
                            icon={<LogOut size={16} />}
                            disabled={isMetricAdded('bounce_rate', 'visit_id')}
                          >
                            Fluktrate
                          </Button>
                        </div>
                      </div>
                    </div>
                  </Tabs.Panel>

                  <Tabs.Panel value="gjennomsnitt" className="pt-4">
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="secondary"
                        size="small"
                        onClick={() => {
                          const newIndex = metrics.length;
                          addMetric('average');
                          setTimeout(() => {
                            updateMetric(newIndex, {
                              column: 'visit_duration',
                              alias: 'Gjennomsnittlig_besokstid_minutter',
                              showInMinutes: true
                            });
                          }, 0);
                        }}
                        icon={<Clock size={16} />}
                        disabled={isMetricAdded('average', 'visit_duration', true)}
                      >
                        Besøksvarighet i minutter
                      </Button>
                      <Button
                        variant="secondary"
                        size="small"
                        onClick={() => addConfiguredMetric('average', 'visit_duration', 'Gjennomsnittlig_besokstid_sekunder')}
                        icon={<Clock size={16} />}
                        disabled={isMetricAdded('average', 'visit_duration', false)}
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
              <Heading level="3" size="xsmall" spacing className="mt-6">
                Valgte målinger
              </Heading>
            )}

            {metrics.map((metric, index) => (
              <div key={index} className={`flex ${shouldShowDetailedView(metric, index) ? 'flex-col' : 'items-center justify-between'} bg-[var(--ax-bg-default)] px-4 py-3 rounded-md border`}>
                <div className="flex items-center justify-between w-full">
                  <div className="flex flex-col">
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-[var(--ax-text-subtle)]">
                        {index + 1}.
                      </span>
                      <span className="font-medium">
                        {isShortcutMetric(metric) && !shouldShowDetailedView(metric, index)
                          ? getMetricDisplayName(metric)
                          : METRICS.find(m => m.value === metric.function)?.label || 'Måling'}
                        {metric.column === 'visit_duration' && (
                          <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                            {metric.showInMinutes ? 'minutter' : 'sekunder'}
                          </span>
                        )}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {isShortcutMetric(metric) ? (
                      <>
                        <Button
                          variant={shouldShowDetailedView(metric, index) ? "primary" : "secondary"}
                          size="small"
                          onClick={() => toggleEditMetric(index)}
                        >
                          {shouldShowDetailedView(metric, index) ? "Minimer" : "Endre"}
                        </Button>
                        <Button
                          variant="tertiary-neutral"
                          size="small"
                          onClick={() => removeMetric(index)}
                        >
                          Fjern
                        </Button>
                      </>
                    ) : (
                      <>
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
                        </div>
                        <Button
                          variant="tertiary-neutral"
                          size="small"
                          onClick={() => removeMetric(index)}
                        >
                          Fjern
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                {shouldShowDetailedView(metric, index) && (
                  <div className="mt-4 border-t pt-4">
                    {metric.function === 'count_where' ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Select
                            label="Hva skal telles?"
                            value={metric.column || ''}
                            onChange={(e) => updateMetric(index, { column: e.target.value })}
                            size="small"
                            className="w-full"
                          >
                            <option value="">Velg kolonne...</option>
                            <option value="session_id">Besøk (sessions)</option>
                            <option value="event_id">Hendelser (events)</option>
                            <option value="visit_id">Unike besøkende (visitors)</option>
                          </Select>
                        </div>
                        <div className="bg-[var(--ax-bg-neutral-soft)] p-3 rounded border">
                          <Label size="small" className="mb-2 block">Filtrer på (WHERE)</Label>
                          <div className="flex flex-col gap-2">
                            <Select
                              label="Kolonne"
                              hideLabel
                              value={metric.whereColumn || ''}
                              onChange={(e) => updateMetric(index, { whereColumn: e.target.value, whereValue: '' })}
                              size="small"
                            >
                              <option value="">Velg kolonne...</option>
                              <option value="event_name">Hendelsesnavn</option>
                              <option value="url_path">URL-sti</option>
                              <optgroup label="Enhet">
                                <option value="device">Enhetstype</option>
                                <option value="browser">Nettleser</option>
                                <option value="os">Operativsystem</option>
                              </optgroup>
                            </Select>

                            <Select
                              label="Operator"
                              hideLabel
                              value={metric.whereOperator || '='}
                              onChange={(e) => updateMetric(index, { whereOperator: e.target.value })}
                              size="small"
                            >
                              <option value="=">Er lik (=)</option>
                              <option value="!=">Er ikke lik (!=)</option>
                              <option value="LIKE">Inneholder (LIKE)</option>
                              <option value="NOT LIKE">Inneholder ikke (NOT LIKE)</option>
                              <option value="STARTS_WITH">Starter med</option>
                            </Select>

                            {metric.whereColumn === 'event_name' ? (
                              <div>
                                {isEventsLoading && <div className="text-xs text-[var(--ax-text-subtle)] mb-1">Laster hendelser...</div>}
                                <div className={isEventsLoading ? 'opacity-50 pointer-events-none' : ''}>
                                  <UNSAFE_Combobox
                                    label="Verdi"
                                    hideLabel
                                    options={availableEvents.map(e => ({ label: e, value: e }))}
                                    selectedOptions={metric.whereValue ? [metric.whereValue] : []}
                                    onToggleSelected={(option, isSelected) => {
                                      updateMetric(index, { whereValue: isSelected ? option : '' });
                                    }}
                                    isMultiSelect={false}
                                    size="small"
                                    // @ts-ignore
                                    disabled={isEventsLoading}
                                  />
                                </div>
                              </div>
                            ) : (
                              <TextField
                                label="Verdi"
                                hideLabel
                                value={metric.whereValue || ''}
                                onChange={(e) => updateMetric(index, { whereValue: e.target.value })}
                                size="small"
                              />
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col md:flex-row gap-4">
                        {metric.function !== 'count' && (
                          <div className="flex-grow">
                            <Select
                              label="Kolonne"
                              value={metric.column || ''}
                              onChange={(e) => {
                                const updates: Partial<Metric> = {
                                  column: e.target.value,
                                  showInMinutes: undefined
                                };
                                updateMetric(index, updates);
                              }}
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

                            {metric.column === 'visit_duration' && (
                              <div className="mt-2">
                                <Label size="small">Tidsenhet</Label>
                                <div className="flex gap-2 mt-1">
                                  <Button
                                    variant={metric.showInMinutes ? "secondary" : "primary"}
                                    size="xsmall"
                                    onClick={() => updateMetric(index, { showInMinutes: false })}
                                  >
                                    Sekunder
                                  </Button>
                                  <Button
                                    variant={metric.showInMinutes ? "primary" : "secondary"}
                                    size="xsmall"
                                    onClick={() => updateMetric(index, { showInMinutes: true })}
                                  >
                                    Minutter
                                  </Button>
                                </div>
                              </div>
                            )}
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
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
});

export default MetricSelector;

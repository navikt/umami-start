import { useState, useEffect, useCallback, useRef } from 'react';
import { Heading, VStack } from '@navikt/ds-react';
import Kontaktboks from '../components/kontaktboks';
import WebsitePicker from '../components/WebsitePicker';
import SQLPreview from '../components/chartbuilder/sqlpreview';
import ChartFilters from '../components/chartbuilder/ChartFilters';
import Summarize from '../components/chartbuilder/Summarize';
import EventParameterSelector from '../components/chartbuilder/EventParameterSelector';
import DisplayOptions from '../components/chartbuilder/DisplayOptions';
import AlertWithCloseButton from '../components/chartbuilder/AlertWithCloseButton';
import { FILTER_COLUMNS } from '../lib/constants';
import { 
  Parameter, 
  Metric, 
  DateFormat, 
  MetricOption,
  ColumnOption,
  ChartConfig,
  Filter,
  Website
} from '../types/chart';
import CopyButton from '../components/theme/CopyButton/CopyButton';

// Add date formats that aren't in constants.ts
const DATE_FORMATS: DateFormat[] = [
  { 
    label: 'År', 
    value: 'year',
    format: '%Y'
  },
  { 
    label: 'Måned', 
    value: 'month',
    format: '%Y-%m'
  },
  { 
    label: 'Uke', 
    value: 'week',
    format: '%Y-%U'
  },
  { 
    label: 'Dag', 
    value: 'day',
    format: '%Y-%m-%d'
  },
  { 
    label: 'Time', 
    value: 'hour',
    format: '%Y-%m-%d %H:00'
  },
  { 
    label: 'Minutt', 
    value: 'minute',
    format: '%Y-%m-%d %H:%M'
  }
];

const METRICS: MetricOption[] = [
  { label: 'Antall rader', value: 'count' },
  { label: 'Antall unike verdier', value: 'distinct' },
  { label: 'Antall rader hvor', value: 'count_where' },
  { label: 'Sum av verdier', value: 'sum' },
  { label: 'Gjennomsnitt', value: 'average' },
  { label: 'Median', value: 'median' },
  { label: 'Andel av resultatene (%)', value: 'percentage' },
  { label: 'Andel av totalen (%)', value: 'andel' },
  { label: 'Fluktrate (%)', value: 'bounce_rate' }
];

// Add the sanitizeColumnName helper function BEFORE it's used
const sanitizeColumnName = (key: string): string => {
  return key
    .replace(/\./g, '_')
    .replace(/æ/gi, 'ae')
    .replace(/ø/gi, 'oe')
    .replace(/å/gi, 'aa')
    .replace(/[^a-z0-9_]/gi, '_'); // Replace any other special characters with underscore
};

// Add this function near other helper functions at the top
const sanitizeFieldNameForBigQuery = (name: string): string => {
  // Replace spaces, parentheses and other special chars with underscores
  return name
    .replace(/[^\w]/g, '_') // Replace non-word characters with underscore
    .replace(/^[0-9]/, '_$&'); // Prefix with underscore if first char is a number
};

// Now define getMetricColumns which uses sanitizeColumnName
const getMetricColumns = (parameters: Parameter[], metric: string): ColumnOption[] => {
  // Define the base columns structure with proper typing
  const baseColumns: Record<string, Array<{label: string, value: string}>> = {
    count: [],
    distinct: [
      { label: 'Hendelses-ID', value: 'event_id' },
      { label: 'Person-ID', value: 'session_id' },
      { label: 'Besøk-ID', value: 'visit_id' },
      { label: 'Nettleser', value: 'browser' },
      { label: 'URL-sti', value: 'url_path' },
      // Add more columns from FILTER_COLUMNS
      ...Object.values(FILTER_COLUMNS).flatMap(group => group.columns)
    ],
    sum: [
      { label: 'Event Data (numeric)', value: 'event_data' },
    ],
    average: [
      { label: 'Event Data (numeric)', value: 'event_data' },
    ],
    median: [],
    min: [
      { label: 'Created At', value: 'created_at' },
    ],
    max: [
      { label: 'Created At', value: 'created_at' },
    ],
    percentage: [
      { label: 'Besøkende', value: 'session_id' },
      { label: 'Økter', value: 'visit_id' },
      { label: 'Hendelser', value: 'event_id' },
      { label: 'Rader', value: 'alle_rader_prosent' }
    ],
    andel: [
      { label: 'Besøkende (av totale besøkende)', value: 'session_id' },
      { label: 'Økter (av totale økter)', value: 'visit_id' },
      { label: 'Hendelser (av totale hendelser)', value: 'event_id' }
    ],
    bounce_rate: [
      { label: 'Besøk-ID', value: 'visit_id' }
    ]
  };

  // Create a new array from the base columns (or empty array if metric not found)
  const cols = [...(baseColumns[metric] || [])];

  // Add numeric parameters to sum, average and median
  if (metric === 'sum' || metric === 'average' || metric === 'median') {
    parameters
      .filter(param => param.type === 'number')
      .forEach(param => {
        cols.push({
          label: param.key,
          value: `param_${sanitizeColumnName(param.key)}`
        });
      });
  }

  // Add all parameters to distinct, min, and max
  if (metric === 'distinct' || metric === 'min' || metric === 'max') {
    parameters.forEach(param => {
      cols.push({
        label: param.key,
        value: `param_${sanitizeColumnName(param.key)}`
      });
    });
  }

  return cols;
};

// Add this new function for parameter aggregation
const getParameterAggregator = (paramType: string): string => {
  // Use appropriate aggregation functions based on data type
  switch (paramType) {
    case 'number':
      return 'MAX'; // Numbers can use MAX safely
    case 'string':
      return 'ANY_VALUE'; // For strings, use ANY_VALUE to get a representative value
    default:
      return 'ANY_VALUE'; // Default to ANY_VALUE for unknown types
  }
};

// Add this helper function near the top with other helpers
const isSessionColumn = (column: string): boolean => {
  // These are columns that exist in the session table rather than the event table
  const sessionColumns = ['browser', 'os', 'device', 'screen', 'language', 'country', 'subdivision1', 'city'];
  return sessionColumns.includes(column);
};

// Modified function to accept params instead of using closure variables
const getRequiredTables = (
  chartConfig: ChartConfig,
  filtersList: Filter[]
): { session: boolean, eventData: boolean } => {
  const tables = { session: false, eventData: false };
  
  // Check group by fields
  if (chartConfig.groupByFields.some(field => isSessionColumn(field))) {
    tables.session = true;
  }
  
  // Check filters
  if (filtersList.some(filter => isSessionColumn(filter.column))) {
    tables.session = true;
  }

  // Improved check for metrics that need session table
  if (chartConfig.metrics.some(metric => {
    // Check the main column
    if (metric.column && isSessionColumn(metric.column)) {
      return true;
    }
    
    // Check count_where conditions
    if (metric.function === 'count_where' && 
        metric.whereColumn && isSessionColumn(metric.whereColumn)) {
      return true;
    }
    
    // For percentage and andel metrics with session columns
    if ((metric.function === 'percentage' || metric.function === 'andel') && 
        metric.column && 
        ['session_id', 'visit_id'].includes(metric.column)) {
      return true;
    }
    
    return false;
  })) {
    tables.session = true;
  }
  
  // Always include event_data table for custom metrics/parameters
  tables.eventData = true;
  
  return tables;
};

const ChartsPage = () => {
  const [config, setConfig] = useState<ChartConfig>({
    website: null,
    filters: [],
    metrics: [],
    groupByFields: [],
    orderBy: null,
    dateFormat: 'day',
    paramAggregation: 'unique',
    limit: null
  });
  const [generatedSQL, setGeneratedSQL] = useState<string>('');
  const [filters, setFilters] = useState<Filter[]>([]);
  const [parameters, setParameters] = useState<Parameter[]>([]);
  const [availableEvents, setAvailableEvents] = useState<string[]>([]);
  const [dateRangeReady, setDateRangeReady] = useState<boolean>(false);
  const [maxDaysAvailable, setMaxDaysAvailable] = useState<number>(0);
  
  // Add missing state variables for date range settings
  const [dateRangeInDays, setDateRangeInDays] = useState<number>(3);
  const [tempDateRangeInDays, setTempDateRangeInDays] = useState<number>(3);
  const [dateChanged, setDateChanged] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [forceReload, setForceReload] = useState<boolean>(false); // Add state to force reload

  // Add state to track the current step
  const [currentStep, setCurrentStep] = useState<number>(1);

  // Add state to track whether user has explicitly selected metrics
  const [hasUserSelectedMetrics, setHasUserSelectedMetrics] = useState<boolean>(false);

  // Add the missing alertInfo state near other state declarations
  const [alertInfo] = useState<{show: boolean, message: string}>({
    show: false,
    message: ''
  });

  // Fix dependency in useEffect by adding config as a stable reference
  const debouncedConfig = useDebounce(config, 500);

  useEffect(() => {
    if (debouncedConfig.website) {
      generateSQL();
    }
  }, [debouncedConfig, filters, parameters]);

  // Create a function to calculate the current step based on selections
  const calculateCurrentStep = useCallback(() => {
    if (!config.website) {
      return 1; // Step 1: Choose website
    }
    
    // Modify this condition to use our explicit tracking of user metric selections
    if (!hasUserSelectedMetrics && config.groupByFields.length === 0) {
      return 2; // Step 2: Add metrics/groupings - stay on this step until user explicitly adds metrics
    }
    
    // If user has added metrics or groupings, but no filters, show step 3
    if (filters.length === 0) {
      return 3; // Step 3: Apply filters
    }
    
    return 4; // Step 4: Insert in Metabase
  }, [config.website, filters.length, hasUserSelectedMetrics, config.groupByFields.length]);

  // Update the step whenever relevant data changes
  useEffect(() => {
    setCurrentStep(calculateCurrentStep());
  }, [calculateCurrentStep]);

  // Add event listener for the custom event from Summarize
  useEffect(() => {
    const handleSummarizeStepStatus = (event: any) => {
      if (event.detail && typeof event.detail.hasUserSelectedMetrics !== 'undefined') {
        setHasUserSelectedMetrics(event.detail.hasUserSelectedMetrics);
      }
    };
    
    document.addEventListener('summarizeStepStatus', handleSummarizeStepStatus);
    
    return () => {
      document.removeEventListener('summarizeStepStatus', handleSummarizeStepStatus);
    };
  }, []);

  // Add state to manage FormProgress open state
  const [formProgressOpen, setFormProgressOpen] = useState<boolean>(true);
  
  // Create a handler for FormProgress open state changes
  const handleFormProgressOpenChange = (open: boolean) => {
    setFormProgressOpen(open);
  };

  // Create refs to expose reset functions from child components
  const chartFiltersRef = useRef<{ resetFilters: (silent?: boolean) => void }>(null);
  const summarizeRef = useRef<{ resetConfig: (silent?: boolean) => void }>(null);
  const displayOptionsRef = useRef<{ resetOptions: (silent?: boolean) => void }>(null);

  // Update the resetAll function
  const resetAll = () => {
    // Pass silent=true to prevent individual alerts
    if (chartFiltersRef.current) {
      chartFiltersRef.current.resetFilters(true);
    }
    
    // Pass silent=true to prevent individual alerts
    if (summarizeRef.current) {
      summarizeRef.current.resetConfig(true);
    }
    
    // Pass silent=true to prevent individual alerts
    if (displayOptionsRef.current) {
      displayOptionsRef.current.resetOptions(true);
    }
  };

  // Add helper functions for metrics
  const addMetric = (functionType?: string) => {
    setConfig(prev => {
      const newMetrics = [...prev.metrics, { function: functionType || 'count' }];
      const updatedConfig = {
        ...prev,
        metrics: newMetrics
      };
      
      // Auto-set sort order when adding the first metric if there's no date grouping
      if (newMetrics.length === 1 && !prev.groupByFields.includes('created_at') && 
          (!prev.orderBy || prev.orderBy.column === 'dato')) {
        // Use default name for first metric based on function
        updatedConfig.orderBy = { 
          column: 'metrikk_1', 
          direction: 'DESC' 
        };
      }
      
      return updatedConfig;
    });
  };

  const removeMetric = (index: number) => {
    setConfig(prev => {
      const newConfig = { ...prev };
      
      // Get the metric being removed
      const removedMetric = prev.metrics[index];
      const removedMetricAlias = removedMetric.alias || `metrikk_${index + 1}`;
      
      // If we're removing the metric that's being used for sorting, clear the orderBy
      if (newConfig.orderBy && (
        newConfig.orderBy.column === removedMetricAlias || 
        newConfig.orderBy.column === `andel_${index + 1}` ||
        (removedMetric.function === 'percentage' && !removedMetric.alias && newConfig.orderBy.column === 'andel')
      )) {
        newConfig.orderBy = null;
      }
      
      // Remove the metric
      newConfig.metrics = prev.metrics.filter((_, i) => i !== index);
      
      return newConfig;
    });
  };

  const updateMetric = (index: number, updates: Partial<Metric>) => {
    setConfig((prev: ChartConfig) => {
      // Get the current metric before changes
      const currentMetric = prev.metrics[index];
      const oldAlias = currentMetric.alias || `metrikk_${index + 1}`;
      
      // Apply the updates
      const updatedConfig = {
        ...prev,
        metrics: prev.metrics.map((metric: Metric, i: number): Metric => 
          i === index ? { ...metric, ...updates } : metric
        )
      };
      
      // If we're changing the alias and the current metric is being used for sorting
      if (updates.alias !== undefined && 
          prev.orderBy && 
          prev.orderBy.column === oldAlias) {
        
        // Update the sort to use the new alias
        updatedConfig.orderBy = {
          column: updates.alias || `metrikk_${index + 1}`,
          direction: prev.orderBy.direction
        };
      }
      
      return updatedConfig;
    });
  };

  const moveMetric = (index: number, direction: 'up' | 'down') => {
    setConfig(prev => {
      const newMetrics = [...prev.metrics];
      const newIndex = direction === 'up' ? index - 1 : index + 1;
      
      if (newIndex >= 0 && newIndex < newMetrics.length) {
        [newMetrics[index], newMetrics[newIndex]] = [newMetrics[newIndex], newMetrics[index]];
      }
      
      return {
        ...prev,
        metrics: newMetrics
      };
    });
  };
      
  // Add helper functions for group by fields
  const addGroupByField = (field: string) => {
    if (!config.groupByFields.includes(field)) {
      setConfig(prev => {
        // If adding 'created_at' as the first field or as the only field, update orderBy
        if (field === 'created_at' && (prev.groupByFields.length === 0)) {
          return {
            ...prev,
            groupByFields: [field, ...prev.groupByFields],
            orderBy: { column: 'dato', direction: 'ASC' }
          };
        }
        
        return {
          ...prev,
          groupByFields: [...prev.groupByFields, field]
        };
      });
    }
  };

  const removeGroupByField = (field: string) => {
    setConfig(prev => ({
      ...prev,
      groupByFields: prev.groupByFields.filter(f => f !== field)
    }));
  };

  const moveGroupField = (index: number, direction: 'up' | 'down') => {
    setConfig(prev => {
      const newFields = [...prev.groupByFields];
      const newIndex = direction === 'up' ? index - 1 : index + 1;
      
      if (newIndex >= 0 && newIndex < newFields.length) {
        [newFields[index], newFields[newIndex]] = [newFields[newIndex], newFields[index]];
      }
      
      return {
        ...prev,
        groupByFields: newFields
      };
    });
  };

  const getDateFilterConditions = useCallback((): string => {
    const dateFilters = filters.filter(f => 
      f.column === 'created_at' || 
      (f.column === 'custom_column' && f.customColumn?.includes('created_at'))
    );
    
    if (dateFilters.length === 0) return '';
    
    let conditions = '';
    
    dateFilters.forEach(filter => {
      if (filter.value) {
        const column = filter.column === 'custom_column' ? filter.customColumn : filter.column;
        conditions += ` AND ${column} ${filter.operator} ${filter.value}`;
      }
    });
    
    return conditions;
  }, [filters]);

  const getMetricSQLByType = useCallback((func: string, column?: string, alias: string = 'metric', metric?: Metric): string => {
    // Check if we're in interactive mode (has Metabase parameters)
    const hasInteractiveFilters = filters.some(f => f.interactive === true && f.metabaseParam === true);
    
    // In interactive mode, don't use backtick quotes for aliases
    // In normal mode, use backticks to allow special characters in column names
    // But ALWAYS sanitize the alias for BigQuery compatibility
    const sanitizedAlias = sanitizeFieldNameForBigQuery(alias);
    
    const quotedAlias = hasInteractiveFilters 
      ? `${sanitizedAlias}` // No backticks in interactive mode
      : `\`${sanitizedAlias}\``; // Use backticks in normal mode
    
    const websiteId = config.website?.id || '';
    
    // Special handling for count_where
    if (func === 'count_where' && metric) {
      const whereColumn = metric.whereColumn || 'event_name';
      const whereOperator = metric.whereOperator || '=';
      
      if (['IN', 'NOT IN'].includes(whereOperator) && metric.whereMultipleValues && metric.whereMultipleValues.length > 0) {
        const valueList = metric.whereMultipleValues
          .map(val => {
            const needsQuotes = isNaN(Number(val)) || whereColumn === 'event_name' || whereColumn === 'url_path';
            return needsQuotes ? `'${val.replace(/'/g, "''")}'` : val;
          })
          .join(', ');
        
        return `COUNT(CASE WHEN base_query.${whereColumn} ${whereOperator} (${valueList}) THEN 1 ELSE NULL END) as ${quotedAlias}`;
      } 
      else if (['LIKE', 'NOT LIKE'].includes(whereOperator) && metric.whereValue) {
        return `COUNT(CASE WHEN base_query.${whereColumn} ${whereOperator} '%${metric.whereValue.replace(/'/g, "''")}%' THEN 1 ELSE NULL END) as ${quotedAlias}`;
      }
      else if (metric.whereValue) {
        const needsQuotes = isNaN(Number(metric.whereValue)) || whereColumn === 'event_name' || whereColumn === 'url_path';
        const formattedValue = needsQuotes ? `'${metric.whereValue.replace(/'/g, "''")}'` : metric.whereValue;
        
        return `COUNT(CASE WHEN base_query.${whereColumn} ${whereOperator} ${formattedValue} THEN 1 ELSE NULL END) as ${quotedAlias}`;
      }
      
      return `COUNT(*) as ${quotedAlias} /* count_where missing conditions */`;
    }
    
    // If it's a custom parameter metric
    if (column?.startsWith('param_')) {
      const paramKey = column.replace('param_', '');
      
      switch (func) {
        case 'distinct':
          return `COUNT(DISTINCT CASE WHEN event_data.data_key = '${paramKey}' THEN event_data.string_value END) as ${quotedAlias}`;
        case 'sum':
        case 'average':
        case 'median':
          return `${func === 'average' ? 'AVG' : func.toUpperCase()}(
            CASE 
              WHEN event_data.data_key = '${paramKey}'
              THEN CAST(event_data.number_value AS NUMERIC)
            END
          ) as ${quotedAlias}`;
        case 'min':
          return `MIN(CASE WHEN event_data.data_key = '${paramKey}' THEN event_data.string_value END) as ${quotedAlias}`;
        case 'max':
          return `MAX(CASE WHEN event_data.data_key = '${paramKey}' THEN event_data.string_value END) as ${quotedAlias}`;
        case 'percentage':
          return `ROUND(
            100.0 * COUNT(*) / (
              SUM(COUNT(*)) OVER()
            )
          , 1) as ${quotedAlias}`;
        case 'andel':
          return `ROUND(
            100.0 * COUNT(*) / (
              SELECT COUNT(*) FROM base_query
            )
          , 1) as ${quotedAlias}`;
        default:
          return `COUNT(*) as ${quotedAlias}`;
      }
    }

    // Add support for bounce_rate calculation
    if (func === 'bounce_rate') {
      return `ROUND(
        100.0 * SUM(CASE WHEN base_query.visit_counts = 1 THEN 1 ELSE 0 END) / COUNT(DISTINCT base_query.visit_id)
      , 1) as ${quotedAlias}`;
    }

    // For regular columns
    switch (func) {
      case 'count':
        return `COUNT(*) as ${quotedAlias}`;
      case 'distinct':
        // Fix ambiguous column reference by explicitly specifying the table
        if (column === 'session_id') {
          return `COUNT(DISTINCT base_query.session_id) as ${quotedAlias}`;
        }
        return `COUNT(DISTINCT ${column || 'base_query.session_id'}) as ${quotedAlias}`;
      case 'sum':
        // Special handling for visit_duration
        if (column === 'visit_duration') {
          return `SUM(base_query.visit_duration) as ${quotedAlias}`;
        }
        return column ? `SUM(${column}) as ${quotedAlias}` : `COUNT(*) as ${quotedAlias}`;
      case 'average':
        // Special handling for visit_duration
        if (column === 'visit_duration') {
          // Check if we need to show in minutes (using the metric object)
          if (metric?.showInMinutes) {
            return `ROUND(AVG(NULLIF(base_query.visit_duration, 0)) / 60, 2) as ${quotedAlias}`;
          }
          return `AVG(NULLIF(base_query.visit_duration, 0)) as ${quotedAlias}`;
        }
        return column ? `AVG(${column}) as ${quotedAlias}` : `COUNT(*) as ${quotedAlias}`;
      case 'min':
        return column ? `MIN(${column}) as ${quotedAlias}` : `COUNT(*) as ${quotedAlias}`;
      case 'max':
        return column ? `MAX(${column}) as ${quotedAlias}` : `COUNT(*) as ${quotedAlias}`;
      case 'percentage':
        if (column) {
          if (column === 'alle_rader_prosent') {
            return `ROUND(
              100.0 * COUNT(*) / (
                SUM(COUNT(*)) OVER()
              )
            , 1) as ${quotedAlias}`;
          }
          return `ROUND(
            100.0 * COUNT(DISTINCT base_query.${column}) / (
              SUM(COUNT(DISTINCT base_query.${column})) OVER()
            )
          , 1) as ${quotedAlias}`;
        }
        return `ROUND(
          100.0 * COUNT(*) / (
            SUM(COUNT(*)) OVER()
          )
        , 1) as ${quotedAlias}`;
      case 'andel':
        if (column && websiteId) {
          const hasInteractiveDateFilter = filters.some(f => 
            f.column === 'created_at' && f.interactive === true && f.metabaseParam === true
          );
          if (column === 'session_id') {
            return `ROUND(
              100.0 * COUNT(DISTINCT base_query.${column}) / NULLIF((
                SELECT COUNT(DISTINCT ${column}) 
                FROM \`team-researchops-prod-01d6.umami.public_website_event\`
                WHERE website_id = '${websiteId}'
                ${hasInteractiveDateFilter 
                  ? '[[AND {{created_at}} ]]' 
                  : getDateFilterConditions()}
              ), 0)
            , 1) as ${quotedAlias}`;
          } else if (column === 'visit_id') {
            return `ROUND(
              100.0 * COUNT(DISTINCT base_query.${column}) / NULLIF((
                SELECT COUNT(DISTINCT ${column})
                FROM \`team-researchops-prod-01d6.umami.public_website_event\`
                WHERE website_id = '${websiteId}'
                ${hasInteractiveDateFilter 
                  ? '[[AND {{created_at}} ]]' 
                  : getDateFilterConditions()}
              ), 0)
            , 1) as ${quotedAlias}`;
          }
        }
        return `COUNT(*) as ${quotedAlias} /* Andel calculation skipped */`;
      default:
        return `COUNT(*) as ${quotedAlias}`;
    }
  }, [config.website?.id, getDateFilterConditions, filters]);

  const getMetricSQL = useCallback((metric: Metric, index: number): string => {
    if (metric.alias) {
      return getMetricSQLByType(metric.function, metric.column, metric.alias, metric);
    }
    const defaultAlias = `metrikk_${index + 1}`;
    return getMetricSQLByType(metric.function, metric.column, defaultAlias, metric);
  }, [getMetricSQLByType, config.metrics]);

  const generateSQLCore = useCallback((
    config: ChartConfig,
    filters: Filter[],
    parameters: Parameter[]
  ): string => {
    if (!config.website) return '';

    const hasInteractiveDateFilter = filters.some(f => 
      f.column === 'created_at' && f.interactive === true && f.metabaseParam === true
    );
    
    const fullWebsiteTable = '`team-researchops-prod-01d6.umami.public_website_event`';
    const fullSessionTable = '`team-researchops-prod-01d6.umami.public_session`';
    
    // Determine if any filter is interactive (has Metabase parameters)
    const hasInteractiveFilters = filters.some(f => f.interactive === true && f.metabaseParam === true);
    
    // In interactive mode, use descriptive alias names instead of single letters
    const websiteAlias = hasInteractiveFilters ? 'website_event' : 'e';

    // Use the appropriate table prefix based on mode and aliases
    const tablePrefix = hasInteractiveFilters ? 
      `${websiteAlias}.` : 
      'e.';
    
    const requiredTables = getRequiredTables(config, filters);
    
    const needsUrlFullpath = filters.some(f => f.column === 'url_fullpath') || 
                            config.groupByFields.includes('url_fullpath');
    
    const needsVisitDuration = config.metrics.some(m => 
      m.column === 'visit_duration'
    ) || config.groupByFields.includes('visit_duration');

    // If we need bounce rate calculation, add a subquery for visit counts
    const needsBounceCounts = config.metrics.some(m => m.function === 'bounce_rate');

    let sql = '';

    if (needsBounceCounts) {
      sql = 'WITH visit_counts AS (\n';
      sql += '  SELECT\n';
      sql += '    visit_id,\n';
      sql += '    COUNT(*) AS events_count\n';
      sql += `  FROM ${fullWebsiteTable}\n`;
      sql += `  WHERE website_id = '${config.website.id}'\n`;
      
      if (hasInteractiveDateFilter) {
        const interactiveDateFilter = filters.find(f => 
          f.column === 'created_at' && f.interactive === true && f.metabaseParam === true
        );
        if (interactiveDateFilter) {
          sql += `  [[AND {{${interactiveDateFilter.value?.replace(/[{}]/g, '')}}} ]]\n`;
        }
      }
      
      sql += '  GROUP BY visit_id\n';
      sql += '),\n';
      
      // Continue with base_query including visit_counts
      sql += 'base_query AS (\n';
      sql += '  SELECT\n';
      sql += '    e.*,\n';
      sql += '    vc.events_count AS visit_counts\n';
      
      if (needsVisitDuration) {
        sql += '    ,COALESCE(vd.duration, 0) as visit_duration\n';
      }
      
      // Add session columns if needed
      if (requiredTables.session) {
        sql += '    ,s.browser,\n';
        sql += '    s.os,\n';
        sql += '    s.device,\n';
        sql += '    s.screen,\n';
        sql += '    s.language,\n';
        sql += '    s.country,\n';
        sql += '    s.subdivision1,\n';
        sql += '    s.city\n';
      }
      
      // FROM and JOIN clauses
      sql += `  FROM ${fullWebsiteTable} e\n`;
      sql += '  LEFT JOIN visit_counts vc\n';
      sql += '    ON e.visit_id = vc.visit_id\n';
      
      if (needsVisitDuration) {
        sql += '  LEFT JOIN visit_durations vd\n';
        sql += '    ON e.visit_id = vd.visit_id\n';
      }
      
      if (requiredTables.session) {
        sql += `  LEFT JOIN ${fullSessionTable} s\n`;
        sql += '    ON e.session_id = s.session_id\n';
      }
    } else if (needsVisitDuration) {
      // Improved visit duration calculation - matches the sample SQL
      sql += 'WITH visit_metrics AS (\n';
      sql += '  SELECT\n';
      sql += '    visit_id,\n';
      sql += '    MIN(created_at) AS first_event_time,\n';
      sql += '    CASE WHEN COUNT(*) > 1 THEN TIMESTAMP_DIFF(MAX(created_at), MIN(created_at), SECOND) ELSE 0 END AS duration_seconds\n';
      sql += `  FROM \`team-researchops-prod-01d6.umami.public_website_event\`\n`;
      sql += `  WHERE website_id = '${config.website.id}'\n`;
      
      if (hasInteractiveDateFilter) {
        const interactiveDateFilter = filters.find(f => 
          f.column === 'created_at' && f.interactive === true && f.metabaseParam === true
        );
        if (interactiveDateFilter) {
          sql += `  [[AND {{${interactiveDateFilter.value?.replace(/[{}]/g, '')}}} ]]\n`;
        }
      }
      
      sql += '  GROUP BY visit_id\n';
      sql += '),\n';
      
      sql += 'base_query AS (\n';
      sql += '  SELECT\n';
      sql += '    e.*,\n';
      sql += '    vm.duration_seconds as visit_duration\n';
      
      // Continue with session columns if needed
      if (requiredTables.session) {
        sql += '    ,s.browser,\n';
        sql += '    s.os,\n';
        sql += '    s.device,\n';
        sql += '    s.screen,\n';
        sql += '    s.language,\n';
        sql += '    s.country,\n';
        sql += '    s.subdivision1,\n';
        sql += '    s.city\n';
      }
      
      // FROM and JOIN clauses - adapted for visit_duration - ALWAYS ADD THIS
      sql += `  FROM ${fullWebsiteTable} e\n`;
      sql += '  LEFT JOIN visit_metrics vm\n';
      sql += '    ON e.visit_id = vm.visit_id\n';
      
      if (requiredTables.session) {
        sql += `  LEFT JOIN ${fullSessionTable} s\n`;
        sql += '    ON e.session_id = s.session_id\n';
      }
    } else {
      sql += 'WITH base_query AS (\n';
      sql += '  SELECT\n';
      sql += '    e.*';
      
      let addComma = false;
      
      if (needsUrlFullpath) {
        if (addComma) sql += ',\n';
        sql += "    CONCAT(IFNULL(e.url_path, ''), IFNULL(e.url_query, '')) as url_fullpath";
        addComma = true;
      }
      
      sql += `  FROM ${fullWebsiteTable} e\n`;
      
      if (requiredTables.session) {
        sql += `  LEFT JOIN ${fullSessionTable} s\n`;
        sql += '    ON e.session_id = s.session_id\n';
      }
    }

    sql += `  WHERE ${tablePrefix}website_id = '${config.website.id}'\n`;
    
    filters.forEach(filter => {
      if (filter.column.startsWith('param_')) {
        const paramBase = filter.column.replace('param_', '');
        const matchingParams = parameters.filter(p => {
          const baseName = p.key.split('.').pop();
          return sanitizeColumnName(baseName!) === paramBase;
        });
        if (matchingParams.length > 0) {
          const param = matchingParams[0];
          const valueField = param.type === 'number' ? 'number_value' : 'string_value';
          sql += `  AND event_data.data_key = '${paramBase}' AND event_data.${valueField} ${filter.operator} ${filter.value}\n`;
        }
      } else {
        if (filter.operator === 'IN' && filter.multipleValues && filter.multipleValues.length > 0) {
          const valueList = filter.multipleValues
            .map(val => {
              const needsQuotes = isNaN(Number(val)) || 
                filter.column === 'event_name' || 
                filter.column === 'url_path' ||
                filter.column.includes('_path') ||
                filter.column.includes('_name');
              return needsQuotes ? `'${val.replace(/'/g, "''")}'` : val;
            })
            .join(', ');
          
          sql += `  AND ${tablePrefix}${filter.column} IN (${valueList})\n`;
        }
        else if (filter.operator === 'IS NULL' || filter.operator === 'IS NOT NULL') {
          sql += `  AND ${tablePrefix}${filter.column} ${filter.operator}\n`;
        }
        else if (filter.value) {
          if ((filter.operator === 'LIKE' || filter.operator === 'NOT LIKE') && 
              !filter.value.includes('%')) {
            sql += `  AND ${tablePrefix}${filter.column} ${filter.operator} '%${filter.value.replace(/'/g, "''")}%'`;
          } else {
            const isTimestampFunction = typeof filter.value === 'string' && 
                                       filter.value.toUpperCase().includes('TIMESTAMP(') &&
                                       !filter.value.startsWith("'");
            
            // Check if this is a Metabase parameter (interactive filter)
            const isMetabaseParam = filter.metabaseParam === true && 
                                    typeof filter.value === 'string' && 
                                    filter.value.includes('{{') && 
                                    filter.value.includes('}}');
            
            const needsQuotes = !isTimestampFunction && !isMetabaseParam && (
              isNaN(Number(filter.value)) || 
              filter.column === 'event_name' || 
              filter.column === 'url_path' ||
              filter.column.includes('_path') ||
              filter.column.includes('_name')
            );
            
            const formattedValue = isTimestampFunction 
              ? filter.value.replace(/^['"]|['"]$/g, '') 
              : isMetabaseParam
                ? filter.value.replace(/^['"]|['"]$/g, '') // Remove any quotes from Metabase parameters
                : needsQuotes 
                  ? `'${filter.value.replace(/'/g, "''")}'` 
                  : filter.value;
            
            sql += `  AND ${tablePrefix}${filter.column} ${filter.operator} ${formattedValue}\n`;
          }
        }
        else if (filter.operator !== 'IS NULL' && filter.operator !== 'IS NOT NULL') {
          console.warn(`Skipping filter with no value: ${filter.column} ${filter.operator}`);
        }
      }
    });

    sql += ')\n\n';
    
    sql += 'SELECT\n';
    const selectClauses = new Set<string>();

    config.groupByFields.forEach(field => {
      if (field === 'created_at') {
        const format = DATE_FORMATS.find(f => f.value === config.dateFormat)?.format || '%Y-%m-%d';
        selectClauses.add(`FORMAT_TIMESTAMP('${format}', base_query.created_at) AS dato`);
      } else if (field.startsWith('param_')) {
        const paramBase = field.replace('param_', '');
        const matchingParams = parameters.filter(p => {
          const baseName = p.key.split('.').pop();
          return sanitizeColumnName(baseName!) === paramBase;
        });
        if (matchingParams.length > 0) {
          const param = matchingParams[0];
          const valueField = param.type === 'number' ? 'number_value' : 'string_value';
          if (config.paramAggregation === 'unique' && param.type === 'string') {
            selectClauses.add(
              `event_data_${paramBase}.${valueField} AS ${field}`
            );
          } else {
            const aggregator = getParameterAggregator(param.type);
            selectClauses.add(
              `${aggregator}(CASE 
                WHEN SUBSTR(event_data.data_key, INSTR(event_data.data_key, '.') + 1) = '${paramBase}' THEN event_data.${valueField}
                ELSE NULL
              END) AS ${field}`
            );
          }
        }
      } else if (field === 'visit_duration') {
        const visitDurationBucketFilter = filters.find(f => 
          f.column === 'custom_column' && 
          f.customColumn && 
          f.customColumn.includes('visit_duration') && 
          f.customColumn.includes('CASE')
        );
        
        if (visitDurationBucketFilter && visitDurationBucketFilter.customColumn) {
          selectClauses.add(`${visitDurationBucketFilter.customColumn} AS visit_duration_bucket`);
        } else {
          selectClauses.add(`base_query.visit_duration AS visit_duration`);
        }
      } else {
        selectClauses.add(`base_query.${field}`);
      }
    });

    config.metrics.forEach((metric, index) => {
      selectClauses.add(getMetricSQL(metric, index));
    });

    sql += '  ' + Array.from(selectClauses).join(',\n  ');

    sql += '\nFROM base_query\n';

    if (parameters.length > 0) {
      const needsEventData = config.groupByFields.some(field => field.startsWith('param_')) ||
                            filters.some(filter => filter.column.startsWith('param_')) ||
                            config.metrics.some(metric => metric.column?.startsWith('param_'));
      if (needsEventData) {
        sql += 'LEFT JOIN `team-researchops-prod-01d6.umami.public_event_data` AS event_data\n';
        sql += '  ON base_query.event_id = event_data.website_event_id\n';
      }
      if (config.paramAggregation === 'unique') {
        config.groupByFields.forEach(field => {
          if (field.startsWith('param_')) {
            const paramBase = field.replace('param_', '');
            const matchingParam = parameters.find(p => {
              const baseName = p.key.split('.').pop();
              return sanitizeColumnName(baseName!) === paramBase;
            });
            if (matchingParam && matchingParam.type === 'string') {
              sql += `LEFT JOIN \`team-researchops-prod-01d6.umami.public_event_data\` AS event_data_${paramBase}\n`;
              sql += `  ON base_query.event_id = event_data_${paramBase}.website_event_id\n`;
              sql += `  AND SUBSTR(event_data_${paramBase}.data_key, INSTR(event_data_${paramBase}.data_key, '.') + 1) = '${paramBase}'\n`;
            }
          }
        });
      }
    }

    if (config.groupByFields.length > 0) {
      const groupByCols: string[] = [];
      config.groupByFields.forEach(field => {
        if (field === 'created_at') {
          groupByCols.push('dato');
        } else if (field === 'visit_duration') {
          const visitDurationBucketFilter = filters.find(f => 
            f.column === 'custom_column' && 
            f.customColumn && 
            f.customColumn.includes('visit_duration') && 
            f.customColumn.includes('CASE')
          );
          
          if (visitDurationBucketFilter) {
            groupByCols.push('visit_duration_bucket');
          } else {
            groupByCols.push('visit_duration');
          }
        } else if (field.startsWith('param_') && config.paramAggregation === 'unique') {
          const paramBase = field.replace('param_', '');
          const matchingParam = parameters.find(p => {
            const baseName = p.key.split('.').pop();
            return sanitizeColumnName(baseName!) === paramBase;
          });
          if (matchingParam && matchingParam.type === 'string') {
            groupByCols.push(field);
          } else if (!matchingParam) {
            groupByCols.push(field);
          }
        } else if (!field.startsWith('param_')) {
          groupByCols.push(`base_query.${field}`);
        }
      });
      if (groupByCols.length > 0) {
        sql += 'GROUP BY\n  ';
        sql += groupByCols.join(',\n  ');
        sql += '\n';
      }
    }
    
    if (config.orderBy && config.orderBy.column && config.orderBy.direction) {
      const hasInteractiveFilters = filters.some(f => f.interactive === true && f.metabaseParam === true);
      const metricWithAlias = config.metrics.find(m => m.alias === config.orderBy?.column);
      
      // @ts-ignore
      let finalColumn = config.orderBy.column;
      
      // Sanitize the orderBy column name for BigQuery
      finalColumn = sanitizeFieldNameForBigQuery(finalColumn);
      
      if (config.orderBy.column === 'andel' && !metricWithAlias) {
        const percentageMetrics = config.metrics.filter(m => 
          m.function === 'percentage' && !m.alias
        );
        if (percentageMetrics.length === 1) {
          finalColumn = 'andel';
        }
      }
      
      // In interactive mode, don't quote column names in ORDER BY
      const orderColumn = config.orderBy.column === 'created_at' 
        ? 'dato' 
        : hasInteractiveFilters
          ? finalColumn // No backticks in interactive mode, but still sanitized
          : `\`${finalColumn}\``; // Use backticks and sanitized name
      
      const columnExists = config.groupByFields.some(field => 
        (field === 'created_at' && config.orderBy?.column === 'dato') ||
        field === config.orderBy?.column
      ) || config.metrics.some((m, i) => {
        // For metrics with explicit aliases
        if (m.alias === config.orderBy?.column) return true;
        
        // For metrics with default names (metrikk_N)
        if (`metrikk_${i + 1}` === config.orderBy?.column) return true;
        
        // For percentage metrics that use "andel" as their name
        if (m.function === 'percentage' && (
          config.orderBy?.column === 'andel' ||
          config.orderBy?.column === `andel_${i + 1}`
        )) return true;
        
        return false;
      });
      
      if (columnExists) {
        sql += `ORDER BY ${orderColumn} ${config.orderBy.direction}\n`;
      } else {
        if (config.groupByFields.includes('created_at')) {
          sql += 'ORDER BY dato ASC\n';
        } else {
          sql += 'ORDER BY 1 DESC\n';
        }
      }
    } else if (config.groupByFields.length > 0 || config.metrics.length > 0) {
      if (config.groupByFields.includes('created_at')) {
        sql += 'ORDER BY dato ASC\n';
      } else if (config.metrics.length > 0) {
        const firstMetric = config.metrics[0];
        const firstMetricAlias = firstMetric.alias || 'metrikk_1';
        const sanitizedAlias = sanitizeFieldNameForBigQuery(firstMetricAlias);
        sql += `ORDER BY \`${sanitizedAlias}\` ${config.orderBy?.direction || 'DESC'}\n`;
      } else {
        sql += `ORDER BY 1 ${config.orderBy?.direction || 'DESC'}\n`;
      }
    }

    if (config.limit && config.limit > 0) {
      sql += `LIMIT ${config.limit}\n`;
    }

    return sql;
  }, [getMetricSQL]);

  const generateSQL = useCallback(() => {
    if (!config.website || !config.website.id) {
      setGeneratedSQL('-- Please select a website to generate SQL');
      return;
    }
    setGeneratedSQL(generateSQLCore(config, filters, parameters));
  }, [config, filters, parameters, generateSQLCore]);

  const setOrderBy = (column: string, direction: 'ASC' | 'DESC') => {
    const metricWithAlias = config.metrics.find(m => m.alias === column);
    if (column === 'andel' && !metricWithAlias) {
      const percentageMetrics = config.metrics.filter(m => 
        m.function === 'percentage' && !m.alias
      );
      if (percentageMetrics.length === 1) {
        column = 'andel';
      }
    }
    
    // Store the sanitized column name in orderBy
    setConfig(prev => ({
      ...prev,
      orderBy: { 
        column, // Keep the original column name for reference purposes
        direction 
      }
    }));
  };

  const clearOrderBy = () => {
    setConfig(prev => ({
      ...prev,
      orderBy: null
    }));
  };

  const handleDateRangeChange = useCallback(() => {
    if (tempDateRangeInDays < 1) {
      setTempDateRangeInDays(1);
      setDateRangeInDays(1);
    } else if (tempDateRangeInDays > maxDaysAvailable && maxDaysAvailable > 0) {
      setTempDateRangeInDays(maxDaysAvailable);
      setDateRangeInDays(maxDaysAvailable);
    } else {
      setDateRangeInDays(tempDateRangeInDays);
    }
    if (config.website) {
      setIsLoading(true);
      setForceReload(prev => !prev);
      setDateChanged(true);
      setTimeout(() => {
        setDateChanged(false);
      }, 5000);
    }
  }, [tempDateRangeInDays, maxDaysAvailable, config.website]);

  const handleWebsiteChange = useCallback((website: Website | null) => {
    setConfig(prev => ({ 
      ...prev, 
      website 
    }));
    if (website && website.id !== config.website?.id) {
      setFilters([]);
      setConfig(prev => ({
        ...prev,
        website,
        metrics: [],
        groupByFields: [],
        orderBy: null
      }));
    }
  }, [config.website?.id]);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const dateRange = urlParams.get('dateRange');
    if (dateRange && !isNaN(Number(dateRange))) {
      const days = Number(dateRange);
      if (days > 0 && days <= 90) {
        setDateRangeInDays(days);
        setTempDateRangeInDays(days);
      }
    }
  }, []);

  const handleEventsLoad = (events: string[], autoParameters?: { key: string; type: 'string' }[], maxDays?: number) => {
    setAvailableEvents(events);
    if (autoParameters) {
      setParameters(autoParameters);
    }
    if (maxDays !== undefined) {
      setMaxDaysAvailable(maxDays);
    }
    setDateRangeReady(true);
    setIsLoading(false);
  };

  const setParamAggregation = (strategy: 'representative' | 'unique') => {
    setConfig(prev => ({
      ...prev,
      paramAggregation: strategy
    }));
  };

  const setLimit = (newLimit: number | null) => {
    setConfig((prev) => {
      // Create a copy with the same exact shape as the original
      const updatedConfig: ChartConfig = {
        ...prev,
        limit: newLimit
      };
      return updatedConfig;
    });
  };

  return (
    <div className="w-full max-w-[1600px]">
      <Heading spacing level="1" size="medium" className="pt-12 pb-4">
        Still spørsmål og få svaret i Metabase
      </Heading>
      <Heading level="3" size="small" spacing className="text-gray-700 mt-2 mb-3">
        Lurer du på hvordan folk bruker nettsiden eller appen din?
      </Heading>
      <p className="text-gray-600 mb-10 prose text-lg">
        Dette verktøyet hjelper deg med å stille spørsmål og gir deg svarene i form av grafer og tabeller i Metabase – som du enkelt kan dele med kollegaer.
      </p>

      {/* Display the alert if it's active */}
      {alertInfo.show && (
        <div className="mb-4">
          <AlertWithCloseButton variant="success">
            {alertInfo.message}
          </AlertWithCloseButton>
        </div>
      )}

      <div className="flex flex-col lg:grid lg:grid-cols-2 lg:gap-8">
        <div className="mb-8 order-1 lg:order-none">
          <VStack gap="4">
            <section>
              <WebsitePicker 
                selectedWebsite={config.website}
                onWebsiteChange={handleWebsiteChange}
                onEventsLoad={handleEventsLoad}
                dateRangeInDays={dateRangeInDays}
                shouldReload={forceReload}
              />
            </section>

            {config.website && dateRangeReady && (
              <>
                {/* Step 1: Explorer - Keep this in original position for learning purposes */}
                <section className="mt-4">
                  <EventParameterSelector
                    availableEvents={availableEvents}
                    parameters={parameters}
                    setParameters={setParameters}
                    maxDaysAvailable={maxDaysAvailable}
                    dateRangeInDays={dateRangeInDays}
                    tempDateRangeInDays={tempDateRangeInDays}
                    handleDateRangeChange={handleDateRangeChange}
                    dateChanged={dateChanged}
                    isLoading={isLoading}
                  />
                </section>

                {/* Step 2: What to Calculate (Metrics) - Simplified to just metrics */}
                <section className="mt-4">
                  <Summarize
                    ref={summarizeRef} // Add ref
                    metrics={config.metrics}
                    parameters={parameters}
                    METRICS={METRICS}
                    COLUMN_GROUPS={FILTER_COLUMNS}
                    getMetricColumns={getMetricColumns}
                    sanitizeColumnName={sanitizeColumnName}
                    updateMetric={(index, updates) => updateMetric(index, updates)}
                    removeMetric={removeMetric}
                    addMetric={addMetric}
                    moveMetric={moveMetric}
                    filters={filters}
                  />
                </section>

                {/* Step 3: Event Filter Selection */}
                <section className="mt-4">
                  <ChartFilters
                    ref={chartFiltersRef} // Add ref
                    filters={filters}
                    parameters={parameters}
                    setFilters={setFilters}
                    availableEvents={availableEvents}
                    maxDaysAvailable={maxDaysAvailable}
                  />
                </section>

                {/* Step 4: New Display Options component for grouping and visualization */}
                <section className="mt-4">
                  <DisplayOptions
                    ref={displayOptionsRef} // Add ref
                    groupByFields={config.groupByFields}
                    parameters={parameters}
                    dateFormat={config.dateFormat}
                    orderBy={config.orderBy}
                    paramAggregation={config.paramAggregation}
                    limit={config.limit}
                    DATE_FORMATS={DATE_FORMATS}
                    COLUMN_GROUPS={FILTER_COLUMNS}
                    sanitizeColumnName={sanitizeColumnName}
                    addGroupByField={addGroupByField}
                    removeGroupByField={removeGroupByField}
                    moveGroupField={moveGroupField}
                    setOrderBy={setOrderBy}
                    clearOrderBy={clearOrderBy}
                    setDateFormat={(format) => setConfig(prev => ({
                      ...prev,
                      dateFormat: format as DateFormat['value']
                    }))}
                    setParamAggregation={setParamAggregation}
                    setLimit={setLimit}
                    metrics={config.metrics}
                  />
                </section>
              </>
            )}
          </VStack>

          <div className="mt-8 hidden lg:block">
            <Kontaktboks />
          </div>
        </div>

        <div className="mb-8 order-2 lg:order-none lg:sticky lg:top-4 lg:self-start">
          <div className="overflow-y-auto">
            <SQLPreview 
              sql={generatedSQL} 
              activeStep={currentStep} 
              openFormprogress={formProgressOpen}
              onOpenChange={handleFormProgressOpenChange}
              filters={filters}
              metrics={config.metrics}
              groupByFields={config.groupByFields}
              onResetAll={resetAll} // Add reset function
            />
          </div>
        </div>

        <div className="order-3 lg:hidden">
          <Kontaktboks />
        </div>
      </div>
      <CopyButton 
        textToCopy={generatedSQL} 
        visible={!!generatedSQL && 
          generatedSQL !== '-- Please select a website to generate SQL' && 
          !isBasicTemplate(generatedSQL)}
      />
    </div>
  );
};

// Helper function to check if SQL is basic template
const isBasicTemplate = (sql: string): boolean => {
  if (!sql) return true;
  const selectPattern = /SELECT\s+(\s*FROM|\s*$)/i;
  return selectPattern.test(sql);
};

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  });

  return debouncedValue;
}

export default ChartsPage;
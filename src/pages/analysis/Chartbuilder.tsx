import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import WebsitePicker from '../../components/analysis/WebsitePicker';
import QueryPreview from '../../components/chartbuilder/results/QueryPreview';
import EventFilter from '../../components/chartbuilder/EventFilter';
import ChartLayout from '../../components/analysis/ChartLayout';
import MetricSelector from '../../components/chartbuilder/MetricSelector';
// EventParameterSelector import removed as per user request
import GroupingOptions from '../../components/chartbuilder/GroupingOptions';
import AlertWithCloseButton from '../../components/chartbuilder/AlertWithCloseButton';
import { FILTER_COLUMNS } from '../../lib/constants';
import {
  Parameter,
  Metric,
  DateFormat,
  MetricOption,
  ColumnOption,
  ChartConfig,
  Filter,
  Website
} from '../../types/chart';
//import CopyButton from '../../components/theme/CopyButton/CopyButton';

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
  const baseColumns: Record<string, Array<{ label: string, value: string }>> = {
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
const SESSION_COLUMNS = ['browser', 'os', 'device', 'screen', 'language', 'country', 'subdivision1', 'city'] as const;

const isSessionColumn = (column: string): boolean => {
  // These are columns that exist in the session table rather than the event table
  return (SESSION_COLUMNS as readonly string[]).includes(column);
};

// Helper function to get only the specific session columns that are actually needed
const getRequiredSessionColumns = (
  chartConfig: ChartConfig,
  filtersList: Filter[]
): string[] => {
  const requiredColumns = new Set<string>();

  // Check group by fields
  chartConfig.groupByFields.forEach(field => {
    if (isSessionColumn(field)) {
      requiredColumns.add(field);
    }
  });

  // Check filters
  filtersList.forEach(filter => {
    if (isSessionColumn(filter.column)) {
      requiredColumns.add(filter.column);
    }
  });

  // Check metrics
  chartConfig.metrics.forEach(metric => {
    // Check the main column
    if (metric.column && isSessionColumn(metric.column)) {
      requiredColumns.add(metric.column);
    }

    // Check count_where conditions
    if (metric.function === 'count_where' && metric.whereColumn && isSessionColumn(metric.whereColumn)) {
      requiredColumns.add(metric.whereColumn);
    }
  });

  return Array.from(requiredColumns);
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
  const [searchParams] = useSearchParams();
  
  // Parse URL params for pre-populating from Dashboard
  const websiteIdFromUrl = searchParams.get('websiteId');
  const domainFromUrl = searchParams.get('domain');
  const websiteNameFromUrl = searchParams.get('websiteName');
  const titleFromUrl = searchParams.get('title');
  const urlPathFromUrl = searchParams.get('urlPath');
  const pathOperatorFromUrl = searchParams.get('pathOperator');
  const dateRangeFromUrl = searchParams.get('dateRange');
  const configFromUrl = searchParams.get('config');
  const filtersFromUrl = searchParams.get('filters');
  
  // Track if we've applied URL params (to avoid re-applying)
  const [hasAppliedUrlParams, setHasAppliedUrlParams] = useState(false);
  // Store pending filters to apply after events are loaded
  const [pendingFiltersFromUrl, setPendingFiltersFromUrl] = useState<Filter[] | null>(null);
  
  const [config, setConfig] = useState<ChartConfig>({
    website: null,
    filters: [],
    metrics: [],
    groupByFields: [],
    orderBy: null,
    dateFormat: 'day',
    paramAggregation: 'unique',
    limit: 1000
  });
  const [generatedSQL, setGeneratedSQL] = useState<string>('');
  const [filters, setFilters] = useState<Filter[]>([]);
  const [parameters, setParameters] = useState<Parameter[]>([]);
  const [availableEvents, setAvailableEvents] = useState<string[]>([]);
  const [dateRangeReady, setDateRangeReady] = useState<boolean>(false);
  const [maxDaysAvailable, setMaxDaysAvailable] = useState<number>(0);

  // Add missing state variables for date range settings
  const [dateRangeInDays, setDateRangeInDays] = useState<number>(14);
  /* const [tempDateRangeInDays, setTempDateRangeInDays] = useState<number>(14); */
  // const [tempDateRangeInDays, setTempDateRangeInDays] = useState<number>(14);

  /* const [dateChanged, setDateChanged] = useState<boolean>(false); */
  /* const [isLoading, setIsLoading] = useState<boolean>(false); */
  /* const [forceReload, setForceReload] = useState<boolean>(false); */
  const [forceReload] = useState<boolean>(false); // Add state to force reload
  // const [includeParams, setIncludeParams] = useState<boolean>(false); // Track whether parameters are loaded
  const [resetIncludeParams, setResetIncludeParams] = useState<boolean>(false); // Add state to trigger includeParams reset
  const [requestIncludeParams, setRequestIncludeParams] = useState<boolean>(false);
  const [requestLoadEvents, setRequestLoadEvents] = useState<boolean>(false);
  const [isEventsLoading, setIsEventsLoading] = useState<boolean>(false);



  // Add state to track the current step
  const [currentStep, setCurrentStep] = useState<number>(1);

  // Add state to track whether user has explicitly selected metrics
  const [hasUserSelectedMetrics, setHasUserSelectedMetrics] = useState<boolean>(false);

  // Add the missing alertInfo state near other state declarations
  const [alertInfo] = useState<{ show: boolean, message: string }>({
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

  // Apply URL params from Dashboard on initial load
  useEffect(() => {
    if (hasAppliedUrlParams) return;
    
    // Check if we have URL params to apply
    const hasUrlParams = websiteIdFromUrl || configFromUrl || filtersFromUrl || urlPathFromUrl;
    if (!hasUrlParams) {
      setHasAppliedUrlParams(true);
      return;
    }

    // Create website object from URL params if we have the necessary info
    if (websiteIdFromUrl && domainFromUrl) {
      const websiteFromUrl: Website = {
        id: websiteIdFromUrl,
        domain: domainFromUrl,
        name: websiteNameFromUrl || domainFromUrl,
        teamId: '',
        createdAt: ''
      };
      
      setConfig(prev => ({
        ...prev,
        website: websiteFromUrl
      }));
    }
    
    // Apply config from URL if provided (from chartbuilder-created charts)
    if (configFromUrl) {
      try {
        const parsedConfig = JSON.parse(configFromUrl);
        setConfig(prev => ({
          ...prev,
          ...parsedConfig,
          // Keep the website we just set if config doesn't have one
          website: prev.website || parsedConfig.website
        }));
        if (parsedConfig.metrics && parsedConfig.metrics.length > 0) {
          setHasUserSelectedMetrics(true);
        }
      } catch (e) {
        console.error('Failed to parse config from URL:', e);
      }
    }
    
    // Build filters to apply
    const filtersToApply: Filter[] = [];
    
    // Apply filters from URL if provided
    if (filtersFromUrl) {
      try {
        const parsedFilters = JSON.parse(filtersFromUrl);
        filtersToApply.push(...parsedFilters);
      } catch (e) {
        console.error('Failed to parse filters from URL:', e);
      }
    }
    
    // Apply URL path filter if provided (from dashboard)
    if (urlPathFromUrl && !filtersFromUrl) {
      const paths = urlPathFromUrl.split(',');
      
      // Add event_type filter for pageviews
      filtersToApply.push({ 
        column: 'event_type', 
        operator: '=', 
        value: '1' 
      });
      
      // Add URL path filter
      if (paths.length > 1) {
        filtersToApply.push({
          column: 'url_path',
          operator: 'IN',
          value: paths[0],
          multipleValues: paths
        });
      } else if (pathOperatorFromUrl === 'starts-with') {
        filtersToApply.push({
          column: 'url_path',
          operator: 'LIKE',
          value: paths[0]
        });
      } else {
        filtersToApply.push({
          column: 'url_path',
          operator: '=',
          value: paths[0]
        });
      }
    }
    
    // Apply date range filter if provided
    if (dateRangeFromUrl) {
      // Calculate the date range based on the period
      let fromSQL = '';
      let toSQL = 'CURRENT_TIMESTAMP()';
      
      if (dateRangeFromUrl === 'current_month') {
        fromSQL = "TIMESTAMP_TRUNC(CURRENT_TIMESTAMP(), MONTH)";
      } else if (dateRangeFromUrl === 'last_month') {
        fromSQL = "TIMESTAMP_TRUNC(TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 1 MONTH), MONTH)";
        toSQL = "TIMESTAMP_SUB(TIMESTAMP_TRUNC(CURRENT_TIMESTAMP(), MONTH), INTERVAL 1 SECOND)";
      } else {
        // Default to last 30 days
        fromSQL = "TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 DAY)";
      }
      
      filtersToApply.push(
        { column: 'created_at', operator: '>=', value: fromSQL, dateRangeType: 'dynamic' },
        { column: 'created_at', operator: '<=', value: toSQL, dateRangeType: 'dynamic' }
      );
      
      // Also update date range in days for WebsitePicker
      let days = 30;
      if (dateRangeFromUrl === 'current_month') {
        days = new Date().getDate();
      } else if (dateRangeFromUrl === 'last_month') {
        const lastMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 0);
        days = lastMonth.getDate();
      }
      setDateRangeInDays(days);
    }
    
    // Store filters to be applied - they'll be set after EventFilter mounts
    if (filtersToApply.length > 0) {
      setPendingFiltersFromUrl(filtersToApply);
    }
    
    setHasAppliedUrlParams(true);
  }, [hasAppliedUrlParams, websiteIdFromUrl, domainFromUrl, websiteNameFromUrl, configFromUrl, filtersFromUrl, urlPathFromUrl, pathOperatorFromUrl, dateRangeFromUrl]);

  // Apply pending filters once dateRangeReady is true (EventFilter has mounted)
  useEffect(() => {
    if (pendingFiltersFromUrl && dateRangeReady) {
      setFilters(pendingFiltersFromUrl);
      setPendingFiltersFromUrl(null);
    }
  }, [pendingFiltersFromUrl, dateRangeReady]);

  // Add state to manage FormProgress open state
  // const [formProgressOpen, setFormProgressOpen] = useState<boolean>(true);

  // Create a handler for FormProgress open state changes
  // const handleFormProgressOpenChange = (open: boolean) => {
  //   setFormProgressOpen(open);
  // };

  // Create refs to expose reset functions from child components
  const chartFiltersRef = useRef<{ resetFilters: (silent?: boolean) => void; enableCustomEvents: () => void }>(null);
  const summarizeRef = useRef<{ resetConfig: (silent?: boolean) => void }>(null);
  const displayOptionsRef = useRef<{ resetOptions: (silent?: boolean) => void }>(null);

  // Update the resetAll function
  const resetAll = () => {
    // Clear available events and parameters
    setAvailableEvents([]);
    setParameters([]);
    setDateRangeReady(false);

    // Reset the website selection
    setConfig(prev => ({
      ...prev,
      website: null,
      metrics: [],
      groupByFields: [],
      orderBy: null
    }));

    // Toggle resetIncludeParams to trigger reset in WebsitePicker
    setResetIncludeParams(prev => !prev);

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
      // Guard: check if the metric exists
      if (!prev.metrics[index]) {
        return prev;
      }

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
          // Build subquery filters for the denominator (Total Universe)
          let subqueryFilters = '';

          // 1. Handle Date Filters (Critical for performance - prevents full table scan)
          const interactiveDateFilter = filters.find(f => f.column === 'created_at' && f.interactive === true);
          if (interactiveDateFilter) {
            subqueryFilters += '\n  [[AND {{created_at}} ]]';
          } else {
            // Add standard date filters using the existing helper
            // This ensures the subquery respects the selected date range
            subqueryFilters += getDateFilterConditions();
          }

          // 2. Handle URL Path Filter
          // Note: Including url_path in the denominator restricts the "Universe" to this specific page.
          // This creates a "Proportion of visits to this page" vs "Proportion of total site traffic".
          // Preserving existing behavior but adding support for static values.
          const urlPathFilter = filters.find(f => f.column === 'url_path');
          if (urlPathFilter) {
            if (urlPathFilter.interactive === true && urlPathFilter.metabaseParam === true) {
              subqueryFilters += `\n  AND url_path = [[ {{url_sti}} --]] '/'`;
            } else if (urlPathFilter.value) {
              subqueryFilters += `\n  AND url_path = '${urlPathFilter.value.replace(/'/g, "''")}'`;
            }
          }

          // 3. Handle all other filters
          filters.forEach(filter => {
            // Skip already handled columns
            if (filter.column === 'created_at' || filter.column === 'url_path') return;

            // Skip param_ filters as they require UNNEST which isn't in the subquery
            if (filter.column.startsWith('param_')) return;

            // Skip session columns for now as subquery doesn't join session table (to avoid complexity/errors)
            // Ideally we should join public_session here too if filtering by browser/etc.
            if (isSessionColumn(filter.column)) return;

            if (filter.interactive === true && filter.metabaseParam === true && filter.value) {
              const paramName = filter.value.replace(/[{}]/g, '').trim();
              subqueryFilters += `\n  AND ${filter.column} = {{${paramName}}}`;
            } else if (filter.value) {
              // Handle static values
              const needsQuotes = isNaN(Number(filter.value));
              const val = needsQuotes ? `'${filter.value.replace(/'/g, "''")}'` : filter.value;
              subqueryFilters += `\n  AND ${filter.column} ${filter.operator || '='} ${val}`;
            }
          });

          if (column === 'session_id') {
            return `ROUND(
              100.0 * COUNT(DISTINCT base_query.${column}) / NULLIF((
                SELECT COUNT(DISTINCT ${column}) 
                FROM \`team-researchops-prod-01d6.umami.public_website_event\`
                WHERE website_id = '${websiteId}'${subqueryFilters}
              ), 0)
            , 1) as ${quotedAlias}`;
          } else if (column === 'visit_id') {
            return `ROUND(
              100.0 * COUNT(DISTINCT base_query.${column}) / NULLIF((
                SELECT COUNT(DISTINCT ${column})
                FROM \`team-researchops-prod-01d6.umami.public_website_event\`
                WHERE website_id = '${websiteId}'${subqueryFilters}
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

    const hasInteractiveFilters = filters.some(f => f.interactive === true && f.metabaseParam === true);

    // For interactive mode, we'll use fully qualified table names instead of aliases
    // For normal mode, we'll use aliases as usual
    let websiteAlias, sessionAlias, tablePrefix;

    if (hasInteractiveFilters) {
      // In interactive mode with Metabase, use the full table names directly
      websiteAlias = fullWebsiteTable;
      sessionAlias = fullSessionTable;
      tablePrefix = `${fullWebsiteTable}.`;
    } else {
      // For regular mode, use short aliases
      websiteAlias = 'e';
      sessionAlias = 's';
      tablePrefix = 'e.';
    }

    // Force usage of aliases to avoid TS errors
    if (websiteAlias && sessionAlias) {
      void websiteAlias;
      void sessionAlias;
    }

    const requiredTables = getRequiredTables(config, filters);
    const needsSessionJoin = requiredTables.session;
    const requiredSessionColumns = getRequiredSessionColumns(config, filters);

    const needsUrlFullpath = filters.some(f => f.column === 'url_fullpath') ||
      config.groupByFields.includes('url_fullpath');

    const needsVisitDuration = config.metrics.some(m =>
      m.column === 'visit_duration'
    ) || config.groupByFields.includes('visit_duration');

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
          sql += `  [[AND {{created_at}} ]]\n`; // Corrected format for interactive mode
        }
      } else {
        // PERF: Add standard date filters to the CTE
        // This ensures the CTE works on a partition subset instead of scanning the full table
        sql += getDateFilterConditions();
        sql += '\n'; // Add newline for cleaner SQL
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

      // Add only the session columns that are actually needed
      if (requiredTables.session && requiredSessionColumns.length > 0) {
        sql += '    ,' + requiredSessionColumns.map(col => `s.${col}`).join(',\n    ') + '\n';
      }

      // FROM and JOIN clauses - Adjusted for interactive mode
      if (hasInteractiveFilters) {
        sql += `  FROM ${fullWebsiteTable}\n`;
        sql += '  LEFT JOIN visit_counts vc\n';
        sql += `    ON ${fullWebsiteTable}.visit_id = vc.visit_id\n`;

        if (needsVisitDuration) {
          sql += '  LEFT JOIN visit_durations vd\n';
          sql += `    ON ${fullWebsiteTable}.visit_id = vd.visit_id\n`;
        }

        if (requiredTables.session) {
          sql += `  LEFT JOIN ${fullSessionTable}\n`;
          sql += `    ON ${fullWebsiteTable}.session_id = ${fullSessionTable}.session_id\n`;
        }
      } else {
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
          sql += `  [[AND {{created_at}} ]]\n`; // Corrected format for interactive mode
        }
      } else {
        // PERF: Add standard date filters to the CTE
        // This ensures the CTE works on a partition subset instead of scanning the full table
        sql += getDateFilterConditions();
        sql += '\n'; // Add newline for cleaner SQL
      }

      sql += '  GROUP BY visit_id\n';
      sql += '),\n';

      sql += 'base_query AS (\n';
      sql += '  SELECT\n';
      sql += '    e.*,\n';
      sql += '    vm.duration_seconds as visit_duration\n';

      // Add only the session columns that are actually needed
      if (requiredTables.session && requiredSessionColumns.length > 0) {
        sql += '    ,' + requiredSessionColumns.map(col => `s.${col}`).join(',\n    ') + '\n';
      }

      // FROM and JOIN clauses - adapted for visit_duration - ALWAYS ADD THIS
      if (hasInteractiveFilters) {
        sql += `  FROM ${fullWebsiteTable}\n`;
        sql += '  LEFT JOIN visit_metrics vm\n';
        sql += `    ON ${fullWebsiteTable}.visit_id = vm.visit_id\n`;

        if (requiredTables.session) {
          sql += `  LEFT JOIN ${fullSessionTable}\n`;
          sql += `    ON ${fullWebsiteTable}.session_id = ${fullSessionTable}.session_id\n`;
        }
      } else {
        sql += `  FROM ${fullWebsiteTable} e\n`;
        sql += '  LEFT JOIN visit_metrics vm\n';
        sql += '    ON e.visit_id = vm.visit_id\n';

        if (requiredTables.session) {
          sql += `  LEFT JOIN ${fullSessionTable} s\n`;
          sql += '    ON e.session_id = s.session_id\n';
        }
      }
    } else {
      sql += 'WITH base_query AS (\n';
      sql += '  SELECT\n';

      if (hasInteractiveFilters) {
        // In interactive mode, use full table names in the SELECT statement
        sql += `    ${fullWebsiteTable}.*`;

        // Add only the session fields that are actually needed
        if (needsSessionJoin && requiredSessionColumns.length > 0) {
          sql += ',\n';
          sql += '    ' + requiredSessionColumns.map(col => `${fullSessionTable}.${col}`).join(',\n    ');
        }

        if (needsUrlFullpath) {
          sql += needsSessionJoin ? ',\n' : '\n';
          sql += `    CONCAT(IFNULL(${fullWebsiteTable}.url_path, ''), IFNULL(${fullWebsiteTable}.url_query, '')) as url_fullpath`;
        }

        sql += `  FROM ${fullWebsiteTable}\n`;

        // Always add session join if needed
        if (needsSessionJoin) {
          sql += `  LEFT JOIN ${fullSessionTable}\n`;
          sql += `    ON ${fullWebsiteTable}.session_id = ${fullSessionTable}.session_id\n`;
        }
      } else {
        // In normal mode, use aliases as before
        sql += '    e.*';

        // Add only the session fields that are actually needed
        if (needsSessionJoin && requiredSessionColumns.length > 0) {
          sql += ',\n';
          sql += '    ' + requiredSessionColumns.map(col => `s.${col}`).join(',\n    ');
        }

        if (needsUrlFullpath) {
          sql += needsSessionJoin ? ',\n' : '\n';
          sql += "    CONCAT(IFNULL(e.url_path, ''), IFNULL(e.url_query, '')) as url_fullpath";
        }

        sql += `  FROM ${fullWebsiteTable} e\n`;

        // Always add session join if needed
        if (needsSessionJoin) {
          sql += `  LEFT JOIN ${fullSessionTable} s\n`;
          sql += '    ON e.session_id = s.session_id\n';
        }
      }
    }

    sql += `  WHERE ${tablePrefix}website_id = '${config.website.id}'\n`;

    // Process filters with consistent table references
    filters.forEach(filter => {
      if (filter.column.startsWith('param_')) {
        // Skip param_ filters here - they will be processed after the UNNEST join
        // because event_data is only available after LEFT JOIN UNNEST
        return;
      } else {
        if (filter.interactive === true && filter.metabaseParam === true && filter.value) {
          // Special handling for interactive filters - no quotes should be added
          if (filter.column === 'created_at') {
            sql += `  [[AND {{created_at}} ]]\n`;
          } else {
            // For all other interactive filters, use proper Metabase parameter syntax without quotes
            const tableName = isSessionColumn(filter.column) && needsSessionJoin ?
              fullSessionTable :
              fullWebsiteTable;

            // Extract the parameter name without {{ }}
            const paramName = filter.value.replace(/[{}]/g, '');

            // Add parameter without quotes
            sql += `  AND ${tableName}.${filter.column} = {{${paramName}}}\n`;
          }
        }
        else if (filter.operator === 'IN' && filter.multipleValues && filter.multipleValues.length > 0) {
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

          // Use the correct table reference for the column - full name for interactive mode
          if (hasInteractiveFilters) {
            const tableName = isSessionColumn(filter.column) && needsSessionJoin ? fullSessionTable : fullWebsiteTable;
            sql += `  AND ${tableName}.${filter.column} IN (${valueList})\n`;
          } else {
            const prefix = isSessionColumn(filter.column) && needsSessionJoin ? 's.' : 'e.';
            sql += `  AND ${prefix}${filter.column} IN (${valueList})\n`;
          }
        }
        else if (filter.operator === 'IS NULL' || filter.operator === 'IS NOT NULL') {
          if (hasInteractiveFilters) {
            const tableName = isSessionColumn(filter.column) && needsSessionJoin ? fullSessionTable : fullWebsiteTable;
            sql += `  AND ${tableName}.${filter.column} ${filter.operator}\n`;
          } else {
            const prefix = isSessionColumn(filter.column) && needsSessionJoin ? 's.' : 'e.';
            sql += `  AND ${prefix}${filter.column} ${filter.operator}\n`;
          }
        }
        else if (filter.value) {
          // Determine the correct table reference
          let tableRef;
          if (hasInteractiveFilters) {
            tableRef = isSessionColumn(filter.column) && needsSessionJoin ? `${fullSessionTable}.` : `${fullWebsiteTable}.`;
          } else {
            tableRef = isSessionColumn(filter.column) && needsSessionJoin ? 's.' : 'e.';
          }

          // Fix STARTS_WITH and ENDS_WITH operators to use LIKE with proper patterns
          if (filter.operator === 'STARTS_WITH') {
            // Convert STARTS_WITH to LIKE 'pattern%'
            sql += `  AND ${tableRef}${filter.column} LIKE '${filter.value.replace(/'/g, "''")}%'\n`;
          }
          else if (filter.operator === 'ENDS_WITH') {
            // Convert ENDS_WITH to LIKE '%pattern'
            sql += `  AND ${tableRef}${filter.column} LIKE '%${filter.value.replace(/'/g, "''")}'\n`;
          }
          else if ((filter.operator === 'LIKE' || filter.operator === 'NOT LIKE') &&
            !filter.value.includes('%')) {
            sql += `  AND ${tableRef}${filter.column} ${filter.operator} '%${filter.value.replace(/'/g, "''")}%'`;
          } else {
            // Detect Metabase parameter syntax: {{param}}
            const isMetabaseParam = filter.metabaseParam === true ||
              (typeof filter.value === 'string' &&
                /^\s*\{\{.*\}\}\s*$/.test(filter.value));

            const isTimestampFunction = typeof filter.value === 'string' &&
              filter.value.toUpperCase().includes('TIMESTAMP(') &&
              !filter.value.startsWith("'");

            if (isMetabaseParam) {
              // For Metabase parameters, add default values for specific columns
              if (filter.column === 'url_path') {
                sql += `  AND ${tableRef}${filter.column} = [[ ${filter.value.trim()} --]] '/'\n`;
              } else {
                // For other interactive filters, keep the original format
                sql += `  AND ${tableRef}${filter.column} ${filter.operator} ${filter.value.trim()}\n`;
              }
            } else {
              // For regular values, handle quoting as before
              const needsQuotes = !isTimestampFunction && (
                isNaN(Number(filter.value)) ||
                filter.column === 'event_name' ||
                filter.column === 'url_path' ||
                filter.column.includes('_path') ||
                filter.column.includes('_name')
              );

              const formattedValue = isTimestampFunction
                ? filter.value.replace(/^['"]|['"]$/g, '')
                : needsQuotes
                  ? `'${filter.value.replace(/'/g, "''")}'`
                  : filter.value;

              sql += `  AND ${tableRef}${filter.column} ${filter.operator} ${formattedValue}\n`;
            }
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
        sql += 'LEFT JOIN `team-researchops-prod-01d6.umami_views.event_data` AS ed_view\n';
        sql += '  ON base_query.event_id = ed_view.website_event_id\n';
        sql += '  AND base_query.website_id = ed_view.website_id\n';
        sql += '  AND base_query.created_at = ed_view.created_at\n';

        // OPTIMIZATION: Add explicit date filters for partition pruning on the joined table
        filters
          .filter(f => f.column === 'created_at' && (!f.interactive || !f.metabaseParam) && f.value)
          .forEach(f => {
            sql += `  AND ed_view.created_at ${f.operator} ${f.value}\n`;
          });

        sql += 'LEFT JOIN UNNEST(ed_view.event_parameters) AS event_data\n';

        // Add additional UNNEST joins for unique param aggregation BEFORE the WHERE clause
        if (config.paramAggregation === 'unique') {
          config.groupByFields.forEach(field => {
            if (field.startsWith('param_')) {
              const paramBase = field.replace('param_', '');
              const matchingParam = parameters.find(p => {
                const baseName = p.key.split('.').pop();
                return sanitizeColumnName(baseName!) === paramBase;
              });
              if (matchingParam && matchingParam.type === 'string') {
                sql += `LEFT JOIN UNNEST(ed_view.event_parameters) AS event_data_${paramBase}\n`;
                sql += `  ON SUBSTR(event_data_${paramBase}.data_key, INSTR(event_data_${paramBase}.data_key, '.') + 1) = '${paramBase}'\n`;
              }
            }
          });
        }

        // Add WHERE clause for param_ filters AFTER all JOINs
        const paramFilters = filters.filter(f => f.column.startsWith('param_'));
        if (paramFilters.length > 0) {
          paramFilters.forEach((filter, idx) => {
            const paramBase = filter.column.replace('param_', '');
            const matchingParams = parameters.filter(p => {
              const baseName = p.key.split('.').pop();
              return sanitizeColumnName(baseName!) === paramBase;
            });
            if (matchingParams.length > 0) {
              const param = matchingParams[0];
              const valueField = param.type === 'number' ? 'number_value' : 'string_value';
              // Use WHERE for first param filter, AND for subsequent ones
              const connector = idx === 0 ? 'WHERE' : '  AND';

              // Properly format the value (quote strings, escape single quotes)
              let formattedValue = filter.value;
              if (param.type === 'string' && filter.value) {
                // Escape single quotes and wrap in quotes
                formattedValue = `'${String(filter.value).replace(/'/g, "''")}'`;
              }

              sql += `${connector} event_data.data_key = '${paramBase}' AND event_data.${valueField} ${filter.operator} ${formattedValue}\n`;
            }
          });
        }
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

  /* const handleDateRangeChange = useCallback(() => {
    // ... removed ...
  }, [tempDateRangeInDays, maxDaysAvailable, config.website]); */

  const handleWebsiteChange = useCallback((website: Website | null) => {
    setConfig(prev => ({
      ...prev,
      website
    }));
    if (website && website.id !== config.website?.id) {
      setFilters([]);
      setAvailableEvents([]);
      setParameters([]);
      setDateRangeReady(false);
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
        // setTempDateRangeInDays(days);
      }
    }
  }, []);

  const handleEventsLoad = useCallback((events: string[], autoParameters?: { key: string; type: 'string' }[], maxDays?: number) => {
    setAvailableEvents(events);
    if (autoParameters) {
      setParameters(autoParameters);
    }
    if (maxDays !== undefined) {
      setMaxDaysAvailable(maxDays);
    }
    setDateRangeReady(true);
  }, []);

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
    <ChartLayout
      title="Grafbyggeren"
      description="Grafbyggeren lar deg skreddersy grafer og tabeller, som kan deles og legges til i Metabase."
      currentPage="grafbygger"
      wideSidebar={true}
      filters={
        <>
          <section>
            <WebsitePicker
              selectedWebsite={config.website}
              onWebsiteChange={handleWebsiteChange}
              onEventsLoad={handleEventsLoad}
              dateRangeInDays={dateRangeInDays}
              shouldReload={forceReload}
              // onIncludeParamsChange={setIncludeParams} - removed unused state
              resetIncludeParams={resetIncludeParams}
              requestIncludeParams={requestIncludeParams}
              disableAutoEvents={true}
              requestLoadEvents={requestLoadEvents}
              onLoadingChange={setIsEventsLoading}
            />
          </section>

          {config.website && dateRangeReady && (
            <>
              {/* Step 1: Explorer */}
              {/* <section className='-mb-3'>
                <div>
                   <div className="flex justify-between items-center bg-[var(--ax-bg-neutral-soft)] p-4 rounded-md">
                    <span>Vis hendelsesutforsker</span>
                     Switch would go here
                  </div>
                </div>
              </section> */}

              {/* Step 2: Metrics */}
              <section className="mt-4">
                <MetricSelector
                  ref={summarizeRef}
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
                  hideHeader={true}
                  availableEvents={availableEvents}
                  isEventsLoading={isEventsLoading}
                />
              </section>

              {/* Step 3: Event Filter Selection */}
              <section className="mt-4">
                <EventFilter
                  ref={chartFiltersRef}
                  filters={filters}
                  parameters={parameters}
                  setFilters={setFilters}
                  availableEvents={availableEvents}
                  maxDaysAvailable={maxDaysAvailable}
                  onEnableCustomEvents={(withParams = false) => {
                    // Always request to load events (at least names)
                    setRequestLoadEvents(true);

                    // If params also needed, request them
                    if (withParams) {
                      setRequestIncludeParams(true);
                    }
                  }}
                  hideHeader={true}
                  isEventsLoading={isEventsLoading}
                />
              </section>

              {/* Step 4: Display Options */}
              <section className="mt-4">
                <GroupingOptions
                  ref={displayOptionsRef}
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
                  filters={filters}
                  onEnableCustomEvents={() => {
                    if (chartFiltersRef.current) {
                      chartFiltersRef.current.enableCustomEvents();
                    }
                    // Also trigger the data fetch logic
                    setRequestLoadEvents(true);
                    setRequestIncludeParams(true);
                  }}
                  hideHeader={true}
                  isEventsLoading={isEventsLoading}
                />
              </section>
            </>
          )}


        </>
      }
    >
      {/* Alert Display */}
      {
        alertInfo.show && (
          <div className="mb-4">
            <AlertWithCloseButton variant="success">
              {alertInfo.message}
            </AlertWithCloseButton>
          </div>
        )
      }

      {/* Alert when pre-loaded from Dashboard */}
      {titleFromUrl && hasAppliedUrlParams && config.website && (
        <div className="mb-4">
          <AlertWithCloseButton variant="info">
            Forhåndsvisning fra dashboard: <strong>{titleFromUrl}</strong>. Du kan nå redigere og tilpasse grafen.
          </AlertWithCloseButton>
        </div>
      )}

      <div className="sticky top-6 max-h-[calc(100vh-4rem)] overflow-y-auto">
        <QueryPreview
          sql={generatedSQL}
          activeStep={currentStep}
          openFormprogress={false}
          filters={filters}
          metrics={config.metrics}
          groupByFields={config.groupByFields}
          onResetAll={resetAll}
          availableEvents={availableEvents}
          isEventsLoading={isEventsLoading}
          websiteId={config.website?.id}
        />
      </div>
    </ChartLayout >
  );
};

// Helper function to check if SQL is basic template
{/* 
const isBasicTemplate = (sql: string): boolean => {
  if (!sql) return true;
  const selectPattern = /SELECT\s+(\s*FROM|\s*$)/i;
  return selectPattern.test(sql);
};*/}

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
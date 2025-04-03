import { useState, useEffect, useCallback } from 'react';
import { Heading, VStack } from '@navikt/ds-react';
import Kontaktboks from '../components/kontaktboks';
import WebsitePicker from '../components/WebsitePicker';
import SQLPreview from '../components/chartbuilder/sqlpreview';
import ChartFilters from '../components/chartbuilder/ChartFilters';
import Summarize from '../components/chartbuilder/Summarize';
import EventParameterSelector from '../components/chartbuilder/EventParameterSelector';
import { FILTER_COLUMNS } from '../lib/constants';
import { 
  Parameter, 
  Metric, 
  DateFormat, 
  MetricOption,
  ColumnOption,
  ChartConfig,
  Filter,
  Website // Add the missing Website type
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
  { label: 'Andel av totalen (%)', value: 'andel' }
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

  // Fix dependency in useEffect by adding config as a stable reference
  const debouncedConfig = useDebounce(config, 500);

  useEffect(() => {
    if (debouncedConfig.website) {
      generateSQL();
    }
  }, [debouncedConfig, filters, parameters]);

  // Add state to track the current step
  const [currentStep, setCurrentStep] = useState<number>(1);
  
  // Create a function to calculate the current step based on selections
  const calculateCurrentStep = useCallback(() => {
    if (!config.website) {
      return 1; // Step 1: Choose website
    }
    
    if (filters.length === 0 && config.metrics.length === 0 && config.groupByFields.length === 0) {
      return 2; // Step 2: Apply filters
    }
    
    if (config.metrics.length === 0 && config.groupByFields.length === 0) {
      return 3; // Step 3: Add metrics/groupings
    }
    
    return 4; // Step 4: Insert in Metabase
  }, [config.website, filters.length, config.metrics.length, config.groupByFields.length]);
  
  // Update the step whenever relevant data changes
  useEffect(() => {
    setCurrentStep(calculateCurrentStep());
  }, [calculateCurrentStep]);

  // Add state to manage FormProgress open state
  const [formProgressOpen, setFormProgressOpen] = useState<boolean>(true);
  
  // Create a handler for FormProgress open state changes
  const handleFormProgressOpenChange = (open: boolean) => {
    setFormProgressOpen(open);
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

  // Add move metric function
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

  // Add move group field function
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

  // Helper function to get date filter conditions for the total count query
  const getDateFilterConditions = useCallback((): string => {
    // Extract just the date-related filters
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

  // Helper function to generate the actual SQL
  const getMetricSQLByType = useCallback((func: string, column?: string, alias: string = 'metric', metric?: Metric): string => {
    // Ensure the alias is properly quoted with backticks for BigQuery
    const quotedAlias = `\`${alias}\``;
    
    // Get website ID with a check to ensure it's not undefined
    const websiteId = config.website?.id || '';
    
    // Special handling for count_where
    if (func === 'count_where' && metric) {
      const whereColumn = metric.whereColumn || 'event_name';
      const whereOperator = metric.whereOperator || '=';
      
      // Handle different operator types
      if (['IN', 'NOT IN'].includes(whereOperator) && metric.whereMultipleValues && metric.whereMultipleValues.length > 0) {
        const valueList = metric.whereMultipleValues
          .map(val => {
            // Determine if we should quote the value based on column and value type
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
        // Determine if we should quote the value based on column and value type
        const needsQuotes = isNaN(Number(metric.whereValue)) || whereColumn === 'event_name' || whereColumn === 'url_path';
        const formattedValue = needsQuotes ? `'${metric.whereValue.replace(/'/g, "''")}'` : metric.whereValue;
        
        return `COUNT(CASE WHEN base_query.${whereColumn} ${whereOperator} ${formattedValue} THEN 1 ELSE NULL END) as ${quotedAlias}`;
      }
      
      // Fallback to regular count if no conditions specified
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
          // Use window function for more accurate percentages
          return `ROUND(
            100.0 * COUNT(*) / (
              SUM(COUNT(*)) OVER()
            )
          , 1) as ${quotedAlias}`;
        case 'andel':
          // For parameter-based andel, calculate percentage against total
          return `ROUND(
            100.0 * COUNT(*) / (
              SELECT COUNT(*) FROM base_query
            )
          , 1) as ${quotedAlias}`;
        default:
          return `COUNT(*) as ${quotedAlias}`;
      }
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
          return `AVG(NULLIF(base_query.visit_duration, 0)) as ${quotedAlias}`;
        }
        return column ? `AVG(${column}) as ${quotedAlias}` : `COUNT(*) as ${quotedAlias}`;
      case 'min':
        return column ? `MIN(${column}) as ${quotedAlias}` : `COUNT(*) as ${quotedAlias}`;
      case 'max':
        return column ? `MAX(${column}) as ${quotedAlias}` : `COUNT(*) as ${quotedAlias}`;
      case 'percentage':
        if (column) {
          // Special case for the "Rader" (all rows percentage)
          // This is a special key, not an actual column name
          if (column === 'alle_rader_prosent') {
            return `ROUND(
              100.0 * COUNT(*) / (
                SUM(COUNT(*)) OVER()
              )
            , 1) as ${quotedAlias}`;
          }
          
          // For specific columns (session_id, visit_id, event_id), use COUNT(DISTINCT)
          // This ensures we're calculating percentages based on unique entities
          return `ROUND(
            100.0 * COUNT(DISTINCT base_query.${column}) / (
              SUM(COUNT(DISTINCT base_query.${column})) OVER()
            )
          , 1) as ${quotedAlias}`;
        }
        // Default percentage calculation if no column specified
        return `ROUND(
          100.0 * COUNT(*) / (
            SUM(COUNT(*)) OVER()
          )
        , 1) as ${quotedAlias}`;
      case 'andel':
        if (column && websiteId) {
          // Check if an interactive date filter exists
          const hasInteractiveDateFilter = filters.some(f => 
            f.column === 'created_at' && f.interactive === true && f.metabaseParam === true
          );
          
          // Now use the websiteId variable which we've ensured is not empty
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
        
        // If we don't have a valid website ID or column, return a default message
        return `COUNT(*) as ${quotedAlias} /* Andel calculation skipped */`;
      
      default:
        return `COUNT(*) as ${quotedAlias}`;
    }
  }, [config.website?.id, getDateFilterConditions]);

  // IMPORTANT: Move this function before generateSQLCore to fix the reference error
  // Update the getMetricSQL function to handle aliases and indices
  const getMetricSQL = useCallback((metric: Metric, index: number): string => {
    // If user has set a custom alias, always use that first, regardless of metric type
    if (metric.alias) {
      return getMetricSQLByType(metric.function, metric.column, metric.alias, metric);
    }
    
    // Always use metrikk_N format for consistency with all metric types
    // This change ensures all metrics, including percentage metrics, use the same naming pattern
    const defaultAlias = `metrikk_${index + 1}`;
    return getMetricSQLByType(metric.function, metric.column, defaultAlias, metric);
  }, [getMetricSQLByType, config.metrics]);

  // Update the SQL generation to handle different operator types
  const generateSQLCore = useCallback((
    config: ChartConfig,
    filters: Filter[],
    parameters: Parameter[]
  ): string => {
    if (!config.website) return '';

    // Check if interactive date mode is enabled
    const hasInteractiveDateFilter = filters.some(f => 
      f.column === 'created_at' && f.interactive === true && f.metabaseParam === true
    );
    
    // Get fully qualified table names
    const fullWebsiteTable = '`team-researchops-prod-01d6.umami.public_website_event`';
    const fullSessionTable = '`team-researchops-prod-01d6.umami.public_session`';
    
    // Define table alias usage based on interactive date mode
    const tablePrefix = hasInteractiveDateFilter ? 
      `${fullWebsiteTable}.` : // Use full table name for interactive mode
      'e.'; // Use alias for normal mode
    
    const sessionTablePrefix = hasInteractiveDateFilter ?
      `${fullSessionTable}.` :
      's.';

    // Updated to pass parameters to the function
    const requiredTables = getRequiredTables(config, filters);
    
    // Check which derived columns are actually needed
    const needsUrlFullpath = filters.some(f => f.column === 'url_fullpath') || 
                            config.groupByFields.includes('url_fullpath');
    
    const needsUrlFullUrl = filters.some(f => f.column === 'url_fullurl') || 
                           config.groupByFields.includes('url_fullurl');
    
    const needsReferrerFullpath = filters.some(f => f.column === 'referrer_fullpath') || 
                                 config.groupByFields.includes('referrer_fullpath');
    
    const needsReferrerFullUrl = filters.some(f => f.column === 'referrer_fullurl') || 
                                config.groupByFields.includes('referrer_fullurl');
    
    // IMPORTANT: Only filter out param_ filters, not all filters!
    const eventFilters = filters.filter(filter => 
      !filter.column.startsWith('param_')
    );

    // Check if we need visit_duration field for any metrics
    const needsVisitDuration = config.metrics.some(m => m.column === 'visit_duration') || 
                              config.groupByFields.includes('visit_duration');

    // Start building the SQL with a CTE (Common Table Expression)
    let sql = '';
    
    // Add visit_duration calculation first if needed
    if (needsVisitDuration) {
      sql += 'WITH visit_durations AS (\n';
      sql += '  SELECT\n';
      sql += '    visit_id,\n';
      sql += '    CAST(TIMESTAMP_DIFF(MAX(created_at), MIN(created_at), SECOND) AS INT64) AS duration\n';
      sql += '  FROM `team-researchops-prod-01d6.umami.public_website_event`\n';
      sql += `  WHERE website_id = '${config.website.id}'\n`;
      sql += '  GROUP BY visit_id\n';
      sql += '  HAVING COUNT(*) > 1\n';
      sql += '),\n';
      
      // Continue with the regular base_query
      sql += 'base_query AS (\n';
      sql += '  SELECT\n';
      
      if (hasInteractiveDateFilter) {
        sql += `    ${fullWebsiteTable}.*,\n`;
        sql += '    COALESCE(vd.duration, 0) as visit_duration\n';
      } else {
        sql += '    e.*,\n';
        sql += '    COALESCE(vd.duration, 0) as visit_duration\n';
      }

      // Continue with session columns if needed
      if (requiredTables.session) {
        if (hasInteractiveDateFilter) {
          sql += `    ${fullSessionTable}.browser,\n`;
          sql += `    ${fullSessionTable}.os,\n`;
          sql += `    ${fullSessionTable}.device,\n`;
          sql += `    ${fullSessionTable}.screen,\n`;
          sql += `    ${fullSessionTable}.language,\n`;
          sql += `    ${fullSessionTable}.country,\n`;
          sql += `    ${fullSessionTable}.subdivision1,\n`;
          sql += `    ${fullSessionTable}.city\n`;
        } else {
          sql += '    s.browser,\n';
          sql += '    s.os,\n';
          sql += '    s.device,\n';
          sql += '    s.screen,\n';
          sql += '    s.language,\n';
          sql += '    s.country,\n';
          sql += '    s.subdivision1,\n';
          sql += '    s.city\n';
        }
      }

      // FROM and JOIN clauses - adapted for visit_duration
      if (hasInteractiveDateFilter) {
        sql += `  FROM ${fullWebsiteTable}\n`;
        sql += '  LEFT JOIN visit_durations vd\n';
        sql += `    ON ${fullWebsiteTable}.visit_id = vd.visit_id\n`;
        
        if (requiredTables.session) {
          sql += `  LEFT JOIN ${fullSessionTable}\n`;
          sql += `    ON ${fullWebsiteTable}.session_id = ${fullSessionTable}.session_id\n`;
        }
      } else {
        sql += `  FROM ${fullWebsiteTable} e\n`;
        sql += '  LEFT JOIN visit_durations vd\n';
        sql += '    ON e.visit_id = vd.visit_id\n';
        
        if (requiredTables.session) {
          sql += `  LEFT JOIN ${fullSessionTable} s\n`;
          sql += '    ON e.session_id = s.session_id\n';
        }
      }
    } else {
      // Original CTE definition without visit_duration
      sql += 'WITH base_query AS (\n';
      sql += '  SELECT\n';
      
      if (hasInteractiveDateFilter) {
        sql += `    ${fullWebsiteTable}.*`;
      } else {
        sql += '    e.*';
      }
      
      // Only add derived columns if they're needed
      let addedDerivedColumns = false;
      
      if (needsUrlFullpath) {
        sql += ',\n';
        if (hasInteractiveDateFilter) {
          sql += `    CONCAT(IFNULL(${fullWebsiteTable}.url_path, ''), IFNULL(${fullWebsiteTable}.url_query, '')) as url_fullpath`;
        } else {
          sql += "    CONCAT(IFNULL(e.url_path, ''), IFNULL(e.url_query, '')) as url_fullpath";
        }
        addedDerivedColumns = true;
      }
      
      // ...existing code for other derived columns...
      
      // FROM and JOIN clauses for non-visit_duration case
      if (hasInteractiveDateFilter) {
        sql += `  FROM ${fullWebsiteTable}\n`;
        
        if (requiredTables.session) {
          sql += `  LEFT JOIN ${fullSessionTable}\n`;
          sql += `    ON ${fullWebsiteTable}.session_id = ${fullSessionTable}.session_id\n`;
        }
      } else {
        sql += `  FROM ${fullWebsiteTable} e\n`;
        
        if (requiredTables.session) {
          sql += `  LEFT JOIN ${fullSessionTable} s\n`;
          sql += '    ON e.session_id = s.session_id\n';
        }
      }
    }

    // Add the WHERE clause for the base_query CTE
    sql += `  WHERE ${tablePrefix}website_id = '${config.website.id}'\n`;
    
    // Process ALL filters, not just event filters
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
        // Fix handling of IN operators with multiple values
        if (filter.operator === 'IN' && filter.multipleValues && filter.multipleValues.length > 0) {
          const valueList = filter.multipleValues
            .map(val => {
              // Determine if we should quote the value based on column and value type
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
        // Handle special operators that don't need values
        else if (filter.operator === 'IS NULL' || filter.operator === 'IS NOT NULL') {
          sql += `  AND ${tablePrefix}${filter.column} ${filter.operator}\n`;
        }
        // Handle other operators (LIKE, =, !=, etc.)
        else if (filter.value) {
          // For LIKE operators, we need to wrap the value with % if not already present
          if ((filter.operator === 'LIKE' || filter.operator === 'NOT LIKE') && 
              !filter.value.includes('%')) {
            sql += `  AND ${tablePrefix}${filter.column} ${filter.operator} '%${filter.value.replace(/'/g, "''")}%'\n`;
          } else {
            // Special handling for date/timestamp values - check if it's a TIMESTAMP function
            const isTimestampFunction = typeof filter.value === 'string' && 
                                       filter.value.toUpperCase().includes('TIMESTAMP(') &&
                                       !filter.value.startsWith("'");
            
            // For normal value operators
            const needsQuotes = !isTimestampFunction && (
              isNaN(Number(filter.value)) || 
              filter.column === 'event_name' || 
              filter.column === 'url_path' ||
              filter.column.includes('_path') ||
              filter.column.includes('_name')
            );
            
            // Important: Do not add quotes to TIMESTAMP function calls
            const formattedValue = isTimestampFunction 
              ? filter.value.replace(/^['"]|['"]$/g, '') // Remove any quotes at the beginning or end
              : needsQuotes 
                ? `'${filter.value.replace(/'/g, "''")}'` 
                : filter.value;
            
            sql += `  AND ${tablePrefix}${filter.column} ${filter.operator} ${formattedValue}\n`;
          }
        }
        // Skip filters with no value (except IS NULL/IS NOT NULL which were handled above)
        else if (filter.operator !== 'IS NULL' && filter.operator !== 'IS NOT NULL') {
          console.warn(`Skipping filter with no value: ${filter.column} ${filter.operator}`);
        }
      }
    });

    // Close the base_query CTE - IMPORTANT to add this closing parenthesis
    sql += ')\n\n';
    
    // Now build the main query - separate from the CTE
    sql += 'SELECT\n';
    const selectClauses = new Set<string>();

    // First add group by fields
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
        // Check if we have a custom column filter for visit_duration buckets
        const visitDurationBucketFilter = filters.find(f => 
          f.column === 'custom_column' && 
          f.customColumn && 
          f.customColumn.includes('visit_duration') && 
          f.customColumn.includes('CASE')
        );
        
        if (visitDurationBucketFilter && visitDurationBucketFilter.customColumn) {
          // Use the CASE statement from the filter
          selectClauses.add(`${visitDurationBucketFilter.customColumn} AS visit_duration_bucket`);
        } else {
          // Use the actual visit_duration value
          selectClauses.add(`base_query.visit_duration AS visit_duration`);
        }
      } else {
        // For session fields, use base_query directly since we join in the CTE
        selectClauses.add(`base_query.${field}`);
      }
    });

    // Then add metrics
    config.metrics.forEach((metric, index) => {
      selectClauses.add(getMetricSQL(metric, index));
    });

    // Add the SELECT clauses
    sql += '  ' + Array.from(selectClauses).join(',\n  ');

    // Add FROM clause - this should be outside the CTE
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
          // Check if we have a custom column filter for visit_duration buckets
          const visitDurationBucketFilter = filters.find(f => 
            f.column === 'custom_column' && 
            f.customColumn && 
            f.customColumn.includes('visit_duration') && 
            f.customColumn.includes('CASE')
          );
          
          if (visitDurationBucketFilter) {
            // Group by the bucketed value
            groupByCols.push('visit_duration_bucket');
          } else {
            // Group by the actual duration
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
      const metricWithAlias = config.metrics.find(m => m.alias === config.orderBy?.column);
      let finalColumn = config.orderBy.column;
      if (config.orderBy.column === 'andel' && !metricWithAlias) {
        const percentageMetrics = config.metrics.filter(m => 
          m.function === 'percentage' && !m.alias
        );
        if (percentageMetrics.length === 1) {
          finalColumn = 'andel';
        }
      }
      const orderColumn = config.orderBy.column === 'created_at' 
        ? 'dato' 
        : metricWithAlias 
          ? `\`${config.orderBy.column}\`` 
          : config.orderBy.column.startsWith('metrikk_') || 
            config.orderBy.column.startsWith('andel') || 
            config.orderBy.column.includes('`')
            ? `\`${config.orderBy.column.replace(/`/g, '')}\`` 
            : config.orderBy.column;
      const columnExists = config.groupByFields.some(field => 
        (field === 'created_at' && config.orderBy?.column === 'dato') ||
        field === config.orderBy?.column
      ) || config.metrics.some((m, i) => 
        m.alias === config.orderBy?.column || 
        `metrikk_${i + 1}` === config.orderBy?.column ||
        (m.function === 'percentage' && (
          config.orderBy?.column === 'andel' ||
          config.orderBy?.column === `andel_${i + 1}`
        ))
      );
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
        const firstMetricAlias = config.metrics[0].alias || 'metrikk_1';
        sql += `ORDER BY \`${firstMetricAlias}\` ${config.orderBy?.direction || 'DESC'}\n`;
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
    let finalColumn = column;
    if (column === 'andel' && !metricWithAlias) {
      const percentageMetrics = config.metrics.filter(m => 
        m.function === 'percentage' && !m.alias
      );
      if (percentageMetrics.length === 1) {
        finalColumn = 'andel';
      }
    }
    setConfig(prev => ({
      ...prev,
      orderBy: { 
        column: finalColumn, 
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

  const setLimit = (limit: number | null) => {
    setConfig(prev => ({
      ...prev,
      limit
    }));
  };

  return (
    <div className="w-full max-w-[1600px]">
      <Heading spacing level="1" size="medium" className="pt-12 pb-4">
        Lag grafer og tabeller for Metabase
      </Heading>
      <p className="text-gray-600 mb-10 prose text-lg">
        Gode beslutninger starter med innsikt. Med grafbyggeren lager du grafer og tabeller basert på data fra Umami, klare til å presenteres i Metabase.
      </p>

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
                <section className="mt-4">
                  <Heading level="2" size="small" spacing>
                    Utforsk
                  </Heading>
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

                <section className="mt-4">
                  <ChartFilters
                    filters={filters}
                    parameters={parameters}
                    setFilters={setFilters}
                    availableEvents={availableEvents}
                    maxDaysAvailable={maxDaysAvailable}
                  />
                </section>

                <section className="mt-4">
                  <Summarize
                    metrics={config.metrics}
                    groupByFields={config.groupByFields}
                    parameters={parameters}
                    dateFormat={config.dateFormat}
                    orderBy={config.orderBy}
                    paramAggregation={config.paramAggregation}
                    limit={config.limit}
                    METRICS={METRICS}
                    DATE_FORMATS={DATE_FORMATS}
                    COLUMN_GROUPS={FILTER_COLUMNS}
                    getMetricColumns={getMetricColumns}
                    sanitizeColumnName={sanitizeColumnName}
                    updateMetric={(index, updates) => updateMetric(index, updates)}
                    removeMetric={removeMetric}
                    addMetric={addMetric}
                    addGroupByField={addGroupByField}
                    removeGroupByField={removeGroupByField}
                    moveGroupField={moveGroupField}
                    moveMetric={moveMetric}
                    setOrderBy={setOrderBy}
                    clearOrderBy={clearOrderBy}
                    setParamAggregation={setParamAggregation}
                    setLimit={setLimit}
                    setDateFormat={(format) => setConfig(prev => ({
                      ...prev,
                      dateFormat: format as DateFormat['value']
                    }))}
                    availableEvents={availableEvents}
                    filters={filters} // Add this prop
                    setFilters={setFilters} // Add this prop
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
            />
          </div>
        </div>

        <div className="order-3 lg:hidden">
          <Kontaktboks />
        </div>
      </div>
      {currentStep == 4 && (
      <CopyButton 
        textToCopy={generatedSQL} 
        visible={!!generatedSQL && generatedSQL !== '-- Please select a website to generate SQL'}
      />
      )}
    </div>
  );
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
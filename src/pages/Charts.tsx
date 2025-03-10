import { useState, useEffect, useCallback } from 'react';
import { Heading, VStack } from '@navikt/ds-react';
import Kontaktboks from '../components/kontaktboks';
import WebsitePicker from '../components/WebsitePicker';
import SQLPreview from '../components/sqlpreview';
import ChartFilters from '../components/ChartFilters';
import Summarize from '../components/Summarize';
import EventParameterSelector from '../components/EventParameterSelector';
import AdvancedOptions from '../components/AdvancedOptions';
import { 
  Parameter, 
  Metric, 
  DateFormat, 
  ColumnGroup,
  MetricOption,
  ColumnOption,
  ChartConfig,
  Filter,
  DynamicFilterOption
} from '../types/chart';

// Update your constants to use the new types
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
  { label: 'Sum av verdier', value: 'sum' },
  { label: 'Gjennomsnitt', value: 'average' },
  { label: 'Median', value: 'median' },
];

const COLUMN_GROUPS: Record<string, ColumnGroup> = {
  eventBasics: {
    label: 'Basisdetaljer',
    table: 'base_query',
    columns: [
      { label: 'Event ID', value: 'event_id' },
      { label: 'Created At', value: 'created_at' },
      { label: 'Event Type', value: 'event_type' },
      { label: 'Event Name', value: 'event_name' },
      { label: 'Website ID', value: 'website_id' },
      { label: 'Website Domain', value: 'website_domain' },
      { label: 'Website Name', value: 'website_name' }
    ]
  },
  pageDetails: {
    label: 'Hendelsesdetaljer',
    table: 'base_query',
    columns: [
      { label: 'Page Title', value: 'page_title' },
      { label: 'URL Path', value: 'url_path' },
      { label: 'URL Query', value: 'url_query' },
      { label: 'URL Full Path', value: 'url_fullpath' },
      { label: 'URL Full URL', value: 'url_fullurl' },
      { label: 'Referrer Domain', value: 'referrer_domain' },
      { label: 'Referrer Path', value: 'referrer_path' },
      { label: 'Referrer Query', value: 'referrer_query' },
      { label: 'Referrer Full Path', value: 'referrer_fullpath' },
      { label: 'Referrer Full URL', value: 'referrer_fullurl' }
    ]
  },
  visitorDetails: {
    label: 'Brukerdetaljer',
    table: 'session',
    columns: [
      { label: 'Visit ID', value: 'visit_id' },
      { label: 'Session ID', value: 'session_id' },
      { label: 'Browser', value: 'browser' },
      { label: 'OS', value: 'os' },
      { label: 'Device', value: 'device' },
      { label: 'Screen', value: 'screen' },
      { label: 'Language', value: 'language' },
      { label: 'Country', value: 'country' },
      { label: 'Region', value: 'subdivision1' },
      { label: 'City', value: 'city' }
    ]
  }
};

const DYNAMIC_FILTER_OPTIONS: DynamicFilterOption[] = [
  // ...existing code...
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
      { label: 'Event ID', value: 'event_id' },
      { label: 'Session ID', value: 'session_id' },
      { label: 'Visit ID', value: 'visit_id' },
      { label: 'Browser', value: 'browser' },
      { label: 'URL Path', value: 'url_path' },
      // Add more columns from COLUMN_GROUPS
      ...Object.values(COLUMN_GROUPS).flatMap(group => group.columns)
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

const ChartsPage = () => {
  const [config, setConfig] = useState<ChartConfig>({
    website: null,
    filters: [],
    metrics: [{ function: 'count' }],
    groupByFields: [],
    orderBy: null,
    dateFormat: 'day' // Default to daily grouping
  });
  const [generatedSQL, setGeneratedSQL] = useState<string>('');
  const [filters, setFilters] = useState<Filter[]>([]);
  const [dynamicFilters, setDynamicFilters] = useState<string[]>([]);
  const [parameters, setParameters] = useState<Parameter[]>([]);
  const [availableEvents, setAvailableEvents] = useState<string[]>([]);
  const [dateRangeInDays, setDateRangeInDays] = useState<number>(3);
  const [tempDateRangeInDays, setTempDateRangeInDays] = useState<number>(3);
  const [maxDaysAvailable, setMaxDaysAvailable] = useState<number>(0);
  const [dateRangeReady, setDateRangeReady] = useState<boolean>(false);

  // Fix dependency in useEffect by adding config as a stable reference
  const debouncedConfig = useDebounce(config, 500);

  useEffect(() => {
    if (debouncedConfig.website) {
      generateSQL();
    }
  }, [debouncedConfig, dynamicFilters, filters, parameters]); // Add generateSQL to deps

  // Add helper functions for metrics
  const addMetric = () => {
    setConfig(prev => ({
      ...prev,
      metrics: [...prev.metrics, { function: 'count' }]
    }));
  };

  const removeMetric = (index: number) => {
    setConfig(prev => ({
      ...prev,
      metrics: prev.metrics.filter((_, i) => i !== index)
    }));
  };

  const updateMetric = (index: number, updates: Partial<Metric>) => {
    setConfig((prev: ChartConfig) => ({
      ...prev,
      metrics: prev.metrics.map((metric: Metric, i: number): Metric => 
        i === index ? { ...metric, ...updates } : metric
      )
    }));
  };

  // Add helper functions for group by fields
  const addGroupByField = (field: string) => {
    if (!config.groupByFields.includes(field)) {
      setConfig(prev => ({
        ...prev,
        groupByFields: [...prev.groupByFields, field]
      }));
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

  // Update the SQL generation
  const generateSQLCore = useCallback((
    config: ChartConfig,
    filters: Filter[],
    dynamicFilters: string[],
    parameters: Parameter[]
  ): string => {
    if (!config.website) return '';

    const requiredTables = getRequiredTables();
    
    // Declare whereClauseFragments at the top
    const whereClauseFragments: string[] = [];
    dynamicFilters.forEach(filterValue => {
      const filter = DYNAMIC_FILTER_OPTIONS.find(f => f.value === filterValue);
      if (filter) {
        const template = filter.template.replace(/\[\[AND /, '').replace(/\]\]/, '');
        whereClauseFragments.push(template);
      }
    });

    // Start building the SQL with a CTE (Common Table Expression)
    let sql = 'WITH base_query AS (\n';
    sql += '  SELECT\n';
    sql += '    e.*,\n';
    
    // Add computed columns
    sql += `    '${config.website.domain}' as website_domain,\n`;
    sql += `    '${config.website.name}' as website_name,\n`;
    sql += '    -- URL path calculations\n';
    sql += '    CONCAT(\n';
    sql += '      e.url_path,\n';
    sql += '      CASE\n';
    sql += '        WHEN e.url_query IS NOT NULL AND e.url_query != \'\'\n';
    sql += '        THEN CONCAT(\'?\', e.url_query)\n';
    sql += '        ELSE \'\'\n';
    sql += '      END\n';
    sql += '    ) AS url_fullpath,\n';
    sql += '    CONCAT(\n';
    sql += `      'https://${config.website.domain}',\n`;
    sql += '      e.url_path,\n';
    sql += '      CASE\n';
    sql += '        WHEN e.url_query IS NOT NULL AND e.url_query != \'\'\n';
    sql += '        THEN CONCAT(\'?\', e.url_query)\n';
    sql += '        ELSE \'\'\n';
    sql += '      END\n';
    sql += '    ) AS url_fullurl,\n';
    
    // Referrer calculations
    sql += '    CONCAT(\n';
    sql += '      e.referrer_path,\n';
    sql += '      CASE\n';
    sql += '        WHEN e.referrer_query IS NOT NULL AND e.referrer_query != \'\'\n';
    sql += '        THEN CONCAT(\'?\', e.referrer_query)\n';
    sql += '        ELSE \'\'\n';
    sql += '      END\n';
    sql += '    ) AS referrer_fullpath,\n';
    sql += '    CASE\n';
    sql += '      WHEN e.referrer_domain IS NOT NULL AND e.referrer_domain != \'\'\n';
    sql += '      THEN CONCAT(\n';
    sql += '        \'https://\',\n';
    sql += '        e.referrer_domain,\n';
    sql += '        e.referrer_path,\n';
    sql += '        CASE\n';
    sql += '          WHEN e.referrer_query IS NOT NULL AND e.referrer_query != \'\'\n';
    sql += '          THEN CONCAT(\'?\', e.referrer_query)\n';
    sql += '          ELSE \'\'\n';
    sql += '        END\n';
    sql += '      )\n';
    sql += '      ELSE NULL\n';
    sql += '    END AS referrer_fullurl';

    // Add session columns if needed
    if (requiredTables.session) {
      sql += ',\n    s.browser,\n';
      sql += '    s.os,\n';
      sql += '    s.device,\n';
      sql += '    s.screen,\n';
      sql += '    s.language,\n';
      sql += '    s.country,\n';
      sql += '    s.subdivision1,\n';
      sql += '    s.city\n';
    }
    
    // FROM and JOIN clauses
    sql += '  FROM `team-researchops-prod-01d6.umami.public_website_event` e\n';
    
    if (requiredTables.session) {
      sql += '  LEFT JOIN `team-researchops-prod-01d6.umami.public_session` s\n';
      sql += '    ON e.session_id = s.session_id\n';
    }
    
    // WHERE clause
    sql += `  WHERE e.website_id = '${config.website.id}'\n`;
    
    // Add static filters to the CTE
    filters.forEach(filter => {
      if (filter.column.startsWith('param_')) {
        // Instead of skipping parameter filters, we need to handle them differently
        // Parameter filters need to be applied in the main query with special JOIN conditions
        const paramName = filter.column.replace('param_', '');
        const param = parameters.find(p => sanitizeColumnName(p.key) === paramName);
        
        if (param) {
          // Add note that this filter will be applied in the main query
          sql += `  /* Parameter filter for ${param.key} will be applied in main query */\n`;
        }
      } else if (filter.operator === 'IS NULL' || filter.operator === 'IS NOT NULL') {
        // Handle custom parameters
        if (filter.column.startsWith('param_')) {
          sql += `  AND ${filter.column} ${filter.operator}\n`;
        } else {
          sql += `  AND e.${filter.column === 'custom_column' ? filter.customColumn : filter.column} ${filter.operator}\n`;
        }
      } else if (filter.value) {
        if (filter.column.startsWith('param_')) {
          // Handle parameter filtering
          sql += `  AND ${filter.column} ${filter.operator} '${filter.value}'\n`;
        } else if (filter.column === 'custom_column') {
          // Handle custom column name
          sql += `  AND e.${filter.customColumn} ${filter.operator} '${filter.value}'\n`;
        } else if (filter.column === 'event_type') {
          // Handle event_type as integer
          sql += `  AND e.${filter.column} ${filter.operator} ${filter.value}\n`;
        } else if (filter.operator === 'LIKE' || filter.operator === 'NOT LIKE') {
          sql += `  AND e.${filter.column} ${filter.operator} '%${filter.value}%'\n`;
        } else if (filter.operator === 'STARTS_WITH') {
          sql += `  AND e.${filter.column} LIKE '${filter.value}%'\n`;
        } else if (filter.operator === 'ENDS_WITH') {
          sql += `  AND e.${filter.column} LIKE '%${filter.value}'\n`;
        } else {
          sql += `  AND e.${filter.column} ${filter.operator} '${filter.value}'\n`;
        }
      }
    });
    
    sql += ')\n\n';
    
    // Now build the main query
    sql += 'SELECT\n';
    const selectClauses = new Set<string>();

    // First add group by fields
    config.groupByFields.forEach(field => {
      if (field === 'created_at') {
        const format = DATE_FORMATS.find(f => f.value === config.dateFormat)?.format || '%Y-%m-%d';
        selectClauses.add(`FORMAT_TIMESTAMP('${format}', base_query.created_at) AS dato`);
      } else if (field.startsWith('param_')) {
        // Get the base parameter name without the param_ prefix
        const paramBase = field.replace('param_', '');
        
        // Find matching parameters by their base name
        const matchingParams = parameters.filter(p => {
          const baseName = p.key.split('.').pop();
          return sanitizeColumnName(baseName!) === paramBase;
        });
        
        if (matchingParams.length > 0) {
          // Use the first matching parameter's type for the value field
          const valueField = matchingParams[0].type === 'number' ? 'number_value' : 'string_value';
          
          // Use SUBSTR and INSTR to extract the parameter name
          selectClauses.add(
            `MAX(CASE 
                WHEN SUBSTR(event_data.data_key, INSTR(event_data.data_key, '.') + 1) = '${paramBase}' THEN event_data.${valueField}
                ELSE NULL
              END) AS ${field}`
          );
        }
      } else {
        const tablePrefix = 'base_query';
        selectClauses.add(`${tablePrefix}.${field}`);
      }
    });

    // Then add metrics
    config.metrics.forEach((metric, index) => {
      selectClauses.add(getMetricSQL(metric, index));
    });

    sql += '  ' + Array.from(selectClauses).join(',\n  ');

    // Add FROM clause
    sql += '\nFROM base_query\n';

    // Add JOIN to event_data table if there are parameters
    if (parameters.length > 0) {
      sql += 'LEFT JOIN `team-researchops-prod-01d6.umami.public_event_data` AS event_data\n';
      sql += '  ON base_query.event_id = event_data.website_event_id\n';
      
      // Get parameter filters
      const paramFilters = filters.filter(filter => filter.column.startsWith('param_'));
      
      // Add WHERE clause for parameter filters and dynamic filters
      const whereConditions = [...whereClauseFragments];
      
      // Add parameter filter conditions
      paramFilters.forEach(filter => {
        const paramName = filter.column.replace('param_', '');
        // Find matching parameter by base name (after the dot)
        const param = parameters.find(p => {
          const baseName = p.key.split('.').pop();
          return sanitizeColumnName(baseName!) === paramName;
        });
        
        if (param) {
          if (filter.operator === 'IS NULL') {
            whereConditions.push(`NOT EXISTS (
              SELECT 1 FROM \`team-researchops-prod-01d6.umami.public_event_data\` param_filter
              WHERE param_filter.website_event_id = base_query.event_id
                AND SUBSTR(param_filter.data_key, INSTR(param_filter.data_key, '.') + 1) = '${paramName}'
            )`);
          } else if (filter.operator === 'IS NOT NULL') {
            whereConditions.push(`EXISTS (
              SELECT 1 FROM \`team-researchops-prod-01d6.umami.public_event_data\` param_filter
              WHERE param_filter.website_event_id = base_query.event_id
                AND SUBSTR(param_filter.data_key, INSTR(param_filter.data_key, '.') + 1) = '${paramName}'
            )`);
          } else {
            const valueField = param.type === 'number' ? 'number_value' : 'string_value';
            const valuePrefix = param.type === 'number' ? '' : "'";
            const valueSuffix = param.type === 'number' ? '' : "'";
            
            whereConditions.push(`EXISTS (
              SELECT 1 FROM \`team-researchops-prod-01d6.umami.public_event_data\` param_filter
              WHERE param_filter.website_event_id = base_query.event_id
                AND SUBSTR(param_filter.data_key, INSTR(param_filter.data_key, '.') + 1) = '${paramName}'
                AND param_filter.${valueField} ${filter.operator} ${valuePrefix}${filter.value}${valueSuffix}
            )`);
          }
        }
      });
      
      // Add WHERE clause if there are any conditions
      if (whereConditions.length > 0) {
        sql += 'WHERE ' + whereConditions.join('\n  AND ') + '\n';
      }
    } else if (whereClauseFragments.length > 0) {
      // If no parameters but we have dynamic filters
      sql += 'WHERE ' + whereClauseFragments.join('\n  AND ') + '\n';
    }

    // GROUP BY
    if (config.groupByFields.length > 0) {
      const groupByCols: string[] = [];
      
      // Add regular columns to GROUP BY, but handle parameters differently
      config.groupByFields.forEach(field => {
        if (field === 'created_at') {
          groupByCols.push('dato');
        } else if (!field.startsWith('param_')) {
          // Only add non-parameter fields to GROUP BY
          groupByCols.push(`base_query.${field}`);
        }
      });

      // Only add GROUP BY clause if we have columns to group by
      if (groupByCols.length > 0) {
        sql += 'GROUP BY\n  ';
        sql += groupByCols.join(',\n  ');
        sql += '\n';
      }
    }
    
    // ORDER BY - Modified to handle date ordering correctly
    if (config.orderBy) {
      const orderColumn = config.orderBy.column === 'created_at' ? 'dato' : config.orderBy.column;
      sql += `ORDER BY ${orderColumn} ${config.orderBy.direction}\n`;
    } else if (config.groupByFields.length > 0) {
      // Default ordering
      if (config.groupByFields.includes('created_at')) {
        sql += 'ORDER BY dato DESC\n';
      } else {
        sql += 'ORDER BY 1 DESC\n';
      }
    }

    return sql;
  }, []);

  const generateSQL = () => {
    setGeneratedSQL(generateSQLCore(config, filters, dynamicFilters, parameters));
  };

  // Update the getMetricSQL function to handle aliases and indices
  const getMetricSQL = (metric: Metric, index: number): string => {
    // If user has set a custom alias, use that
    if (metric.alias) {
      return getMetricSQLByType(metric.function, metric.column, metric.alias);
    }
  
    // Always use metric_N format for consistency
    const defaultAlias = `metric_${index + 1}`;
    return getMetricSQLByType(metric.function, metric.column, defaultAlias);
  };

  // Helper function to generate the actual SQL
  const getMetricSQLByType = (func: string, column?: string, alias: string = 'metric'): string => {
    // If it's a custom parameter metric
    if (column?.startsWith('param_')) {
      const paramKey = column.replace('param_', '');
      
      switch (func) {
        case 'distinct':
          return `COUNT(DISTINCT CASE WHEN event_data.data_key = '${paramKey}' THEN event_data.string_value END) as ${alias}`;
        case 'sum':
        case 'average':
        case 'median':
          return `${func === 'average' ? 'AVG' : func.toUpperCase()}(
            CASE 
              WHEN event_data.data_key = '${paramKey}'
              THEN CAST(event_data.number_value AS NUMERIC)
            END
          ) as ${alias}`;
        case 'min':
          return `MIN(CASE WHEN event_data.data_key = '${paramKey}' THEN event_data.string_value END) as ${alias}`;
        case 'max':
          return `MAX(CASE WHEN event_data.data_key = '${paramKey}' THEN event_data.string_value END) as ${alias}`;
        default:
          return `COUNT(*) as ${alias}`;
      }
    }
  
    // For regular columns
    switch (func) {
      case 'count':
        return `COUNT(*) as ${alias}`;
      case 'distinct':
        return `COUNT(DISTINCT ${column || 'session_id'}) as ${alias}`;
      case 'sum':
        return column ? `SUM(${column}) as ${alias}` : `COUNT(*) as ${alias}`;
      case 'average':
        return column ? `AVG(${column}) as ${alias}` : `COUNT(*) as ${alias}`;
      case 'min':
        return column ? `MIN(${column}) as ${alias}` : `COUNT(*) as ${alias}`;
      case 'max':
        return column ? `MAX(${column}) as ${alias}` : `COUNT(*) as ${alias}`;
      default:
        return `COUNT(*) as ${alias}`;
    }
  };

  // Add orderBy management functions
  const setOrderBy = (column: string, direction: 'ASC' | 'DESC') => {
    setConfig(prev => ({
      ...prev,
      orderBy: { column, direction }
    }));
  };

  const clearOrderBy = () => {
    setConfig(prev => ({
      ...prev,
      orderBy: null
    }));
  };

  // Helper function to determine required table joins
  const getRequiredTables = (): { session: boolean, eventData: boolean } => {
    const tables = { session: false, eventData: false };
    
    // Check if any session columns are used in grouping, filtering or metrics
    const sessionColumns = Object.values(COLUMN_GROUPS)
      .find(group => group.table === 'session')
      ?.columns.map(col => col.value) || [];
    
    // Check group by fields
    if (config.groupByFields.some(field => sessionColumns.includes(field))) {
      tables.session = true;
    }
    
    // Check filters
    if (filters.some(filter => sessionColumns.includes(filter.column))) {
      tables.session = true;
    }

    // Check metrics
    if (config.metrics.some(metric => 
      metric.column && sessionColumns.includes(metric.column)
    )) {
      tables.session = true;
    }
    
    // Always include event_data table for custom metrics/parameters
    tables.eventData = true;
    
    return tables;
  };

  // Add a new function to handle date range changes
  const handleDateRangeChange = () => {
    if (tempDateRangeInDays < 1) {
      setTempDateRangeInDays(1);
      setDateRangeInDays(1);
    } else if (tempDateRangeInDays > maxDaysAvailable && maxDaysAvailable > 0) {
      setTempDateRangeInDays(maxDaysAvailable);
      setDateRangeInDays(maxDaysAvailable);
    } else {
      setDateRangeInDays(tempDateRangeInDays);
    }
  };

  // Update handleEventsLoad to get date range information
  const handleEventsLoad = (events: string[], autoParameters?: { key: string; type: 'string' }[]) => {
    setAvailableEvents(events);
    if (autoParameters) {
      setParameters(autoParameters);
    }

    // Get date range information
    if (config.website) {
      const fetchDateRange = async () => {
        try {
          const baseUrl = window.location.hostname === 'localhost' 
            ? 'https://reops-proxy.intern.nav.no' 
            : 'https://reops-proxy.ansatt.nav.no';

          const dateRangeResponse = await fetch(`${baseUrl}/umami/api/websites/${config.website?.id}/daterange`, {
            credentials: window.location.hostname === 'localhost' ? 'omit' : 'include'
          });
          const dateRange = await dateRangeResponse.json();
          
          const endDate = new Date(dateRange.maxdate);
          const startDate = new Date(dateRange.mindate);
          
          // Calculate max available days
          const totalDays = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
          setMaxDaysAvailable(totalDays);
          
          setDateRangeReady(true);
        } catch (err) {
          console.error("Error fetching date range:", err);
        }
      };

      fetchDateRange();
    }
  };

  return (
    <>
    <div className="w-full max-w-[1600px]">
      <Heading spacing level="1" size="medium" className="pt-12 pb-6">
        Bygg grafer og tabeller for Metabase
      </Heading>
      <p className="text-gray-600 mb-10 prose">
         Med grafbyggeren kan du lage grafer og tabeller som kan legges til i Metabase. 
         For eksempel en graf som viser andelen besøkende som har trykket på en knapp,
         eller hvor mange som har besøkt en spesifikk side.
        </p>

        <div className="lg:grid lg:grid-cols-2 lg:gap-8">
          {/* Left column - Form controls */}
          <div className="space-y-8">
            <VStack gap="8">
              {/* Data section - Website picker */}
              <section>
                {/* @ts-ignore */}
                <WebsitePicker selectedWebsite={config.website}
                  onWebsiteChange={(website) => setConfig(prev => ({ ...prev, website }))}
                  onEventsLoad={handleEventsLoad}
                />
              </section>

              {config.website && dateRangeReady && (
                <>
                  {/* Parameters section */}
                  <section>
                    <Heading level="2" size="small" spacing>
                      Egendefinerte eventer
                    </Heading>
                    <div className="bg-gray-50 p-5 rounded-md border">
                      <EventParameterSelector
                        availableEvents={availableEvents}
                        parameters={parameters}
                        setParameters={setParameters}
                      />
                      
                      <div>
                        <AdvancedOptions
                          dateRangeInDays={dateRangeInDays}
                          tempDateRangeInDays={tempDateRangeInDays}
                          maxDaysAvailable={maxDaysAvailable}
                          setTempDateRangeInDays={setTempDateRangeInDays}
                          handleDateRangeChange={handleDateRangeChange}
                        />
                      </div>
                    </div>
                  </section>

                  {/* Replace the Filter section with the new component */}
                  <section>
                    <ChartFilters
                      filters={filters}
                      dynamicFilters={dynamicFilters}
                      parameters={parameters}
                      setFilters={setFilters}
                      setDynamicFilters={setDynamicFilters}
                      availableEvents={availableEvents}
                    />
                  </section>

                  {/* Summarize section */}
                  <section>
                    <Heading level="2" size="small" spacing>
                      Oppsummering
                    </Heading>
                    <Summarize
                      metrics={config.metrics}
                      groupByFields={config.groupByFields}
                      parameters={parameters}
                      dateFormat={config.dateFormat}
                      orderBy={config.orderBy}
                      METRICS={METRICS}
                      DATE_FORMATS={DATE_FORMATS}
                      COLUMN_GROUPS={COLUMN_GROUPS}
                      getMetricColumns={getMetricColumns}
                      sanitizeColumnName={sanitizeColumnName}
                      updateMetric={(index, updates) => updateMetric(index, updates)}
                      removeMetric={removeMetric}
                      addMetric={addMetric}
                      addGroupByField={addGroupByField}
                      removeGroupByField={removeGroupByField}
                      moveGroupField={moveGroupField}
                      setOrderBy={setOrderBy}
                      clearOrderBy={clearOrderBy}
                      setDateFormat={(format) => setConfig(prev => ({
                        ...prev,
                        dateFormat: format as DateFormat['value']
                      }))}
                    />
                  </section>
                </>
              )}
            </VStack>
          </div>

          {/* Right column - SQL preview */}
          <div className="space-y-4 lg:sticky lg:top-4">
            {config.website && (
              <SQLPreview sql={generatedSQL} />
            )}
          </div>
        </div>

        <div className="mt-8">
          <Kontaktboks />
        </div>
      </div>
    </>
  );
};

// Add useDebounce hook to prevent too frequent updates
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
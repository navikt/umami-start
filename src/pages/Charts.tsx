import { useState, useEffect, useCallback, KeyboardEvent } from 'react';
import {
  Button,
  Heading,
  Select,
  VStack,
  CopyButton,
  Label,
  Link,
  TextField,
} from '@navikt/ds-react';
import Kontaktboks from '../components/kontaktboks';
import { MoveUp, MoveDown } from 'lucide-react';
import WebsitePicker from '../components/WebsitePicker'; // Import the new component

// Update ChartConfig interface to support multiple metrics
interface ChartConfig {
  website: Website | null;
  filters: Array<{
    column: string;
    operator: string;
    value: string;
  }>;
  metrics: Array<{
    function: string;
    column?: string;
    alias?: string;
  }>;
  groupByFields: string[];
  orderBy: {
    column: string;
    direction: 'ASC' | 'DESC';
  } | null;
  dateFormat: DateFormat['value'] | null;
}

interface Website {
  id: string;
  name: string;
  domain: string;
  teamId: string;
}

interface Filter {
  column: string;
  operator: string;
  value: string;
  customColumn?: string; // Add new property for custom column name
}

interface Metric {
  function: string;
  column?: string;
  alias?: string;
}

// Add new interface for date grouping
interface DateFormat {
  label: string;
  value: string;
  format: string;
}

// Add interface for dynamic filter
interface DynamicFilterOption {
  label: string;
  value: string;
  template: string;
}

// Add interface for custom parameters
interface Parameter {
  key: string;
  type: 'string' | 'number';
}

// Add date format options
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

const METRICS = [
  { label: 'Antall rader', value: 'count' },
  { label: 'Antall unike verdier', value: 'distinct' },
  { label: 'Sum av verdier', value: 'sum' },
  { label: 'Gjennomsnitt', value: 'average' },
  { label: 'Median', value: 'median' },
];


// Update FILTER_COLUMNS to use the same columns as grouping
const FILTER_COLUMNS = {
  eventBasics: {
    label: 'Basisdetaljer',
    columns: [
      { label: 'Event ID', value: 'event_id' },
      { label: 'Event Type', value: 'event_type' },
      { label: 'Event Name', value: 'event_name' },
      { label: 'Website ID', value: 'website_id' },
      { label: 'Website Domain', value: 'website_domain' },
      { label: 'Website Name', value: 'website_name' }
    ]
  },
  pageDetails: {
    label: 'Hendelsesdetaljer',
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

const OPERATORS = [
  { label: 'er lik', value: '=' },
  { label: 'er ikke lik', value: '!=' },
  { label: 'inneholder', value: 'LIKE' },
  { label: 'inneholder ikke', value: 'NOT LIKE' },
  { label: 'er tom', value: 'IS NULL' },
  { label: 'er ikke tom', value: 'IS NOT NULL' },
  { label: 'starter med', value: 'STARTS_WITH' },
  { label: 'slutter med', value: 'ENDS_WITH' },
];

const DYNAMIC_FILTER_OPTIONS: DynamicFilterOption[] = [
  // Time filters
  { label: 'Dato', value: 'created_at', template: '{{created_at}}' },
  
  // Page/URL filters
  { label: 'Sidesti (URL-sti)', value: 'url_path', template: '[[AND url_path = {{path}}]]' },
  { label: 'Sidetittel', value: 'page_title', template: '[[AND page_title = {{page_title}}]]' },
  { label: 'URL søkeparametere', value: 'url_query', template: '[[AND url_query = {{url_query}}]]' },
  
  // Referrer filters
  { label: 'Henvisende domene', value: 'referrer_domain', template: '[[AND referrer_domain = {{referrer_domain}}]]' },
  { label: 'Henvisende sti', value: 'referrer_path', template: '[[AND referrer_path = {{referrer_path}}]]' },
  
  // Visitor/Session filters
  { label: 'Enhet', value: 'device', template: '[[AND device = {{device}}]]' },
  { label: 'Nettleser', value: 'browser', template: '[[AND browser = {{browser}}]]' },
  { label: 'Operativsystem', value: 'os', template: '[[AND os = {{os}}]]' },
  { label: 'Land', value: 'country', template: '[[AND country = {{country}}]]' },
  { label: 'Region', value: 'subdivision1', template: '[[AND subdivision1 = {{region}}]]' },
  { label: 'By', value: 'city', template: '[[AND city = {{city}}]]' },
  { label: 'Språk', value: 'language', template: '[[AND language = {{language}}]]' },
  { label: 'Skjermstørrelse', value: 'screen', template: '[[AND screen = {{screen}}]]' },
  
  // Event filters
  { label: 'Event navn', value: 'event_name', template: '[[AND event_name = {{event_name}}]]' },
  { label: 'Event type', value: 'event_type', template: '[[AND event_type = {{event_type}}]]' },
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
const getMetricColumns = (parameters: Parameter[], metric: string) => {
  // Define the base columns structure with proper typing
  const baseColumns: Record<string, Array<{label: string, value: string}>> = {
    count: [],
    distinct: [
      { label: 'Session ID', value: 'session_id' },
      { label: 'Visit ID', value: 'visit_id' },
      { label: 'Browser', value: 'browser' },
      { label: 'URL Path', value: 'url_path' },
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

// Fix the columnGroups structure
const COLUMN_GROUPS: {
  [key: string]: {
    label: string;
    table: string;
    columns: Array<{ label: string; value: string }>;
  };
} = {
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
  const [newParameter, setNewParameter] = useState<string>('');

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
    
    // Generate select clause with all metrics and group by fields
    const selectClauses = new Set<string>(); // Use Set to prevent duplicates
    
    // Add group by fields to select with date formatting
    config.groupByFields.forEach(field => {
      if (field === 'created_at') {
        const format = DATE_FORMATS.find(f => f.value === config.dateFormat)?.format || '%Y-%m-%d';
        selectClauses.add(`FORMAT_TIMESTAMP('${format}', base_query.created_at) AS dato`);
      } else if (field.startsWith('param_')) {
        // Skip parameters here - they'll be handled in a unified way below
      } else {
        const tablePrefix = 'base_query';
        selectClauses.add(`${tablePrefix}.${field}`);
      }
    });
    
    // Add metrics to select
    config.metrics.forEach((metric, index) => {
      selectClauses.add(getMetricSQL(metric, index));
    });

    // Add ALL parameters to select - both from groupBy and metrics - in a unified way
    const usedParams = new Set<string>();
    
    // Collect parameters from groupBy fields
    config.groupByFields
      .filter(field => field.startsWith('param_'))
      .forEach(field => {
        const paramKey = field.replace('param_', '');
        usedParams.add(paramKey);
      });
    
    // Collect parameters from metrics
    config.metrics
      .filter(metric => metric.column?.startsWith('param_'))
      .forEach(metric => {
        const paramKey = metric.column!.replace('param_', '');
        usedParams.add(paramKey);
      });
    
    // Add all used parameters to select clause
    Array.from(usedParams).forEach(paramKey => {
      const param = parameters.find(p => sanitizeColumnName(p.key) === paramKey);
      if (param) {
        selectClauses.add(
          param.type === 'string'
            ? `  NULLIF(STRING_AGG(
                CASE 
                  WHEN event_data.data_key = '${param.key}' 
                  THEN event_data.string_value 
                END,
                ',' 
                ORDER BY base_query.created_at
              ), '') AS param_${sanitizeColumnName(param.key)}`
            : `  MAX(
                CASE 
                  WHEN event_data.data_key = '${param.key}'
                  THEN CAST(event_data.number_value AS NUMERIC)
                END
              ) AS param_${sanitizeColumnName(param.key)}`
        );
      }
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
        const param = parameters.find(p => sanitizeColumnName(p.key) === paramName);
        
        if (param) {
          if (filter.operator === 'IS NULL') {
            whereConditions.push(`NOT EXISTS (
              SELECT 1 FROM \`team-researchops-prod-01d6.umami.public_event_data\` param_filter
              WHERE param_filter.website_event_id = base_query.event_id
                AND param_filter.data_key = '${param.key}'
            )`);
          } else if (filter.operator === 'IS NOT NULL') {
            whereConditions.push(`EXISTS (
              SELECT 1 FROM \`team-researchops-prod-01d6.umami.public_event_data\` param_filter
              WHERE param_filter.website_event_id = base_query.event_id
                AND param_filter.data_key = '${param.key}'
            )`);
          } else {
            const valueField = param.type === 'number' ? 'number_value' : 'string_value';
            const valuePrefix = param.type === 'number' ? '' : "'";
            const valueSuffix = param.type === 'number' ? '' : "'";
            
            if (filter.operator === 'LIKE' || filter.operator === 'NOT LIKE') {
              whereConditions.push(`EXISTS (
                SELECT 1 FROM \`team-researchops-prod-01d6.umami.public_event_data\` param_filter
                WHERE param_filter.website_event_id = base_query.event_id
                  AND param_filter.data_key = '${param.key}'
                  AND param_filter.${valueField} ${filter.operator} ${valuePrefix}%${filter.value}%${valueSuffix}
              )`);
            } else if (filter.operator === 'STARTS_WITH') {
              whereConditions.push(`EXISTS (
                SELECT 1 FROM \`team-researchops-prod-01d6.umami.public_event_data\` param_filter
                WHERE param_filter.website_event_id = base_query.event_id
                  AND param_filter.data_key = '${param.key}'
                  AND param_filter.${valueField} LIKE ${valuePrefix}${filter.value}%${valueSuffix}
              )`);
            } else if (filter.operator === 'ENDS_WITH') {
              whereConditions.push(`EXISTS (
                SELECT 1 FROM \`team-researchops-prod-01d6.umami.public_event_data\` param_filter
                WHERE param_filter.website_event_id = base_query.event_id
                  AND param_filter.data_key = '${param.key}'
                  AND param_filter.${valueField} LIKE ${valuePrefix}%${filter.value}${valueSuffix}
              )`);
            } else {
              whereConditions.push(`EXISTS (
                SELECT 1 FROM \`team-researchops-prod-01d6.umami.public_event_data\` param_filter
                WHERE param_filter.website_event_id = base_query.event_id
                  AND param_filter.data_key = '${param.key}'
                  AND param_filter.${valueField} ${filter.operator} ${valuePrefix}${filter.value}${valueSuffix}
              )`);
            }
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
    if (config.groupByFields.length > 0 || parameters.length > 0) {
      sql += 'GROUP BY\n  ';
      const groupByCols: string[] = [];
      
      // Add regular columns
      config.groupByFields.forEach(field => {
        if (field === 'created_at') {
          groupByCols.push('dato'); // Use the alias we created
        } else if (!field.startsWith('param_')) { // Skip parameters in GROUP BY
          groupByCols.push(`base_query.${field}`);
        }
      });
    
      sql += groupByCols.join(',\n  ');
      sql += '\n';
    }
    
    // ORDER BY - Modified to handle date ordering correctly
    if (config.orderBy) {
      // If ordering by created_at, use the formatted 'dato' alias instead
      const orderColumn = config.orderBy.column === 'created_at' ? 'dato' : config.orderBy.column;
      sql += `ORDER BY ${orderColumn} ${config.orderBy.direction}\n`;
    } else if (config.groupByFields.includes('created_at')) {
      // Default date ordering uses the 'dato' alias
      sql += 'ORDER BY dato DESC\n';
    } else if (config.groupByFields.length > 0) {
      sql += 'ORDER BY 1 DESC\n';
    }
    
    sql += 'LIMIT 1000;';

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

  // Add helper functions for parameters
  const addParameter = (): void => {
    if (!newParameter.trim()) return;
    
    // Split the input by newlines and commas
    const params = newParameter
      .split(/[\n,]/)
      .map(param => param.trim())
      .filter(param => param && !parameters.some(p => p.key === param));
    
    if (params.length) {
      setParameters(prev => [
        ...prev,
        ...params.map(param => ({ key: param, type: 'string' as 'string' }))
      ]);
      setNewParameter('');
    }
  };
  
  const removeParameter = (keyToRemove: string): void => {
    setParameters(parameters.filter(param => param.key !== keyToRemove));
  };
  
  const toggleParameterType = (key: string) => {
    setParameters(prev => prev.map(param => 
      param.key === key 
        ? { ...param, type: param.type === 'string' ? 'number' : 'string' }
        : param
    ));
  };
  
  const handleParameterKeyPress = (e: KeyboardEvent<HTMLInputElement>, action: () => void) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      action();
    }
  };

  return (
    // Update layout to side-by-side on large screens
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
              <WebsitePicker
                selectedWebsite={config.website}
                onWebsiteChange={(website) => setConfig(prev => ({ ...prev, website }))}
              />
            </section>

            {config.website && (
              <>
                {/* Custom Parameters section - MOVED UP */}
                <section>
                  <Heading level="2" size="small" spacing>
                    Egendefinert
                  </Heading>
                  
                  <div className="space-y-6 bg-gray-50 p-5 rounded-md border">  
                    <div className="space-y-4">
                      <div className="flex gap-2 items-end">
                        <TextField
                          label="Egendefinerte event-parametere"
                          description="Eksempel: skjemanavn (legg til flere med komma)"
                          value={newParameter}
                          onChange={(e) => setNewParameter(e.target.value)}
                          onKeyUp={(e) => handleParameterKeyPress(e, addParameter)}
                          style={{ width: '100%' }}
                        />
                        <Button 
                          variant="secondary" 
                          onClick={addParameter}
                          style={{ height: '50px' }}
                        >
                          Legg til
                        </Button>
                      </div>

                      {parameters.length > 0 && (
                        <div className="space-y-2">
                          <Label as="p" size="small">
                            Valgte parametere:
                          </Label>
                          <div className="flex flex-col gap-2">
                            {parameters.map((param) => (
                              <div 
                                key={param.key} 
                                className="flex items-center justify-between bg-white px-4 py-3 rounded-md border"
                              >
                                <span className="font-medium">
                                  {param.key}
                                </span>
                                <div className="flex items-center gap-2">
                                  <Select 
                                    label=""
                                    size="small"
                                    value={param.type}
                                    className="!w-auto min-w-[120px]"
                                    onChange={() => toggleParameterType(param.key)}
                                  >
                                    <option value="string">📝 Tekst</option>
                                    <option value="number">🔢 Tall</option>
                                  </Select>
                                  <Button
                                    variant="tertiary-neutral"
                                    size="small"
                                    onClick={() => removeParameter(param.key)}
                                  >
                                    Fjern
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      <div className="mt-2 text-sm italic text-gray-600">
                        <p>
                          For å finne tilgjengelige parametere for din nettside / app, bruk <Link href="/datastruktur" target='_blank'>Datastruktur-verktøyet</Link>.
                        </p>
                      </div>
                    </div>
                  </div>
                </section>

                {/* Filter section - Improved UI */}
                <section>
                  <Heading level="2" size="small" spacing>
                    Filtre
                  </Heading>

                  <div className="space-y-6 bg-gray-50 p-5 rounded-md border">
                    {/* Dynamic Filters - Improved UI */}
                    <div>
                      <Heading level="3" size="xsmall" spacing>
                        Dynamiske filtre for dashboard
                      </Heading>
                      <p className="text-sm text-gray-600 mb-4">
                        Legg til filtre som kan endres direkte i Metabase-dashboardet.
                      </p>

                      <div className="flex flex-col gap-4">
                        {/* Filter selector - Better styling */}
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

                        {/* Selected filters - Better styling */}
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

                    {/* Static Filters - Improved UI */}
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
                                onChange={(e) => updateFilter(index, { column: e.target.value, operator: '=', value: '' })} // Reset value when changing column
                                size="small"
                              >
                                {/* Regular columns */}
                                {Object.entries(FILTER_COLUMNS).map(([groupKey, group]) => (
                                  <optgroup key={groupKey} label={group.label}>
                                    {group.columns.map(col => (
                                      <option key={col.value} value={col.value}>
                                        {col.label}
                                      </option>
                                    ))}
                                  </optgroup>
                                ))}
                                
                                {/* Add custom parameters as filter options */}
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

                              {filter.column === 'custom_column' ? (
                                <>
                                  <TextField
                                    label="Filternavn"
                                    value={filter.customColumn || ''} // Add new property for custom column name
                                    onChange={(e) => updateFilter(index, { customColumn: e.target.value })}
                                    size="small"
                                  />
                                  <Select
                                    label="Operator"
                                    value={filter.operator}
                                    onChange={(e) => updateFilter(index, { operator: e.target.value })}
                                    size="small"
                                  >
                                    {OPERATORS
                                      .filter(op => !['IS NULL', 'IS NOT NULL'].includes(op.value))
                                      .map(op => (
                                        <option key={op.value} value={op.value}>
                                          {op.label}
                                        </option>
                                      ))}
                                  </Select>
                                  <TextField
                                    label="Verdi"
                                    value={filter.value}
                                    onChange={(e) => updateFilter(index, { value: e.target.value })}
                                    size="small"
                                  />
                                </>
                              ) : (
                                <>
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
                                </>
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

                {/* Summarize section - Improved UI */}
                <section>
                  <Heading level="2" size="small" spacing>
                    Oppsummering
                  </Heading>
                  
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
                        {config.metrics.map((metric, index) => (
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
                                {getMetricColumns(parameters, metric.function).map(col => (
                                  <option key={col.value} value={col.value}>
                                    {col.label}
                                  </option>
                                ))}
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
                              disabled={config.metrics.length <= 1}
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
                        Velg hvordan dataene skal grupperes og vises. For eksempel kan du gruppere etter dato for å se endringer over tid, eller etter land for å sammenligne bruk på tvers av regioner.
                      </p>
                      
                      <div className="space-y-4">
                        <div className="flex gap-2 items-center bg-white p-3 rounded-md border">
                          <Select
                            label="Legg til gruppering"
                            onChange={(e) => {
                              if (e.target.value) {
                                addGroupByField(e.target.value);
                                (e.target as HTMLSelectElement).value = ''; // Type assertion for reset
                              }
                            }}
                            size="small"
                            className="flex-grow"
                          >
                            <option value="">Velg felt...</option>
                            {/* Regular columns */}
                            {Object.entries(COLUMN_GROUPS).map(([groupKey, group]) => (
                              <optgroup key={groupKey} label={group.label}>
                                {group.columns
                                  .filter(col => !config.groupByFields.includes(col.value))
                                  .map(col => (
                                    <option key={col.value} value={col.value}>
                                      {col.label}
                                    </option>
                                  ))}
                              </optgroup>
                            ))}
                            
                            {/* Add custom parameters group */}
                            {parameters.length > 0 && (
                              <optgroup label="Egendefinerte parametere">
                                {parameters
                                  .filter(param => !config.groupByFields.includes(`param_${sanitizeColumnName(param.key)}`))
                                  .map(param => (
                                    <option key={`param_${param.key}`} value={`param_${sanitizeColumnName(param.key)}`}>
                                      {param.key}
                                    </option>
                                  ))}
                              </optgroup>
                            )}
                          </Select>
                        </div>

                        {config.groupByFields.length > 0 && (
                          <div className="space-y-2">
                            <Label as="p" size="small">
                              Valgte grupperinger (sorter med pilene):
                            </Label>
                            <div className="flex flex-col gap-2">
                              {config.groupByFields.map((field, index) => {
                                // Try to find in regular columns first
                                const column = Object.values(COLUMN_GROUPS)
                                  .flatMap(group => group.columns)
                                  .find(col => col.value === field);
                                
                                // If not found in regular columns, check if it's a parameter
                                const paramName = field.startsWith('param_') ? parameters.find(
                                  p => `param_${sanitizeColumnName(p.key)}` === field
                                )?.key : undefined;
                                
                                return (
                                  <div 
                                    key={field} 
                                    className="flex items-center justify-between bg-white px-4 py-3 rounded-md border group hover:border-blue-200"
                                  >
                                    <div className="flex items-center gap-3">
                                      <span className="text-sm text-gray-500">
                                        {index + 1}.
                                      </span>
                                      <span className="font-medium">
                                        {paramName || column?.label || field}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      {/* Date format selector if the field is created_at */}
                                      {field === 'created_at' && (
                                        <Select
                                          label=""
                                          value={config.dateFormat || 'day'}
                                          onChange={(e) => setConfig(prev => ({
                                            ...prev,
                                            dateFormat: e.target.value as DateFormat['value']
                                          }))}
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
                                      
                                      {/* Move buttons */}
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
                                        {index < config.groupByFields.length - 1 && (
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
                            value={config.orderBy?.column || ""}
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
                              {config.groupByFields.map((field) => {
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
                              {config.metrics.map((metric, index) => (
                                <option 
                                  key={`metric_${index}`} 
                                  value={metric.alias || `metric_${index + 1}`} // Use same format as SQL
                                >
                                  {metric.alias || `metric_${index + 1}`} {/* Show same format in UI */}
                                </option>
                              ))}
                            </optgroup>
                          </Select>

                          {config.orderBy && (
                            <Select
                              label="Retning"
                              value={config.orderBy.direction}
                              onChange={(e) => setOrderBy(
                                config.orderBy?.column || "", 
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
                </section>
              </>
            )}
          </VStack>
        </div>

        {/* Right column - SQL preview */}
        <div className="space-y-4 lg:sticky lg:top-4">
          {config.website ? (
            <>
              <div className="space-y-2 py-4 pt-6">
                <Heading level="2" size="small">
                  SQL-kode for Metabase
                </Heading>
                <p className="text-sm text-gray-600">
                  🔄 SQL-koden oppdateres automatisk når du gjør endringer.
                </p>
              </div>

              <ol className="list-decimal list-inside text-sm text-gray-600 mb-4">
                    <li><Link href="https://metabase.ansatt.nav.no/dashboard/484" target="_blank" rel="noopener noreferrer">Åpne Metabase</Link> og klikk på den blå "Ny / New" knappen i toppmenyen.</li>
                    <li>Velg "SQL-spørring / SQL query" fra menyen som vises.</li>
                    <li>Kopier og kjør SQL-koden nedenfor og lim den inn i spørringseditoren.</li>
                </ol>

              {generatedSQL && (
                <div className="relative">
                  <pre className="bg-gray-50 p-4 rounded overflow-x-auto whitespace-pre-wrap max-h-[calc(100vh-200px)] overflow-y-auto">
                    {generatedSQL}
                  </pre>
                  <div className="absolute top-2 right-2">
                    <CopyButton
                      copyText={generatedSQL}
                      text="Kopier SQL"
                      activeText="Kopiert!"
                      size="small"
                    />
                  </div>
                </div>
              )}
            </>
          ) : (
            <></>
          )}
        </div>
      </div>

      <div className="mt-8">
        <Kontaktboks />
      </div>
    </div>
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
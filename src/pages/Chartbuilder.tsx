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
  Filter
} from '../types/chart';

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
  { label: 'Andel (%)', value: 'percentage' },
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
      // Add more columns from COLUMN_GROUPS
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
      { label: 'Personer', value: 'session_id' },
      { label: 'Besøk', value: 'visit_id' },
      { label: 'Hendelser', value: 'event_id' }
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

const ChartsPage = () => {
  const [config, setConfig] = useState<ChartConfig>({
    website: null,
    filters: [],
    metrics: [],
    groupByFields: [],
    orderBy: null,
    dateFormat: 'day',
    paramAggregation: 'unique'
  });
  const [generatedSQL, setGeneratedSQL] = useState<string>('');
  const [filters, setFilters] = useState<Filter[]>([]);
  const [parameters, setParameters] = useState<Parameter[]>([]);
  const [availableEvents, setAvailableEvents] = useState<string[]>([]);
  const [dateRangeReady, setDateRangeReady] = useState<boolean>(false);
  const [maxDaysAvailable, setMaxDaysAvailable] = useState<number>(0);

  // Fix dependency in useEffect by adding config as a stable reference
  const debouncedConfig = useDebounce(config, 500);

  useEffect(() => {
    if (debouncedConfig.website) {
      generateSQL();
    }
  }, [debouncedConfig, filters, parameters]);

  // Add helper functions for metrics
  const addMetric = (functionType?: string) => {
    setConfig(prev => ({
      ...prev,
      metrics: [...prev.metrics, { function: functionType || 'count' }]
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

  // Update the SQL generation to handle parameters better
  const generateSQLCore = useCallback((
    config: ChartConfig,
    filters: Filter[],
    parameters: Parameter[]
  ): string => {
    if (!config.website) return '';

    const requiredTables = getRequiredTables();
    
    // Helper function to check if a column is used in the chart
    const isColumnUsed = (column: string): boolean => {
      // Check if it's used in filters
      if (filters.some(f => f.column === column)) return true;
      
      // Check if it's used in group by
      if (config.groupByFields.includes(column)) return true;
      
      // Check if it's used in metrics
      if (config.metrics.some(m => m.column === column)) return true;
      
      return false;
    };
    
    // Start building the SQL with a CTE (Common Table Expression)
    let sql = 'WITH base_query AS (\n';
    sql += '  SELECT\n';
    sql += '    e.*,\n';
    
    // Add computed columns only if they're used
    sql += `    '${config.website.domain}' as website_domain,\n`;
    sql += `    '${config.website.name}' as website_name,\n`;
    
    // URL path calculations - only add if needed
    if (isColumnUsed('url_fullpath') || isColumnUsed('url_fullurl')) {
      sql += '    -- URL path calculations\n';
      
      if (isColumnUsed('url_fullpath')) {
        sql += '    CONCAT(\n';
        sql += '      e.url_path,\n';
        sql += '      CASE\n';
        sql += '        WHEN e.url_query IS NOT NULL AND e.url_query != \'\'\n';
        sql += '        THEN CONCAT(\'?\', e.url_query)\n';
        sql += '        ELSE \'\'\n';
        sql += '      END\n';
        sql += '    ) AS url_fullpath,\n';
      }
      
      if (isColumnUsed('url_fullurl')) {
        sql += '    CONCAT(\n';
        sql += `      'https://${config.website.domain}',\n`;
        sql += '      e.url_path,\n';
        sql += '      CASE\n';
        sql += '        WHEN e.url_query IS NOT NULL AND e.url_query != \'\'\n';
        sql += '        THEN CONCAT(\'?\', e.url_query)\n';
        sql += '        ELSE \'\'\n';
        sql += '      END\n';
        sql += '    ) AS url_fullurl,\n';
      }
    }
    
    // Referrer calculations - only add if needed
    if (isColumnUsed('referrer_fullpath') || isColumnUsed('referrer_fullurl')) {
      if (isColumnUsed('referrer_fullpath')) {
        sql += '    CONCAT(\n';
        sql += '      e.referrer_path,\n';
        sql += '      CASE\n';
        sql += '        WHEN e.referrer_query IS NOT NULL AND e.referrer_query != \'\'\n';
        sql += '        THEN CONCAT(\'?\', e.referrer_query)\n';
        sql += '        ELSE \'\'\n';
        sql += '      END\n';
        sql += '    ) AS referrer_fullpath';
        
        // Only add comma if referrer_fullurl is also used
        sql += isColumnUsed('referrer_fullurl') ? ',\n' : '\n';
      }
      
      if (isColumnUsed('referrer_fullurl')) {
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
        sql += '    END AS referrer_fullurl\n';
      }
    } else {
      // Remove trailing comma from the last column
      sql = sql.trimRight();
      if (sql.endsWith(',')) {
        sql = sql.slice(0, -1) + '\n';
      }
    }

    // Add session columns if needed
    if (requiredTables.session) {
      sql += '    s.browser,\n';
      sql += '    s.os,\n';
      sql += '    s.device,\n';
      sql += '    s.screen,\n';
      sql += '    s.language,\n';
      sql += '    s.country,\n';
      sql += '    s.subdivision1,\n';
      sql += '    s.city\n';
    } else {
      // Remove trailing comma if there are no session columns
      sql = sql.trimRight();
      if (sql.endsWith(',')) {
        sql = sql.slice(0, -1) + '\n';
      }
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
      } else if (filter.value || (filter.multipleValues && filter.multipleValues.length > 0)) {
        if (filter.column.startsWith('param_')) {
          // Handle parameter filtering
          sql += `  AND ${filter.column} ${filter.operator} '${filter.value}'\n`;
        } else if (filter.column === 'custom_column') {
          // Handle custom column name
          sql += `  AND e.${filter.customColumn} ${filter.operator} '${filter.value}'\n`;
        } else if (filter.column === 'event_type') {
          // Handle event_type as integer
          sql += `  AND e.${filter.column} ${filter.operator} ${filter.value}\n`;
        } else if (filter.column === 'event_name' && filter.multipleValues && filter.multipleValues.length > 0) {
          // Handle multiple event names using IN clause
          const eventNames = filter.multipleValues.map(val => `'${val}'`).join(', ');
          sql += `  AND e.${filter.column} IN (${eventNames})\n`;
        } else if (filter.column === 'url_path' && filter.multipleValues && filter.multipleValues.length > 0) {
          // Handle multiple URL paths using IN clause
          const urlPaths = filter.multipleValues.map(val => `'${val}'`).join(', ');
          sql += `  AND e.${filter.column} IN (${urlPaths})\n`;
        } else if (filter.column === 'created_at' && filter.dateRangeType && filter.dateRangeType !== 'custom') {
          // Special handling for date ranges - use the actual SQL expression
          sql += `  AND e.${filter.column} ${filter.operator} ${filter.value}\n`;
        } else if (filter.operator === 'LIKE' || filter.operator === 'NOT LIKE') {
          sql += `  AND e.${filter.column} ${filter.operator} '%${filter.value}%'\n`;
        } else if (filter.operator === 'STARTS_WITH') {
          sql += `  AND e.${filter.column} LIKE '${filter.value}%'\n`;
        } else if (filter.operator === 'ENDS_WITH') {
          sql += `  AND e.${filter.column} LIKE '%${filter.value}'\n`;
        } else {
          // For custom date expressions and all other cases, use the original approach
          // Skip the quotes for date expressions that are SQL functions
          const needsQuotes = !(
            filter.column === 'created_at' && 
            // @ts-ignore
            (filter.value.includes('TIMESTAMP') || filter.value.includes('CURRENT_'))
          );
          
          sql += `  AND e.${filter.column} ${filter.operator} ${needsQuotes ? `'${filter.value}'` : filter.value}\n`;
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
          const param = matchingParams[0];
          const valueField = param.type === 'number' ? 'number_value' : 'string_value';
          
          // Change how we handle parameters based on aggregation strategy
          if (config.paramAggregation === 'unique' && param.type === 'string') {
            // For unique string values, use the direct value without aggregation
            // This will create a row per unique value when combined with GROUP BY
            selectClauses.add(
              `event_data_${paramBase}.${valueField} AS ${field}`
            );
          } else {
            // Use aggregation for representative mode or numeric parameters
            const aggregator = getParameterAggregator(param.type);
            selectClauses.add(
              `${aggregator}(CASE 
                WHEN SUBSTR(event_data.data_key, INSTR(event_data.data_key, '.') + 1) = '${paramBase}' THEN event_data.${valueField}
                ELSE NULL
              END) AS ${field}`
            );
          }
        }
      } else {
        // Check if the field is a session field
        const isSessionField = Object.values(FILTER_COLUMNS)
          .find(group => group.table === 'session')
          ?.columns.some(col => col.value === field) || false;

        // Use s. prefix for session fields, base_query. for others
        const tablePrefix = isSessionField ? 's' : 'base_query';
        
        // Special case for session_id which exists in both tables
        if (field === 'session_id') {
          selectClauses.add(`base_query.${field}`);
        } else {
          selectClauses.add(`${tablePrefix}.${field}`);
        }
      }
    });

    // Then add metrics
    config.metrics.forEach((metric, index) => {
      selectClauses.add(getMetricSQL(metric, index));
    });

    sql += '  ' + Array.from(selectClauses).join(',\n  ');

    // Add FROM clause
    sql += '\nFROM base_query\n';

    // Always add session join if selecting session columns
    const needsSessionTable = config.groupByFields.some(field => {
      const isSessionField = Object.values(FILTER_COLUMNS)
        .find(group => group.table === 'session')
        ?.columns.some(col => col.value === field) || false;
      return isSessionField;
    }) || config.metrics.some(metric => {
      if (!metric.column) return false;
      const isSessionField = Object.values(FILTER_COLUMNS)
        .find(group => group.table === 'session')
        ?.columns.some(col => col.value === metric.column) || false;
      return isSessionField;
    });

    if (needsSessionTable) {
      sql += 'LEFT JOIN `team-researchops-prod-01d6.umami.public_session` s\n';
      sql += '  ON base_query.session_id = s.session_id\n';
    }
    
    // Add JOINs for parameters
    if (parameters.length > 0) {
      // First, add the main event_data join that all parameters will use in representative mode
      sql += 'LEFT JOIN `team-researchops-prod-01d6.umami.public_event_data` AS event_data\n';
      sql += '  ON base_query.event_id = event_data.website_event_id\n';
      
      // For unique mode: Add dedicated joins for each parameter that's being grouped
      if (config.paramAggregation === 'unique') {
        config.groupByFields.forEach(field => {
          if (field.startsWith('param_')) {
            const paramBase = field.replace('param_', '');
            const matchingParam = parameters.find(p => {
              const baseName = p.key.split('.').pop();
              return sanitizeColumnName(baseName!) === paramBase;
            });
            
            if (matchingParam && matchingParam.type === 'string') {
              // Add a specific join for this parameter
              sql += `LEFT JOIN \`team-researchops-prod-01d6.umami.public_event_data\` AS event_data_${paramBase}\n`;
              sql += `  ON base_query.event_id = event_data_${paramBase}.website_event_id\n`;
              sql += `  AND SUBSTR(event_data_${paramBase}.data_key, INSTR(event_data_${paramBase}.data_key, '.') + 1) = '${paramBase}'\n`;
            }
          }
        });
      }
      
      // Get parameter filters
      const paramFilters = filters.filter(filter => filter.column.startsWith('param_'));
      
      // Add WHERE clause for parameter filters only
      if (paramFilters.length > 0) {
        sql += 'WHERE ';
        
        // Add parameter filter conditions
        paramFilters.forEach((filter, index) => {
          if (index > 0) {
            sql += '  AND ';
          }
          
          const paramName = filter.column.replace('param_', '');
          // Find matching parameter by base name (after the dot)
          const param = parameters.find(p => {
            const baseName = p.key.split('.').pop();
            return sanitizeColumnName(baseName!) === paramName;
          });
          
          if (param) {
            if (filter.operator === 'IS NULL') {
              sql += `NOT EXISTS (
                SELECT 1 FROM \`team-researchops-prod-01d6.umami.public_event_data\` param_filter
                WHERE param_filter.website_event_id = base_query.event_id
                  AND SUBSTR(param_filter.data_key, INSTR(param_filter.data_key, '.') + 1) = '${paramName}'
              )`;
            } else if (filter.operator === 'IS NOT NULL') {
              sql += `EXISTS (
                SELECT 1 FROM \`team-researchops-prod-01d6.umami.public_event_data\` param_filter
                WHERE param_filter.website_event_id = base_query.event_id
                  AND SUBSTR(param_filter.data_key, INSTR(param_filter.data_key, '.') + 1) = '${paramName}'
              )`;
            } else {
              const valueField = param.type === 'number' ? 'number_value' : 'string_value';
              const valuePrefix = param.type === 'number' ? '' : "'";
              const valueSuffix = param.type === 'number' ? '' : "'";
              
              sql += `EXISTS (
                SELECT 1 FROM \`team-researchops-prod-01d6.umami.public_event_data\` param_filter
                WHERE param_filter.website_event_id = base_query.event_id
                  AND SUBSTR(param_filter.data_key, INSTR(param_filter.data_key, '.') + 1) = '${paramName}'
                  AND param_filter.${valueField} ${filter.operator} ${valuePrefix}${filter.value}${valueSuffix}
              )`;
            }
          }
        });
      }
    }

    // Add session join to the main query if required
    if (requiredTables.session) {
      sql += 'LEFT JOIN `team-researchops-prod-01d6.umami.public_session` s\n';
      sql += '  ON base_query.session_id = s.session_id\n';
    }

    // Add WHERE clause to filter out NULL values for percentage calculations on grouped fields
    const hasPercentageMetric = config.metrics.some(m => m.function === 'percentage');
    const needsNullFilter = hasPercentageMetric && config.groupByFields.length > 0;
    
    if (needsNullFilter) {
      const percentageMetrics = config.metrics.filter(m => m.function === 'percentage' && m.column);
      
      if (percentageMetrics.length > 0) {
        // For regular columns - add WHERE clause to filter NULL values
        const nonParamMetrics = percentageMetrics.filter(m => !m.column?.startsWith('param_'));
        
        if (nonParamMetrics.length > 0) {
          const whereClause = nonParamMetrics.map(m => 
            `base_query.${m.column} IS NOT NULL`
          ).join(' AND ');
          
          if (parameters.length > 0 && filters.some(f => f.column.startsWith('param_'))) {
            // Already has a WHERE clause for parameters
            sql += `  AND ${whereClause}\n`;
          } else {
            sql += `WHERE ${whereClause}\n`;
          }
        }
        
        // For parameter columns - add special filter in the JOIN condition
        const paramMetrics = percentageMetrics.filter(m => m.column?.startsWith('param_'));
        
        paramMetrics.forEach(metric => {
          const paramKey = metric.column?.replace('param_', '');
          
          if (paramKey && config.groupByFields.includes(`param_${paramKey}`)) {
            // Already handled in the JOIN condition for group fields
          } else if (paramKey) {
            // Add specific JOIN for parameter percentage filtering
            sql += `LEFT JOIN \`team-researchops-prod-01d6.umami.public_event_data\` AS pct_${paramKey}\n`;
            sql += `  ON base_query.event_id = pct_${paramKey}.website_event_id\n`;
            sql += `  AND SUBSTR(pct_${paramKey}.data_key, INSTR(pct_${paramKey}.data_key, '.') + 1) = '${paramKey}'\n`;
            
            // Add WHERE condition
            if (parameters.length > 0 && filters.some(f => f.column.startsWith('param_'))) {
              // Already has a WHERE clause
              sql += `  AND pct_${paramKey}.string_value IS NOT NULL\n`;
            } else {
              sql += `WHERE pct_${paramKey}.string_value IS NOT NULL\n`;
            }
          }
        });
      }
    }

    // GROUP BY - Modified to include parameters in unique mode
    if (config.groupByFields.length > 0) {
      const groupByCols: string[] = [];
      
      // Add columns to GROUP BY based on aggregation strategy
      config.groupByFields.forEach(field => {
        if (field === 'created_at') {
          groupByCols.push('dato');
        } else if (field.startsWith('param_') && config.paramAggregation === 'unique') {
          // For unique mode, include parameters in GROUP BY
          const paramBase = field.replace('param_', '');
          const matchingParam = parameters.find(p => {
            const baseName = p.key.split('.').pop();
            return sanitizeColumnName(baseName!) === paramBase;
          });
          
          // Only include string parameters in GROUP BY
          if (matchingParam && matchingParam.type === 'string') {
            groupByCols.push(field);
          } else if (!matchingParam) {
            // If parameter doesn't exist but was selected, still add it
            groupByCols.push(field);
          }
        } else if (!field.startsWith('param_')) {
          // Check if the field is a session field
          const isSessionField = Object.values(FILTER_COLUMNS)
            .find(group => group.table === 'session')
            ?.columns.some(col => col.value === field) || false;

          // Use s. prefix for session fields, base_query. for others
          const tablePrefix = isSessionField ? 's' : 'base_query';
          groupByCols.push(`${tablePrefix}.${field}`);
        }
        // Skip parameters in representative mode
      });

      // Only add GROUP BY clause if we have columns to group by
      if (groupByCols.length > 0) {
        sql += 'GROUP BY\n  ';
        sql += groupByCols.join(',\n  ');
        sql += '\n';
      }
    }
    
    // Order By - modified to handle metric columns properly
    if (config.orderBy) {
      // @ts-ignore First try to find any metric by alias
      const metricByAlias = config.metrics.find(m => m.alias === config.orderBy.column);
      
      const orderColumn = config.orderBy.column === 'created_at' 
        ? 'dato' 
        : metricByAlias 
          ? `\`${config.orderBy.column}\`` // Use backticks for quoted identifiers
          : config.orderBy.column.startsWith('metrikk_') || 
            config.orderBy.column.startsWith('andel') || 
            config.orderBy.column.includes('`')
            ? `\`${config.orderBy.column.replace(/`/g, '')}\`` // Clean and quote
            : config.orderBy.column;
      
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
    setGeneratedSQL(generateSQLCore(config, filters, parameters));
  };

  // Update the getMetricSQL function to handle aliases and indices
  const getMetricSQL = (metric: Metric, index: number): string => {
    // For percentage metrics, standardize the alias to 'andel' if not specified
    if (metric.function === 'percentage' && !metric.alias) {
      // If there are multiple percentage metrics, add an index
      const percentageCount = config.metrics
        .filter(m => m.function === 'percentage')
        .length;
      
      const alias = percentageCount > 1 ? `andel_${index + 1}` : 'andel';
      return getMetricSQLByType(metric.function, metric.column, alias);
    }
    
    // If user has set a custom alias, use that
    if (metric.alias) {
      return getMetricSQLByType(metric.function, metric.column, metric.alias);
    }
  
    // Always use metrikk_N format for consistency
    const defaultAlias = `metrikk_${index + 1}`;
    return getMetricSQLByType(metric.function, metric.column, defaultAlias);
  };

  // Helper function to generate the actual SQL
  const getMetricSQLByType = (func: string, column?: string, alias: string = 'metric'): string => {
    // Ensure the alias is properly quoted with backticks for BigQuery
    const quotedAlias = `\`${alias}\``;
    
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
          , 2) as ${quotedAlias}`;
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
        return column ? `SUM(${column}) as ${quotedAlias}` : `COUNT(*) as ${quotedAlias}`;
      case 'average':
        return column ? `AVG(${column}) as ${quotedAlias}` : `COUNT(*) as ${quotedAlias}`;
      case 'min':
        return column ? `MIN(${column}) as ${quotedAlias}` : `COUNT(*) as ${quotedAlias}`;
      case 'max':
        return column ? `MAX(${column}) as ${quotedAlias}` : `COUNT(*) as ${quotedAlias}`;
      case 'percentage':
        if (column) {
          // Check if it's a visitor detail column (session table)
          const isVisitorDetail = FILTER_COLUMNS.visitorDetails.columns.some(c => c.value === column);
          
          // Fix ambiguous column references for session_id
          if (column === 'session_id') {
            return `ROUND(
              100.0 * COUNT(*) / (
                SUM(COUNT(*)) OVER()
              )
            , 2) as ${quotedAlias}`;
          } else if (isVisitorDetail) {
            // For visitor details
            return `ROUND(
              100.0 * COUNT(*) / (
                SUM(COUNT(*)) OVER()
              )
            , 2) as ${quotedAlias}`;
          } else {
            // For other columns
            return `ROUND(
              100.0 * COUNT(*) / (
                SUM(COUNT(*)) OVER()
              )
            , 2) as ${quotedAlias}`;
          }
        }
        return `COUNT(*) as ${quotedAlias}`;
      default:
        return `COUNT(*) as ${quotedAlias}`;
    }
  };

  // Add orderBy management functions
  const setOrderBy = (column: string, direction: 'ASC' | 'DESC') => {
    // For known metrics, ensure consistent naming
    const metricWithAlias = config.metrics.find(m => m.alias === column);
    
    // If ordering by a percentage metric, check if it has a standard alias
    let finalColumn = column;
    if (column === 'andel' && !metricWithAlias) {
      // Find percentage metrics without custom aliases
      const percentageMetrics = config.metrics.filter(m => 
        m.function === 'percentage' && !m.alias
      );
      
      if (percentageMetrics.length === 1) {
        // If there's only one, use the standardized alias
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

  // Helper function to determine required table joins
  const getRequiredTables = (): { session: boolean, eventData: boolean } => {
    const tables = { session: false, eventData: false };
    
    // Check if any session columns are used in grouping, filtering or metrics
    const sessionColumns = Object.values(FILTER_COLUMNS)
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

  // Update handleEventsLoad to not handle date range information
  const handleEventsLoad = (events: string[], autoParameters?: { key: string; type: 'string' }[], maxDays?: number) => {
    setAvailableEvents(events);
    if (autoParameters) {
      setParameters(autoParameters);
    }
    if (maxDays !== undefined) {
      setMaxDaysAvailable(maxDays);
    }
    setDateRangeReady(true); // Just set this to true when events are loaded
  };

  // Add function to update parameter aggregation strategy
  const setParamAggregation = (strategy: 'representative' | 'unique') => {
    setConfig(prev => ({
      ...prev,
      paramAggregation: strategy
    }));
  };

  return (
    <div className="w-full max-w-[1600px]">
      <Heading spacing level="1" size="medium" className="pt-12 pb-6">
        Bygg grafer og tabeller for Metabase
      </Heading>
      <p className="text-gray-600 mb-10 prose">
      Gode beslutninger starter med innsikt. Med Grafbyggeren lager du grafer og tabeller basert på data fra Umami, klare til å presenteres i Metabase.
        </p>

        <div className="lg:grid lg:grid-cols-2 lg:gap-8">
          {/* Left column - Form controls */}
          <div className="mb-8 space-y-8">
            <VStack gap="8">
              {/* Data section - Website picker */}
              <section>
                {/* @ts-ignore Data section - Website picker */}
                <WebsitePicker selectedWebsite={config.website}
                  onWebsiteChange={(website) => setConfig(prev => ({ ...prev, website }))}
                  onEventsLoad={handleEventsLoad}
                />
              </section>

              {config.website && dateRangeReady && (
                <>
                  {/* Parameters section - Remove AdvancedOptions */}
                  <section>
                    <Heading level="2" size="small" spacing>
                      Datautforsker
                    </Heading>
                    <div className="bg-gray-50 p-5 rounded-md border">
                      <EventParameterSelector
                        availableEvents={availableEvents}
                        parameters={parameters}
                        setParameters={setParameters}
                      />
                    </div>
                  </section>

                  {/* Replace the Filter section with the new component */}
                  <section>
                    <ChartFilters
                      filters={filters}
                      parameters={parameters}
                      setFilters={setFilters}
                      availableEvents={availableEvents}
                      maxDaysAvailable={maxDaysAvailable}
                    />
                  </section>

                  {/* Summarize section with new parameter aggregation toggle */}
                  <section>
                    <Heading level="2" size="small" spacing>
                      Tilpass visning
                    </Heading>
                    <Summarize
                      metrics={config.metrics}
                      groupByFields={config.groupByFields}
                      parameters={parameters}
                      dateFormat={config.dateFormat}
                      orderBy={config.orderBy}
                      paramAggregation={config.paramAggregation}
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
          <div className="lg:sticky lg:top-4 lg:self-start lg:max-h-screen lg:flex lg:flex-col">
            {config.website && (
              <div className="mb-8 overflow-y-auto">
                <SQLPreview sql={generatedSQL} />
              </div>
            )}
          </div>
        </div>

        <Kontaktboks />
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
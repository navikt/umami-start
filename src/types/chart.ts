export interface Filter {
  column: string;
  operator?: string;
  value?: string;
  customColumn?: string;
  multipleValues?: string[];
  dateRangeType?: string; // For tracking which date range type is selected
  metabaseParam?: boolean; // Add this line
  interactive?: boolean; // Add this for interactive mode filters
}

export interface Parameter {
  key: string;
  type: 'string' | 'number';
  description?: string;
}

export interface Metric {
  function: string;
  column?: string;
  alias?: string;
  // New properties for count_where
  whereColumn?: string;
  whereOperator?: string;
  whereValue?: string;
  whereMultipleValues?: string[];
}

export interface DateFormat {
  label: string;
  value: string;
  format: string;
}

export interface ColumnGroup {
  label: string;
  table: string;
  columns: ColumnOption[];
}

export interface MetricOption {
  label: string;
  value: string;
}

export interface OrderBy {
  column: string;
  direction: 'ASC' | 'DESC';
}

export interface ColumnOption {
  label: string;
  value: string;
}

export interface Website {
  id: string;
  domain: string;
  name: string;
  teamId: string;
}

export interface WebsitePickerProps {
  selectedWebsite: Website | null;
  onWebsiteChange: (website: Website | null) => void;
}

export interface ChartConfig {
  website: Website | null;
  filters: Filter[];
  metrics: Metric[];
  groupByFields: string[];
  orderBy: { column: string; direction: 'ASC' | 'DESC' } | null;
  dateFormat: DateFormat['value'];
  paramAggregation: 'representative' | 'unique'; // New property for controlling parameter aggregation
  limit: null
}

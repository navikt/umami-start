export interface Filter {
  column: string;
  operator: string;
  value?: string;
  customColumn?: string;
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
}

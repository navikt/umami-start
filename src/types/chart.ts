export interface Filter {
  column: string;
  operator: string;
  value: string;
  customColumn?: string;
}

export interface DynamicFilterOption {
  label: string;
  value: string;
  template: string;
}

export interface Parameter {
  key: string;
  type: 'string' | 'number';
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
  columns: Array<{ label: string; value: string }>;
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
  name: string;
  domain: string;
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
  orderBy: OrderBy | null;
  dateFormat: DateFormat['value'] | null;
}

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

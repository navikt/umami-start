export const FILTER_COLUMNS = {
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
  // ...rest of FILTER_COLUMNS...
};

export const OPERATORS = [
  { label: 'er lik', value: '=' },
  { label: 'er ikke lik', value: '!=' },
  { label: 'inneholder', value: 'LIKE' },
  { label: 'inneholder ikke', value: 'NOT LIKE' },
  { label: 'er tom', value: 'IS NULL' },
  { label: 'er ikke tom', value: 'IS NOT NULL' },
  { label: 'starter med', value: 'STARTS_WITH' },
  { label: 'slutter med', value: 'ENDS_WITH' },
];

export const DYNAMIC_FILTER_OPTIONS = [
  { label: 'Dato', value: 'created_at', template: '{{created_at}}' },
  { label: 'Sidesti (URL-sti)', value: 'url_path', template: '[[AND url_path = {{path}}]]' },
  // ...rest of DYNAMIC_FILTER_OPTIONS...
];

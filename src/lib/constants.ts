export const FILTER_COLUMNS = {
  eventBasics: {
    label: 'Basisdetaljer',
    columns: [
      { label: 'Event Name', value: 'event_name' },
      { label: 'Event Type', value: 'event_type' },
      { label: 'Event ID', value: 'event_id' },
      { label: 'Created At', value: 'created_at' },
      { label: 'Website ID', value: 'website_id' },
      { label: 'Website Domain', value: 'website_domain' },
      { label: 'Website Name', value: 'website_name' }
    ]
  },
  pageDetails: {
    label: 'Hendelsesdetaljer',
    columns: [
      { label: 'URL Path', value: 'url_path' },
      { label: 'URL Query', value: 'url_query' },
      { label: 'URL Full Path', value: 'url_fullpath' },
      { label: 'URL Full URL', value: 'url_fullurl' },
      { label: 'Page Title', value: 'page_title' },
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
      { label: 'Session ID', value: 'session_id' },
      { label: 'Visit ID', value: 'visit_id' },
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
  {
    label: '📅 Velg dato',
    value: 'date_range',
    template: '[[AND base_query.created_at BETWEEN TIMESTAMP({{date_range.start}}) AND TIMESTAMP({{date_range.end}})]]'
  },
  {
    label: '🔗 Velg URL-sti',
    value: 'url_path',
    template: '[[AND base_query.url_path LIKE CONCAT(\'%\', {{url_path}}, \'%\')]]'
  },
  {
    label: '🌐 Velg domene',
    value: 'domain',
    template: '[[AND base_query.website_domain = {{domain}}]]'
  },
  {
    label: '🌍 Velg land',
    value: 'country',
    template: '[[AND base_query.country = {{country}}]]'
  },
  {
    label: '📱 Velg enhet',
    value: 'device',
    template: '[[AND base_query.device = {{device}}]]'
  }
];

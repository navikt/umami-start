export const sanitizeColumnName = (key: string): string => {
  return key
    .replace(/\./g, '_')
    .replace(/æ/gi, 'ae')
    .replace(/ø/gi, 'oe')
    .replace(/å/gi, 'aa')
    .replace(/[^a-z0-9_]/gi, '_');
};

export const normalizeUrlToPath = (input: string): string => {
  if (!input.trim()) return '/';
  let trimmed = input.trim();
  try {
    if (trimmed.includes('://')) {
      const url = new URL(trimmed);
      return url.pathname;
    }
    if (trimmed.startsWith('/') && trimmed.includes('.')) {
      const withoutLeadingSlash = trimmed.substring(1);
      if (withoutLeadingSlash.includes('/') && !withoutLeadingSlash.startsWith('/')) {
        trimmed = withoutLeadingSlash;
      }
    }
    if (!trimmed.startsWith('/') && trimmed.includes('.') && trimmed.includes('/')) {
      const url = new URL('https://' + trimmed);
      return url.pathname;
    }
  } catch (e) {
    // Ignore
  }
  return trimmed;
};

export const isDecoratorEvent = (eventName: string): boolean => {
  return eventName.startsWith('dekorator-');
};

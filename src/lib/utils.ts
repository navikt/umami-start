export const sanitizeColumnName = (key: string): string => {
  return key
    .replace(/\./g, '_')
    .replace(/æ/gi, 'ae')
    .replace(/ø/gi, 'oe')
    .replace(/å/gi, 'aa')
    .replace(/[^a-z0-9_]/gi, '_');
};

export const normalizeUrlToPath = (input: string): string => {
  if (!input.trim()) return '';
  let trimmed = input.trim();
  try {
    if (trimmed.includes('://')) {
      const url = new URL(trimmed);
      return url.pathname;
    }
    if (trimmed.startsWith('/') && trimmed.includes('.')) {
      const withoutLeadingSlash = trimmed.substring(1);
      const firstSlashIndex = withoutLeadingSlash.indexOf('/');

      if (firstSlashIndex !== -1 && !withoutLeadingSlash.startsWith('/')) {
        const potentialDomain = withoutLeadingSlash.substring(0, firstSlashIndex);
        if (potentialDomain.includes('.')) {
          trimmed = withoutLeadingSlash.substring(firstSlashIndex);
        }
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

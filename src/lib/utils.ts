export const sanitizeColumnName = (key: string): string => {
  return key
    .replace(/\./g, '_')
    .replace(/æ/gi, 'ae')
    .replace(/ø/gi, 'oe')
    .replace(/å/gi, 'aa')
    .replace(/[^a-z0-9_]/gi, '_');
};

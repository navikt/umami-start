import { MetabaseVariable } from '../types/chart';

/**
 * Safely replaces a filter condition in SQL with a Metabase variable
 * This respects line boundaries and SQL syntax to avoid breaking the query
 */
export const replaceFilterWithVariable = (
  sql: string,
  column: string,
  variableName: string
): string => {
  // Create specific regex patterns for different filter formats
  const urlInPattern = new RegExp(`\\s+AND\\s+e\\.${column}\\s+IN\\s*\\([^)]+\\)`, 'i');
  const urlEqualPattern = new RegExp(`\\s+AND\\s+e\\.${column}\\s+=\\s+'[^']+'`, 'i');
  const urlLikePattern = new RegExp(`\\s+AND\\s+e\\.${column}\\s+LIKE\\s+'%[^']+'`, 'i');
  
  const replacement = `  AND e.${column} = {{${variableName}}}`;
  let newSQL = sql;
  
  // Check for URL path IN clause
  if (urlInPattern.test(sql)) {
    // Split the SQL into lines for precise replacement
    const lines = sql.split('\n');
    newSQL = lines.map(line => {
      // Check if this line contains the URL path filter
      if (line.trim().includes(`e.${column} IN`) || 
          line.trim().includes(`e.${column}  IN`)) {
        return replacement;
      }
      return line;
    }).join('\n');
  } 
  // Check for URL path = clause
  else if (urlEqualPattern.test(sql)) {
    // Split the SQL into lines for precise replacement
    const lines = sql.split('\n');
    newSQL = lines.map(line => {
      // Check if this line contains the URL path filter
      if (line.trim().includes(`e.${column} =`) || 
          line.trim().includes(`e.${column}  =`)) {
        return replacement;
      }
      return line;
    }).join('\n');
  }
  // Check for URL path LIKE clause
  else if (urlLikePattern.test(sql)) {
    // Split the SQL into lines for precise replacement
    const lines = sql.split('\n');
    newSQL = lines.map(line => {
      // Check if this line contains the URL path filter
      if (line.trim().includes(`e.${column} LIKE`) || 
          line.trim().includes(`e.${column}  LIKE`)) {
        return replacement;
      }
      return line;
    }).join('\n');
  }
  // If no existing filter found, don't add anything - let the parent component handle it
  
  // If we already have this variable in the SQL, don't add a duplicate
  if (newSQL.includes(`{{${variableName}}}`)) {
    return newSQL;
  }
  
  return newSQL;
};

/**
 * Safely applies all variables to SQL code
 */
export const applyVariablesToSQL = (sql: string, variables: MetabaseVariable[]): string => {
  let resultSQL = sql;
  
  // Process by variable type for specialized handling
  variables.forEach(variable => {
    if (variable.type === 'field_filter' && variable.column) {
      resultSQL = replaceFilterWithVariable(resultSQL, variable.column, variable.name);
    } else if (variable.type === 'date') {
      // Handle date filters with specialized pattern
      const datePattern = /AND\s+e\.created_at\s+(>=|<=|>|<)\s+([^)\n]+)/g;
      resultSQL = resultSQL.replace(
        datePattern,
        `AND e.created_at $1 {{${variable.name}}}`
      );
    }
    // Add other variable type handling as needed
  });
  
  return resultSQL;
};

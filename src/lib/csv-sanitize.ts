/**
 * Sanitize a value for CSV to prevent formula injection.
 * If the value starts with =, +, -, @, \t, or \r, prepend with a single quote.
 */
export function sanitizeCSVValue(value: string): string {
  if (!value) return value;
  const dangerousChars = ['=', '+', '-', '@', '\t', '\r'];
  if (dangerousChars.some(c => value.startsWith(c))) {
    return "'" + value;
  }
  return value;
}

/**
 * Escape and sanitize a value for CSV output.
 * Combines formula injection prevention with proper CSV quoting.
 */
export function escapeCSV(value: string): string {
  const sanitized = sanitizeCSVValue(value);
  if (sanitized.includes(',') || sanitized.includes('"') || sanitized.includes('\n')) {
    return `"${sanitized.replace(/"/g, '""')}"`;
  }
  return sanitized;
}

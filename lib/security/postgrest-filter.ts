/**
 * Sanitize user input before embedding in PostgREST `.or()` / `ilike` filter strings.
 * Strips filter metacharacters that could alter query structure.
 */
export function sanitizePostgrestSearchTerm(raw: string): string {
  return raw.trim().replace(/[,()%*_\\:]/g, "");
}

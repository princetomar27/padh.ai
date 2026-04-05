import "server-only";

/**
 * PostgreSQL UTF-8 text rejects NUL (0x00). PDF text layers sometimes emit it.
 */
export function sanitizePostgresUtf8Text(value: string): string {
  return value.replace(/\0/g, "");
}

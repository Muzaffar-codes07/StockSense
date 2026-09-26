/**
 * Escapes LIKE/ILIKE wildcards (`%`, `_`) and the escape character so user
 * search text matches literally. Postgres uses backslash as the default escape.
 */
export function escapeLike(input: string): string {
  return input.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

/** SKUs are case-insensitive identifiers: trim and upper-case before storing. */
export function normalizeSku(raw: string): string {
  return raw.trim().toUpperCase();
}

/** 1-32 chars, starts with a letter/digit, then letters, digits, `.`, `_`, `-`. */
export const SKU_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,31}$/;

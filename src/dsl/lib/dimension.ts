// dsl.md §3 — dimension validity and canonical stored form.

import type { NormDim } from "../types.ts";

const INTERNAL_WHITESPACE = /\s/;

// Internal whitespace is malformed input, not a request to split one dimension
// into several.
export function isValidDimension(raw: string): boolean {
  return !INTERNAL_WHITESPACE.test(raw.trim());
}

export function normalizeDimension(raw: string): NormDim {
  return raw.trim().toLowerCase() as NormDim;
}

// Dedup and sort after normalizing, so `Git` and `git` collapse.
export function normalizeDimensions(raw: readonly string[]): readonly NormDim[] {
  return [...new Set(raw.map(normalizeDimension))].sort();
}

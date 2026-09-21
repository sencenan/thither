// dsl.md §3 — dimensions: validation and normalization kept as *separate*
// concerns. Validation is a predicate the parser (structured-value) runs while
// parsing a supplied value; normalization is a total transform the matcher runs
// while matching. Splitting them frees normalization of any failure mode — it
// never returns `undefined`, so a caller that only needs the stored form does not
// inherit a validity check it does not want. This module is its own file so ops
// 10/11 can normalize without dragging in structured-value validation. Knows
// nothing of structured values, matching, or the stack.

import type { NormDim } from "../types.ts";

const INTERNAL_WHITESPACE = /\s/;

// dsl.md §3: a dimension is invalid when it holds whitespace *after trimming* —
// that is malformed input, not a request to split one dimension into several.
// This is the only dimension-validity rule, and it is the parser's gate before a
// supplied dimension is stored. It transforms nothing, so it composes with
// normalization instead of hiding a failure mode inside it.
export function isValidDimension(raw: string): boolean {
  return !INTERNAL_WHITESPACE.test(raw.trim());
}

// dsl.md §3: normalize one dimension to its stored form — trim, then
// locale-independent lowercase. Total by construction: rejecting a malformed
// dimension is `isValidDimension`'s job (the parser's), so there is nothing to
// fail on here. Diacritics are preserved (`Café` -> `café`); matching treats them
// distinctly.
export function normalizeDimension(raw: string): NormDim {
  return raw.trim().toLowerCase() as NormDim;
}

// dsl.md §3: normalize a list into the canonical stored form — each member
// normalized, then deduplicated and sorted by default UTF-16 code-unit order
// (dedup/sort happen *after* normalization, so `Git` and `git` collapse). Also
// total.
export function normalizeDimensions(raw: readonly string[]): readonly NormDim[] {
  return [...new Set(raw.map(normalizeDimension))].sort();
}

// dsl.md §3 — dimension normalization. A stored dimension is trimmed,
// lowercased (locale-independent), whitespace-free, deduplicated, and sorted by
// UTF-16 code-unit order. This is its own module (not folded into
// structured-value) so the operations in tickets 10/11 can mint `NormDim`s
// without dragging in structured-value validation. Knows nothing of structured values, matching,
// or the stack.

import type { NormDim } from "../types.ts";

// Only *internal* whitespace is invalid; leading/trailing is trimmed away first.
// `\s` is JavaScript's own whitespace class, per the spec's insistence on the
// standard `trim()`/`toLowerCase()` and no locale sensitivity.
const INTERNAL_WHITESPACE = /\s/;

// Normalize one raw dimension, or `undefined` when it holds internal whitespace
// after trimming — which dsl.md §3 calls invalid, *not* a request to split one
// dimension into several. Lowercasing is locale-independent and does not strip
// diacritics, so `café` stays `café` (matching then treats it distinctly).
export function normalizeDimension(raw: string): NormDim | undefined {
  const trimmed = raw.trim();
  if (INTERNAL_WHITESPACE.test(trimmed)) {
    return undefined;
  }
  return trimmed.toLowerCase() as NormDim;
}

// Normalize a raw dimension list into the canonical stored form: every member
// normalized, then deduplicated and sorted by default UTF-16 code-unit order
// (dedup/sort happen *after* normalization, so `Git` and `git` collapse). Returns
// `undefined` if any member is invalid, so the caller can reject the whole value.
export function normalizeDimensions(raw: readonly string[]): readonly NormDim[] | undefined {
  const normalized: NormDim[] = [];
  for (const member of raw) {
    const dim = normalizeDimension(member);
    if (dim === undefined) {
      return undefined;
    }
    normalized.push(dim);
  }
  return [...new Set(normalized)].sort();
}

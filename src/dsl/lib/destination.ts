// dsl.md §2 — URL and template validation. Owns the placeholder count P
// (ticket 04's seam map). Knows nothing of the caller, the error path, or the
// stack: it says whether a string is a valid destination and, if so, hands back
// the *original* text branded, never a normalized form. Both call sites — a
// `.set` operand (an evaluation `invalid_destination`) and a destination inside
// a supplied `S` (a parse-time `E`) — decide their own error path from `undefined`.

import type { Template } from "../types.ts";

// The WHATWG `URL` is a universal platform global (browser, Node, and workers),
// not a client-only API, so relying on it does not breach ADR-0001's
// client-agnostic core. The core's tsconfig omits the DOM lib to keep
// localStorage/document/window out (docs/code-standards.md), which also drops
// `URL`'s type. This module-scoped ambient declaration re-supplies only the
// narrow surface the validator uses; being module-local it shadows nothing and
// collides with nothing in the repo-wide DOM pass. dsl.md §2 mandates this exact
// parser.
declare const URL: { new (url: string): unknown };

const PLACEHOLDER = "{}";

// The probe stands in for every placeholder so the *shape* of the URL is what
// gets validated, not a template that the WHATWG parser would choke on. dsl.md
// §2 fixes the token as the literal `thither`.
const PROBE = "thither";

function render(raw: string): string {
  return raw.split(PLACEHOLDER).join(PROBE);
}

// Validate by rendering then parsing (dsl.md §2): replace every `{}` with the
// probe and hand the result to the WHATWG `URL` parser. The single-argument
// constructor accepts only an absolute URL with an explicit scheme and rejects a
// relative reference outright, so a successful parse *is* the "explicit scheme"
// check — no base URL, no scheme inference. On success the byte-identical
// original is returned (branded), because storage and later substitution use the
// template text, never the parser's normalized probe output.
export function validateDestination(raw: string): Template | undefined {
  try {
    new URL(render(raw));
  } catch {
    return undefined;
  }
  return raw as Template;
}

// The count P of anonymous placeholders, for argument balance (dsl.md §5's
// argDelta, ticket 12). Overlap is impossible for the two-character token, so a
// split-count is exact: `{}{}` is two placeholders, a lone `{` or `}` is none.
export function countPlaceholders(template: Template): number {
  return template.split(PLACEHOLDER).length - 1;
}

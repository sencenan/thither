// dsl.md §2 — URL and template validation.

import type { Template } from "../types.ts";

// The core omits the DOM lib, which drops `URL`'s type with it; see
// docs/code-standards.md "Layout" on universal platform globals.
declare const URL: { new (url: string): unknown };

const PLACEHOLDER = "{}";
const PROBE = "thither";

function render(raw: string): string {
  return raw.split(PLACEHOLDER).join(PROBE);
}

// Render-then-parse (dsl.md §2). The single-argument constructor rejects a
// relative reference, so a successful parse *is* the explicit-scheme check and no
// separate test is missing. Returns the original text, never the parser's
// normalized output, because substitution later fills the template as written.
export function validateDestination(raw: string): Template | undefined {
  try {
    new URL(render(raw));
  } catch {
    return undefined;
  }
  return raw as Template;
}

// The count P of anonymous placeholders, for argument balance (dsl.md §5).
export function countPlaceholders(template: Template): number {
  return template.split(PLACEHOLDER).length - 1;
}

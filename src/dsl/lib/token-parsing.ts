// dsl.md §2 — source syntax and parsing: one string token to one program item.
// This is the string-token half of `append`. It knows nothing of the stack,
// evaluation, structured (object) values, or matching. Operations are recognized
// by name against the environment's symbol set, never a hardcoded list (ADR-0005).

import type { Dim, Operation, ProgramItem, ThitherError } from "../types.ts";

// The sole seam that mints a raw stack-side literal from source text. A token is
// already space-free — the host splits user input on \s before appending — so a
// `Dim`'s space-free constraint holds by construction, and spelling is preserved
// verbatim (dsl.md §1). Whether the literal is later usable as a URL or template
// is the destination seam's verdict (ticket 06), reached only when an operation
// consumes it; a URL accumulates exactly like a dimension until then.
function literal(text: string): ProgramItem {
  return ["lit", text as Dim];
}

function parseError(token: string): ThitherError {
  return ["E", { type: "parse_error", description: `unrecognized dot-prefixed token: ${token}` }];
}

// Parse one string token into a program item. Total over every string: never
// throws, never rejects a whole program (docs/code-standards.md "Failure").
// `operations` is the environment's recognized operation names, so recognition
// is env-relative — an unbound dot-token is a parse error, not a fixed verdict.
export function parseToken(token: string, operations: ReadonlySet<Operation>): ProgramItem {
  // The standalone dot is the argument separator, and only standalone: a dot
  // inside `node.js` or `example.com` is ordinary content, caught by the final
  // literal case below.
  if (token === ".") {
    return ["."];
  }
  // A leading double dot escapes: strip exactly one dot and take the rest as a
  // literal, never re-interpreting it as an operation. So `..$` becomes the
  // literal `.$` — a ["lit", ...], not the operation ["op", ".$"]. That sigil is
  // exactly what lets the evaluator's lifecycle test (ticket 09) tell an escaped
  // `..$` from the real terminating operation.
  if (token.startsWith("..")) {
    return literal(token.slice(1));
  }
  // A single leading dot is control syntax: either an operation the environment
  // binds, or a parse error. It is never ordinary content.
  if (token.startsWith(".")) {
    return operations.has(token) ? ["op", token] : parseError(token);
  }
  return literal(token);
}

// dsl.md §2 — source syntax and parsing: one string token to one program item.

import type { Dim, Operation, ProgramItem, ThitherError } from "../types.ts";

// The `Dim` cast is sound because the host splits input on \s before appending,
// so a token cannot contain whitespace.
function literal(text: string): ProgramItem {
  return ["lit", text as Dim];
}

function parseError(token: string): ThitherError {
  return ["E", { type: "parse_error", description: `unrecognized dot-prefixed token: ${token}` }];
}

export function parseToken(token: string, operations: ReadonlySet<Operation>): ProgramItem {
  if (token === ".") {
    return ["."];
  }
  // `..$` must stay a ["lit", ".$"] rather than the operation ["op", ".$"]: the
  // sigil is what lets the lifecycle rule tell an escaped literal from the real
  // terminating operation (dsl.md §1).
  if (token.startsWith("..")) {
    return literal(token.slice(1));
  }
  if (token.startsWith(".")) {
    return operations.has(token) ? ["op", token] : parseError(token);
  }
  return literal(token);
}

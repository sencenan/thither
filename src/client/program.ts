// browser-client.md "Execution flow" (ADR 0015) — what the client reads off the user's own tokens,
// before it composes them into a program, and what it puts back into the field after a run.

import type { Interpreter, Result } from '../dsl/index.ts';

// An operation is a token the interpreter's parser binds, so `..set` (escaped) and `.s` (unbound,
// a missing_operation error) are not operations.
const isOperation = (interp: Interpreter, token: string): boolean =>
  interp.pushToken([], token)[0]?.[0] === 'o';

// A nontrivial program has an operation other than a `.$` typed as its last token, which does
// what the closing `.$` the client appends would do anyway. Only the user's tokens are checked:
// the operations the client adds around them never count.
export const isNontrivial = (interp: Interpreter, tokens: readonly string[]): boolean =>
  tokens.some(
    (token, index) =>
      isOperation(interp, token) && !(token === '.$' && index === tokens.length - 1),
  );

// dsl.md §4.4 — `inputs` and `args` are exactly what the search consumed, so the search is
// rebuilt as the inputs, then the separator and the arguments when there are any.
export const searchTokens = (result: Result): readonly string[] => {
  const { inputs, args } = result[1];
  return args.length > 0 ? [...inputs, '.', ...args] : [...inputs];
};

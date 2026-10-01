// browser-client.md "Execution flow" — one run: the host composes prologue + user tokens +
// epilogue (ADR 0007) and executes it. `.load` supplies the world, `.$` searches, `.out`
// captures the terminal, `.save` persists, so the caller reads the env's register afterwards
// and never the returned stack. Synchronous end to end: `execute` and `localStorage` both are.

import type { Interpreter, Program } from '../dsl/index.ts';

// The program a run executes, as source tokens; the waiting page shows exactly this (ADR 0015).
export const compose = (tokens: readonly string[]): readonly string[] => [
  '.load',
  ...tokens,
  '.$',
  '.out',
  '.save',
];

const parse = (interp: Interpreter, tokens: readonly string[]): Program =>
  tokens.reduce<Program>((acc, token) => interp.pushToken(acc, token), []);

export const run = (interp: Interpreter, tokens: readonly string[]): void => {
  interp.execute(parse(interp, compose(tokens)));
};

// The world without running anything (ADR 0015): `.load` reads the stored stack, or reports an
// unreadable record, and `.out` records its state. No search and no save, so a nontrivial program
// waiting for Enter still shows the current focus.
export const load = (interp: Interpreter): void => {
  interp.execute(parse(interp, ['.load', '.out']));
};

// browser-client.md "Execution flow" — one run: the host composes prologue + user tokens +
// epilogue (ADR 0007) and executes it. The client base state goes beneath the stored world, which
// `.load` supplies and `.merge` merges into it (ADR 0016); `.$` searches, `.out` captures the
// terminal, `.save` persists, so the caller reads the env's register afterwards and never the
// returned stack. Synchronous end to end: `execute` and `localStorage` both are.

import type { Interpreter, Program, State } from '../dsl/index.ts';

type Item = string | State;

const prologue = (base: State): readonly Item[] => [base, '.load', '.merge'];

// The program a run executes, as source items; the waiting page shows exactly this (ADR 0015).
export const compose = (base: State, tokens: readonly string[]): readonly Item[] => [
  ...prologue(base),
  ...tokens,
  '.$',
  '.out',
  '.save',
];

const parse = (interp: Interpreter, items: readonly Item[]): Program =>
  items.reduce<Program>((acc, item) => interp.pushToken(acc, item), []);

export const run = (interp: Interpreter, base: State, tokens: readonly string[]): void => {
  interp.execute(parse(interp, compose(base, tokens)));
};

// The world without running anything (ADR 0015): the same prologue reads and merges the stored
// stack, or reports an unreadable record, and `.out` records its state. No search and no save, so
// a nontrivial program waiting for Enter still shows the current focus.
export const load = (interp: Interpreter, base: State): void => {
  interp.execute(parse(interp, [...prologue(base), '.out']));
};

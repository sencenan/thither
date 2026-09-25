// browser-client.md "Execution flow" — one run: the host composes prologue + user tokens +
// epilogue (ADR 0007) and executes it. `.load` supplies the world, `.$` searches, `.out`
// captures the terminal, `.save` persists, so the caller reads the env's register afterwards
// and never the returned stack. Synchronous end to end: `execute` and `localStorage` both are.

import type { Interpreter, Program } from '../dsl/index.ts';

export const run = (interp: Interpreter, tokens: readonly string[]): void => {
  const program = ['.load', ...tokens, '.$', '.out', '.save'].reduce<Program>(
    (acc, token) => interp.pushToken(acc, token),
    [],
  );
  interp.execute(program);
};

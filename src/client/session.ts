// browser-client.md "Execution flow" — one run is the program `.load <tokens> .$ .out .save`,
// executed inside a Web Lock, after which the client reads only the output register (never the
// returned stack). This module holds the navigation latch and the pure navigation decision.

import type { Interpreter, Program } from '../dsl/index.ts';
import type { OutputRegister } from './browser-env.ts';

// The Web Locks slice the session needs, injected so a caller without `navigator.locks` (or a
// test) can omit it. `navigator.locks` satisfies this shape.
export interface LockRunner {
  request(name: string, callback: () => void): Promise<unknown>;
}

export interface SessionDeps {
  readonly interp: Interpreter;
  readonly register: OutputRegister;
  readonly locks?: LockRunner | undefined;
  readonly navigate: (url: string) => void;
  readonly render: (register: OutputRegister) => void;
}

export interface Session {
  run(input: readonly string[], mode: 'initial' | 'live'): Promise<void>;
}

// browser-client.md "Execution flow" step 4 — auto-navigate only when the run is still armed,
// the terminal is an `R` with exactly one match whose argument balance is nonnegative, and the
// persisted stack did not change. A mutation flips `changed`, so `home .set` shows the list
// rather than navigating in one keystroke; a `.save` that failed (`E`) never navigates.
export const decideNavigation = (register: OutputRegister, armed: boolean): boolean => {
  if (!armed) {
    return false;
  }

  const { terminal, saved } = register;
  if (terminal?.[0] !== 'R') {
    return false;
  }

  const { matches } = terminal[1];
  const match = matches[0];
  if (matches.length !== 1 || match === undefined || match[3].argDelta < 0) {
    return false;
  }

  // `saved` is a ThitherError (an array) when the write failed; a plain object when it succeeded.
  return saved !== undefined && 'changed' in saved && saved.changed === false;
};

export const createSession = (deps: SessionDeps): Session => {
  const { interp, register, locks, navigate, render } = deps;

  // browser-client.md "Fallback UI" — armed at page load, disarmed once anything is rendered, so
  // no later run (live edits, replays) auto-navigates for the remainder of this page load.
  let navigationArmed = true;

  const execute = (program: Program): Promise<void> => {
    const run = () => {
      interp.execute(program);
    };
    // No `navigator.locks`: run without the lock rather than block a single-user operation.
    return locks === undefined
      ? Promise.resolve(run())
      : locks.request('thither', run).then(() => undefined);
  };

  return {
    run: async (input, mode) => {
      const program = ['.load', ...input, '.$', '.out', '.save'].reduce<Program>(
        (acc, token) => interp.pushToken(acc, token),
        [],
      );
      await execute(program);

      // Empty input never auto-navigates: opening the launcher with no program always shows the
      // page, so a single-target state stays reachable to add targets or open Settings
      // (browser-client.md "Execution flow"). An empty `.$` matches every target, so without this
      // a one-target state would redirect on a blank open and could never be seen again.
      const armed = navigationArmed && mode === 'initial' && input.length > 0;
      if (decideNavigation(register, armed)) {
        const terminal = register.terminal;
        // decideNavigation guaranteed an R with one nonnegative match; its destination is
        // fully rendered (dsl.md §5), so it is the navigation URL.
        if (terminal?.[0] === 'R') {
          navigate(terminal[1].matches[0]?.[0] ?? '');
        }
        return;
      }

      render(register);
      navigationArmed = false;
    },
  };
};

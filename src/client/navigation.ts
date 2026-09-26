// browser-client.md "Execution flow" step 4 / ADR 0009, ADR 0011 — the destination to
// auto-navigate to. The core fans out one match per variant (ADR 0011), so the discriminator is
// no longer the match count but the argument balance: navigate when the terminal is an `R` for a
// non-empty query, every match belongs to one selected target (they share a key), and that target
// has a best fit — the single `argDelta === 0` row — else, for a single-variant target, a lone row
// with a positive balance (surplus arguments dropped, e.g. `home foo` -> home). This reproduces
// ADR 0009's teleport behaviour exactly: best fit teleports, single-variant surplus teleports, two
// matched targets never do, incomplete never does. `R.inputs` is the query the trailing `.$`
// consumed, so `<u> a b .set a b` navigates while `<u> home .set`, a blank open, and a focus-only
// search (focus is not part of `inputs`) all show the page.

import type { OutputRegister } from './browser-env.ts';

export const resolveNavigationDestination = (register: OutputRegister): Promise<string> => {
  const { terminal } = register;
  if (terminal?.[0] !== 'R') {
    return Promise.reject();
  }

  const { matches, inputs } = terminal[1];
  if (inputs.length === 0) {
    return Promise.reject();
  }

  // One selected target: every match shares its key. Two matched targets are ambiguous.
  const keys = new Set(matches.map((match) => match[2]));
  if (keys.size !== 1) {
    return Promise.reject();
  }

  // Best fit: the exact-arity variant is the sole argDelta === 0 row (one variant per arity).
  const bestFit = matches.find((match) => match[4].argDelta === 0);
  if (bestFit !== undefined) {
    return Promise.resolve(bestFit[0]);
  }

  // Single-variant surplus: the lone row absorbs the extra arguments.
  const only = matches[0];
  if (matches.length === 1 && only !== undefined && only[4].argDelta > 0) {
    return Promise.resolve(only[0]);
  }

  return Promise.reject();
};

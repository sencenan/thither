// browser-client.md "Execution flow" step 4 / ADR 0009 — the destination to auto-navigate to,
// when the terminal is an `R` holding exactly one match with a nonnegative argument balance for
// a non-empty query; rejects otherwise. The match's destination is fully rendered (dsl.md §5),
// so it is the URL. `R.inputs` is the query the trailing `.$` consumed, so `<u> a b .set a b`
// navigates while `<u> home .set`, a blank open, and a focus-only search (focus is not part of
// `inputs`) all show the page.

import type { OutputRegister } from './browser-env.ts';

export const resolveNavigationDestination = (register: OutputRegister): Promise<string> => {
  const { terminal } = register;
  if (terminal?.[0] !== 'R') {
    return Promise.reject();
  }

  const { matches, inputs } = terminal[1];
  const match = matches[0];
  return matches.length === 1 && match !== undefined && match[4].argDelta >= 0 && inputs.length > 0
    ? Promise.resolve(match[0])
    : Promise.reject();
};

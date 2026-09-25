// browser-client.md "Execution flow" — the composition root and the whole run: wire the real
// browser world (localStorage, navigator.locks, location, document) into the interpreter,
// compose `.load <tokens> .$ .out .save` from the URL, execute it under the Web Lock, then
// navigate or render from the register. This is the client's one try/catch: an unavailable
// localStorage throws out of `.load`, and there is no execution or navigation without it, so it
// renders a bare error. Untested by design; the operations it composes are covered through
// `browser-env.ts` and the navigation rule through `navigation.ts`.

import { createInterpreter, type Program } from '../dsl/index.ts';
import { createBrowserEnv } from './browser-env.ts';
import { readInput } from './input.ts';
import { resolveNavigationDestination } from './navigation.ts';
import { renderView } from './view.ts';

const root = document.querySelector('#app');

if (root !== null) {
  const runWithLock = <T>(fn: () => T | Promise<T>): Promise<T> => {
    if ('locks' in navigator) {
      return navigator.locks.request('thither', fn);
    }
    // No `navigator.locks`: run without the lock rather than block a single-user operation.
    return Promise.resolve(fn());
  };

  const bareError = (message: string): void => {
    const line = document.createElement('p');
    line.textContent = message;
    root.replaceChildren(line);
  };

  const main = async (): Promise<void> => {
    const env = createBrowserEnv(localStorage);
    const interp = createInterpreter(env);
    const program = ['.load', ...readInput(location.href), '.$', '.out', '.save'].reduce<Program>(
      (acc, token) => interp.pushToken(acc, token),
      [],
    );

    return runWithLock(() => interp.execute(program)).then(() =>
      resolveNavigationDestination(env)
        .then((destination) => location.replace(destination))
        .catch(() => renderView(root, env)),
    );
  };

  main().catch((error: unknown) => {
    bareError(error instanceof Error ? error.message : String(error));
  });
}

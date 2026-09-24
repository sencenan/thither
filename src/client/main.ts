// browser-client.md "Execution flow" — the composition root. It wires the real browser world
// (localStorage, navigator.locks, location, document) into the interpreter and session, then
// runs the initial URL-driven program. This is the client's one try/catch: an unavailable
// localStorage throws out of `.load`, and there is no execution or navigation without it, so it
// renders a bare error. Untested by design; every seam it wires is covered elsewhere.

import { createInterpreter } from '../dsl/index.ts';
import { createBrowserEnv } from './browser-env.ts';
import { readInput } from './input.ts';
import { createSession, type LockRunner } from './session.ts';
import { renderView } from './view.ts';

const root = document.querySelector('#app');

if (root !== null) {
  const bareError = (message: string): void => {
    const line = document.createElement('p');
    line.textContent = message;
    root.replaceChildren(line);
  };

  const main = async (): Promise<void> => {
    const env = createBrowserEnv(localStorage);
    const interp = createInterpreter(env);

    const locks: LockRunner | undefined =
      'locks' in navigator
        ? { request: (name, callback) => navigator.locks.request(name, callback) }
        : undefined;

    const session = createSession({
      interp,
      register: env,
      locks,
      navigate: (url) => {
        location.replace(url);
      },
      render: (register) => {
        renderView(root, register);
      },
    });

    await session.run(readInput(location.href), 'initial');
  };

  main().catch((error: unknown) => {
    bareError(error instanceof Error ? error.message : String(error));
  });
}

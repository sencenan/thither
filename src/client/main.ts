// browser-client.md "Execution flow" — the composition root: wire the real browser world
// (localStorage, location, document) into the interpreter, run the URL's input, then navigate,
// or strip the consumed input from the URL and mount the fallback page. A nontrivial program
// (ADR 0015) is not run: only the stored world is loaded, and the page waits for Enter. This is
// the client's one try/catch for the page-load run: an unavailable localStorage throws out of
// `.load`, and there is no execution or navigation without it, so it renders a bare error.
// Untested by design; the operations it composes are covered through `browser-env.ts`, the run
// through `run.ts`, the navigation rule through `navigation.ts`, the classification through
// `program.ts`, and the page through `fallback-page.ts`.

import { createInterpreter } from '../dsl/index.ts';
import { baseState } from './base-state.ts';
import { createBrowserEnv } from './browser-env.ts';
import { mountFallbackPage } from './fallback-page.ts';
import { readInput, stripInput } from './input.ts';
import { resolveNavigationDestination } from './navigation.ts';
import { renderBareError } from './output.ts';
import { isNontrivial } from './program.ts';
import { load, run } from './run.ts';

// The release tag, or null outside a tag build; vite.config.ts `define`s it at build time.
declare const __THITHER_VERSION__: string | null;
const version = __THITHER_VERSION__ ?? 'dev';

const root = document.querySelector('#app');

if (root !== null) {
  // `async` so a throw out of `run` (or out of the `localStorage` getter) is a rejection too.
  const main = async (): Promise<void> => {
    const env = createBrowserEnv(localStorage, readInput(location.href), baseState(location.href));
    const interp = createInterpreter(env);

    // ADR 0015 — a nontrivial program waits for Enter, even from a URL.
    if (isNontrivial(interp, env.input)) {
      load(interp, env.base);
      history.replaceState(null, '', stripInput(location.href));
      mountFallbackPage(root, interp, env, localStorage, version);
      return;
    }

    run(interp, env.base, env.input);

    return resolveNavigationDestination(env)
      .then((destination) => location.replace(destination))
      .catch(() => {
        history.replaceState(null, '', stripInput(location.href));
        mountFallbackPage(root, interp, env, localStorage, version);
      });
  };

  main().catch((error: unknown) => {
    renderBareError(root, error);
  });
}

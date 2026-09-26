// browser-client.md "Execution flow" — the composition root: wire the real browser world
// (localStorage, location, document) into the interpreter, run the URL's input, then navigate,
// or strip the consumed input from the URL and mount the fallback page. This is the client's one
// try/catch for the page-load run: an unavailable localStorage throws out of `.load`, and there
// is no execution or navigation without it, so it renders a bare error. Untested by design; the
// operations it composes are covered through `browser-env.ts`, the run through `run.ts`, the
// navigation rule through `navigation.ts`, and the page through `fallback-page.ts`.

import { createInterpreter } from '../dsl/index.ts';
import { createBrowserEnv } from './browser-env.ts';
import { mountFallbackPage } from './fallback-page.ts';
import { readInput, stripInput } from './input.ts';
import { resolveNavigationDestination } from './navigation.ts';
import { renderBareError } from './output.ts';
import { run } from './run.ts';

const root = document.querySelector('#app');

if (root !== null) {
  // `async` so a throw out of `run` (or out of the `localStorage` getter) is a rejection too.
  const main = async (): Promise<void> => {
    const env = createBrowserEnv(localStorage, readInput(location.href));
    const interp = createInterpreter(env);
    run(interp, env.input);

    return resolveNavigationDestination(env)
      .then((destination) => location.replace(destination))
      .catch(() => {
        history.replaceState(null, '', stripInput(location.href));
        mountFallbackPage(root, interp, env);
      });
  };

  main().catch((error: unknown) => {
    renderBareError(root, error);
  });
}

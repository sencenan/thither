// browser-client.md "Fallback UI and settings" — the page shown when the page-load run did not
// navigate: the text field seeded with that run's input, live execution of the field's contents
// on a keystroke debounce, and the result list re-rendered from the register after each run.
// Live execution is the ordinary run — mutations and bounded history included. Nothing here
// consults the navigation rule; once the page is shown, navigation is by click or shortcut only.

import type { Interpreter } from '../dsl/index.ts';
import { debounce } from '../lib/debounce.ts';
import type { BrowserEnv } from './browser-env.ts';
import { tokenize } from './input.ts';
import { run } from './run.ts';
import { renderBareError, renderView } from './view.ts';

export const LIVE_EXECUTION_DEBOUNCE_MS = 60;

export interface FallbackPage {
  // Runs a pending debounce now, so the register reflects the field as typed; nothing pending,
  // nothing runs.
  flush(): void;
}

// browser-client.md "Fallback UI and settings" — a program ending in `.set` or `.rm` that ran to its
// search (an `R` in the register) has done its work; typing on would only re-run the mutation.
const MUTATIONS: ReadonlySet<string> = new Set(['.set', '.rm']);

const completedMutation = (tokens: readonly string[], env: BrowserEnv): boolean =>
  MUTATIONS.has(tokens.at(-1) ?? '') && env.terminal?.[0] === 'R';

const isPrintable = (event: KeyboardEvent): boolean =>
  event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey;

const isEditable = (target: EventTarget | null): boolean =>
  target instanceof HTMLInputElement ||
  target instanceof HTMLTextAreaElement ||
  (target instanceof HTMLElement && target.isContentEditable);

export const mountFallbackPage = (
  root: Element,
  interp: Interpreter,
  env: BrowserEnv,
): FallbackPage => {
  const doc = root.ownerDocument;

  const field = doc.createElement('input');
  field.type = 'text';
  field.autocomplete = 'off';
  field.spellcheck = false;
  field.value = completedMutation(env.input, env) ? '' : env.input.join(' ');

  const fieldRow = doc.createElement('div');
  fieldRow.className = 'field';
  fieldRow.appendChild(field);

  const results = doc.createElement('div');
  results.className = 'results';

  const render = (): void => {
    renderView(results, env);
  };

  // A run throws only when localStorage itself has gone; that ends the page, as at load.
  const liveRun = debounce(() => {
    try {
      const tokens = tokenize(field.value);
      run(interp, tokens);
      if (completedMutation(tokens, env)) {
        field.value = '';
      }
      render();
    } catch (error: unknown) {
      renderBareError(root, error);
    }
  }, LIVE_EXECUTION_DEBOUNCE_MS);

  field.addEventListener('input', () => {
    liveRun.schedule();
  });

  // Focus moves during keydown, so the browser inserts the character into the field itself.
  doc.addEventListener('keydown', (event) => {
    if (isPrintable(event) && !isEditable(event.target)) {
      field.focus();
    }
  });

  root.replaceChildren(fieldRow, results);
  render();

  field.focus();
  field.setSelectionRange(field.value.length, field.value.length);

  return { flush: liveRun.flush };
};

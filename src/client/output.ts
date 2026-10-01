// browser-client.md "Fallback UI" — what a run leaves behind, rendered. `renderOutput` draws the
// output register into the region beneath the field: an `E` as its `type` and `description`
// verbatim, then the match list's summary bar, the setup instructions (while the target set holds
// no target beyond the client base state's), and the list's rows, and the settings-reset hint when
// the stored data could not be loaded. `renderWaiting`
// draws a nontrivial program that has not run yet (ADR 0015). `renderBareError` is the other
// page: what an unavailable localStorage leaves, with no execution behind it.

import type { State, ThitherError } from '../dsl/index.ts';
import type { OutputRegister } from './browser-env.ts';
import { type KeyHint, renderKeyHints, renderMatchList } from './match-list.ts';
import { renderSetupInstructions, showsSetupInstructions } from './setup-instructions.ts';

const RESET_HINT = 'Recover in Settings: revert to an earlier stack, clear, or import one.';

const WAITING_NOTICE = 'Not run yet — press Enter to run';

const WAITING_HINTS: readonly KeyHint[] = [
  [
    ['key', 'Enter'],
    ['text', ' run'],
  ],
  [
    ['key', 'Esc'],
    ['text', ' clear'],
  ],
];

export const renderBareError = (root: Element, error: unknown): void => {
  const line = root.ownerDocument.createElement('p');
  line.textContent = error instanceof Error ? error.message : String(error);
  root.replaceChildren(line);
};

const renderError = (doc: Document, error: ThitherError): Node => {
  const [, { type, description }] = error;
  const line = doc.createElement('p');
  line.textContent = `${type}: ${description}`;
  return line;
};

// browser-client.md "Fallback UI" — the current focus, the dimensions added to every search until
// changed by `.@`, shown above the results so the user sees what every search is prefixed with.
// Absent when focus is empty, so an unfocused world stays uncluttered.
const renderFocus = (doc: Document, focus: readonly string[]): Node => {
  const bar = doc.createElement('p');
  bar.className = 'focus';
  const label = doc.createElement('span');
  label.className = 'focus-label';
  label.textContent = 'Focus';
  bar.append(label, ` ${focus.join(' ')}`);
  return bar;
};

const renderResetHint = (doc: Document): Node => {
  const hint = doc.createElement('p');
  hint.textContent = RESET_HINT;
  return hint;
};

// The focus the program would run under, so the user sees what it is prefixed with.
const focusNodes = (doc: Document, register: OutputRegister): Node[] => {
  const focus = register.state?.[1].focus ?? [];
  return focus.length > 0 ? [renderFocus(doc, focus)] : [];
};

export const renderOutput = (region: Element, register: OutputRegister, base: State): void => {
  const doc = region.ownerDocument;
  const nodes = focusNodes(doc, register);

  const { terminal } = register;
  if (terminal?.[0] === 'E') {
    nodes.push(renderError(doc, terminal));
  }

  // Beside the instructions the list shows only the client base state's targets, so with no
  // target at all there is nothing to list and no "No matches" to say. The first row starts
  // selected only when a query was searched (R.inputs non-empty, ADR 0009).
  const setup = showsSetupInstructions(register, base);
  const hasTargets = Object.keys(register.state?.[1].targets ?? {}).length > 0;
  const results =
    terminal?.[0] === 'R' && (!setup || hasTargets)
      ? renderMatchList(doc, terminal[1].matches, terminal[1].inputs.length > 0)
      : [];

  // A list with rows is its summary bar then its rows (match-list.ts). The bar stays directly
  // beneath the field, so the instructions go between it and the rows.
  const [summary, rows] =
    results.length > 1 ? [results[0], results.slice(1)] : [undefined, results];
  if (summary !== undefined) {
    nodes.push(summary);
  }
  if (setup) {
    nodes.push(renderSetupInstructions(doc, location.href));
  }
  nodes.push(...rows);

  if (!register.loaded) {
    nodes.push(renderResetHint(doc));
  }

  region.replaceChildren(...nodes);
};

// ADR 0015 — in place of the list, a bar saying the program has not run and how to run it, then
// the program itself. There are no rows, so nothing can be selected or opened while it waits.
export const renderWaiting = (region: Element, register: OutputRegister, program: Node): void => {
  const doc = region.ownerDocument;
  const nodes = focusNodes(doc, register);

  const footer = doc.createElement('footer');
  footer.className = 'waiting';
  const notice = doc.createElement('span');
  notice.className = 'count';
  notice.textContent = WAITING_NOTICE;
  footer.append(notice, renderKeyHints(doc, WAITING_HINTS));
  nodes.push(footer, program);

  if (!register.loaded) {
    nodes.push(renderResetHint(doc));
  }

  region.replaceChildren(...nodes);
};

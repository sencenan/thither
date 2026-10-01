// browser-client.md "Fallback UI" — what a run leaves behind, rendered. `renderOutput` draws the
// output register into the region beneath the field: an `E` as its `type` and `description`
// verbatim, then either the setup instructions (while the target set is empty) or the match
// list, and the settings-reset hint when the stored data could not be loaded. `renderWaiting`
// draws a nontrivial program that has not run yet (ADR 0015). `renderBareError` is the other
// page: what an unavailable localStorage leaves, with no execution behind it.

import type { ThitherError } from '../dsl/index.ts';
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

export const renderOutput = (region: Element, register: OutputRegister): void => {
  const doc = region.ownerDocument;
  const nodes = focusNodes(doc, register);

  const { terminal } = register;
  if (terminal?.[0] === 'E') {
    nodes.push(renderError(doc, terminal));
  }

  if (showsSetupInstructions(register)) {
    nodes.push(renderSetupInstructions(doc, location.href));
  } else if (terminal?.[0] === 'R') {
    // The first row starts selected only when a query was searched (R.inputs non-empty, ADR 0009).
    nodes.push(...renderMatchList(doc, terminal[1].matches, terminal[1].inputs.length > 0));
  }

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

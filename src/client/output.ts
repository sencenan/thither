// browser-client.md "Fallback UI" — what a run leaves behind, rendered. `renderOutput` draws the
// output register into the region beneath the field: an `E` as its `type` and `description`
// verbatim, then either the setup instructions (while the target set is empty) or the match
// list, and the settings-reset hint when the stored data could not be loaded. `renderBareError`
// is the other page: what an unavailable localStorage leaves, with no execution behind it.

import type { ThitherError } from '../dsl/index.ts';
import type { OutputRegister } from './browser-env.ts';
import { renderMatchList } from './match-list.ts';
import { renderSetupInstructions, showsSetupInstructions } from './setup-instructions.ts';

const RESET_HINT = 'Recover in Settings: revert to an earlier stack, clear, or import one.';

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

export const renderOutput = (region: Element, register: OutputRegister): void => {
  const doc = region.ownerDocument;
  const nodes: Node[] = [];

  const { terminal } = register;
  if (terminal?.[0] === 'E') {
    nodes.push(renderError(doc, terminal));
  }

  if (showsSetupInstructions(register)) {
    nodes.push(renderSetupInstructions(doc, location.href));
  } else if (terminal?.[0] === 'R') {
    nodes.push(...renderMatchList(doc, terminal[1].matches));
  }

  if (!register.loaded) {
    const hint = doc.createElement('p');
    hint.textContent = RESET_HINT;
    nodes.push(hint);
  }

  region.replaceChildren(...nodes);
};

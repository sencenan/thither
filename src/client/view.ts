// browser-client.md "Fallback UI" — the minimal skeleton render: an `R` becomes its matches as
// plain links in the order the core emits (the client never sorts); an `E` becomes its `type` and
// `description` verbatim. When the stored data could not be loaded, add the settings-reset hint.
// No styling, highlights, shortcuts, or setup instructions — those are S5. `renderBareError` is the
// other page: what an unavailable localStorage leaves, with no execution behind it.

import type { OutputRegister } from './browser-env.ts';

const RESET_HINT = 'Recovery is through the Settings reset.';

export const renderBareError = (root: Element, error: unknown): void => {
  const line = root.ownerDocument.createElement('p');
  line.textContent = error instanceof Error ? error.message : String(error);
  root.replaceChildren(line);
};

export const renderView = (root: Element, register: OutputRegister): void => {
  const doc = root.ownerDocument;
  const nodes: Node[] = [];

  const terminal = register.terminal;
  if (terminal?.[0] === 'R') {
    const { matches } = terminal[1];
    if (matches.length === 0) {
      const empty = doc.createElement('p');
      empty.textContent = 'No matches.';
      nodes.push(empty);
    } else {
      const list = doc.createElement('ul');
      for (const [destination, , key] of matches) {
        const item = doc.createElement('li');
        const link = doc.createElement('a');
        link.href = destination;
        link.textContent = key.length > 0 ? `${key} — ${destination}` : destination;
        item.appendChild(link);
        list.appendChild(item);
      }
      nodes.push(list);
    }
  } else if (terminal?.[0] === 'E') {
    const [, { type, description }] = terminal;
    const line = doc.createElement('p');
    line.textContent = `${type}: ${description}`;
    nodes.push(line);
  }

  if (!register.loaded) {
    const hint = doc.createElement('p');
    hint.textContent = RESET_HINT;
    nodes.push(hint);
  }

  root.replaceChildren(...nodes);
};

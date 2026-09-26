// browser-client.md "Fallback UI and settings" / "Bounded history" — the settings modal: the
// stack history newest first, a stack panel that shows a selected entry and takes a pasted one,
// and the three actions (revert, clear, import) plus the history limit, each acting directly on
// the stored record through `persistence.ts`. None is a program: nothing here searches or
// navigates. After an action the dialog closes and tells the page, which re-runs.

import type { Interpreter } from '../dsl/index.ts';
import {
  clearHistory,
  importStack,
  isHistoryLimit,
  readHistory,
  readSettings,
  revertHistory,
  type StackHistory,
  type StorageArea,
  writeSettings,
} from './persistence.ts';

export interface SettingsDialog {
  readonly element: HTMLDialogElement;
  // Re-reads the record and the settings, then shows the dialog.
  open(): void;
}

// Stored values are unvalidated (an import may have left an `E` on top), so the summary is read
// defensively: the target count of the nearest `S` from the top, and whether an `E` seals the stack.
const sigilOf = (value: unknown): string | undefined =>
  Array.isArray(value) && typeof value[0] === 'string' ? value[0] : undefined;

const targetCount = (value: unknown): number | undefined => {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const body: unknown = value[1];
  if (typeof body !== 'object' || body === null || !('targets' in body)) {
    return undefined;
  }
  const { targets } = body;
  return typeof targets === 'object' && targets !== null ? Object.keys(targets).length : undefined;
};

const nearestState = (stack: readonly unknown[]): unknown => {
  for (let index = stack.length - 1; index >= 0; index -= 1) {
    if (sigilOf(stack[index]) === 'S') {
      return stack[index];
    }
  }
  return undefined;
};

const summarize = (stack: readonly unknown[]): string => {
  const count = targetCount(nearestState(stack));
  const targets =
    count === undefined ? 'no state' : `${count} ${count === 1 ? 'target' : 'targets'}`;
  return sigilOf(stack.at(-1)) === 'E' ? `${targets} · E` : targets;
};

// browser-client.md "Fallback UI and settings" — the pasted text must be a JSON array of stack
// values; that the *values* are valid is not checked here (an invalid one is imported as its `E`).
type PastedStack = { readonly values: readonly unknown[] } | { readonly refusal: string };

const parseStackArray = (text: string): PastedStack => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error: unknown) {
    return { refusal: `Not JSON: ${error instanceof Error ? error.message : String(error)}` };
  }
  return Array.isArray(parsed)
    ? { values: parsed }
    : {
        refusal:
          'A stack is a JSON array of values, such as [["S", {"targets": {}, "focus": []}]].',
      };
};

const renderUnreadable = (doc: Document): Element => {
  const line = doc.createElement('p');
  line.className = 'unreadable';
  line.textContent = 'The stored record cannot be read. Clear it, or import a stack.';
  return line;
};

const renderEntry = (
  doc: Document,
  stack: readonly unknown[],
  isCurrent: boolean,
  onView: () => void,
  onRevert: () => void,
): Element => {
  const view = doc.createElement('button');
  view.type = 'button';
  view.className = 'view';
  view.textContent = summarize(stack);
  view.addEventListener('click', onView);

  const entry = doc.createElement('li');
  entry.className = isCurrent ? 'entry current' : 'entry';
  entry.appendChild(view);

  if (isCurrent) {
    const tag = doc.createElement('span');
    tag.className = 'tag';
    tag.textContent = 'current';
    entry.appendChild(tag);
  } else {
    const revert = doc.createElement('button');
    revert.type = 'button';
    revert.className = 'revert';
    revert.textContent = 'Revert';
    revert.addEventListener('click', onRevert);
    entry.appendChild(revert);
  }
  return entry;
};

const renderHistory = (
  doc: Document,
  history: StackHistory,
  onView: (stack: readonly unknown[]) => void,
  onRevert: (index: number) => void,
): Element => {
  const list = doc.createElement('ol');
  list.className = 'history';
  const current = history.length - 1;
  for (let index = current; index >= 0; index -= 1) {
    const stack = history[index];
    if (stack !== undefined) {
      list.appendChild(
        renderEntry(
          doc,
          stack,
          index === current,
          () => onView(stack),
          () => onRevert(index),
        ),
      );
    }
  }
  return list;
};

export const createSettingsDialog = (
  doc: Document,
  interp: Interpreter,
  storage: StorageArea,
  onAction: () => void,
): SettingsDialog => {
  const dialog = doc.createElement('dialog');
  dialog.className = 'settings';

  const title = doc.createElement('h2');
  title.textContent = 'Settings';

  const close = doc.createElement('button');
  close.type = 'button';
  close.className = 'close';
  close.textContent = 'Close';
  close.addEventListener('click', () => dialog.close());

  const header = doc.createElement('header');
  header.append(title, close);

  const historyHeading = doc.createElement('h3');
  historyHeading.textContent = 'History · newest first';

  const historyRegion = doc.createElement('div');
  historyRegion.className = 'entries';

  const limit = doc.createElement('input');
  limit.type = 'number';
  limit.min = '0';
  limit.step = '1';
  limit.title = 'Previous stacks kept besides the current one; 0 keeps none.';

  const limitLabel = doc.createElement('label');
  limitLabel.append('Limit ', limit);

  const saveLimit = doc.createElement('button');
  saveLimit.type = 'submit';
  saveLimit.className = 'save-limit';
  saveLimit.textContent = 'Save';

  const clear = doc.createElement('button');
  clear.type = 'button';
  clear.className = 'clear';
  clear.textContent = 'Clear everything';
  clear.title = 'Removes the stored record; the next run starts from scratch. Settings are kept.';

  // A form, so Enter in the limit field is Save and never reaches the page's Enter handling.
  // Native validation is off so every bad value gets the same message from `isHistoryLimit`
  // rather than a browser bubble for some and ours for the rest.
  const controls = doc.createElement('form');
  controls.className = 'controls';
  controls.noValidate = true;
  controls.append(limitLabel, saveLimit, clear);

  const historyColumn = doc.createElement('section');
  historyColumn.className = 'history-column';
  historyColumn.append(historyHeading, historyRegion, controls);

  const stackHeading = doc.createElement('h3');
  stackHeading.textContent = 'Stack';

  const panel = doc.createElement('textarea');
  panel.spellcheck = false;
  panel.placeholder =
    'Click a history entry to view it here, or paste a JSON stack array to import it: ' +
    '[["S", {"targets": {}, "focus": []}]]';

  const importButton = doc.createElement('button');
  importButton.type = 'button';
  importButton.className = 'import';
  importButton.textContent = 'Import';

  const importRow = doc.createElement('div');
  importRow.className = 'row';
  importRow.append(importButton);

  const stackColumn = doc.createElement('section');
  stackColumn.className = 'stack-column';
  stackColumn.append(stackHeading, panel, importRow);

  const columns = doc.createElement('div');
  columns.className = 'columns';
  columns.append(historyColumn, stackColumn);

  const notice = doc.createElement('p');
  notice.className = 'message';
  notice.setAttribute('role', 'alert');

  dialog.append(header, columns, notice);

  const view = (stack: readonly unknown[]): void => {
    panel.value = JSON.stringify(stack, null, 2);
  };

  // An action closes the dialog first, so the page's re-run renders to a page the user can see.
  const act = (action: () => void): void => {
    action();
    dialog.close();
    onAction();
  };

  const revert = (index: number): void => {
    act(() => revertHistory(storage, index));
  };

  clear.addEventListener('click', () => {
    act(() => clearHistory(storage));
  });

  controls.addEventListener('submit', (event) => {
    event.preventDefault();
    const value = limit.value.trim() === '' ? Number.NaN : Number(limit.value);
    if (!isHistoryLimit(value)) {
      notice.textContent = 'The history limit is a whole number, 0 or more.';
      return;
    }
    act(() => writeSettings(storage, { historyLimit: value }));
  });

  importButton.addEventListener('click', () => {
    const pasted = parseStackArray(panel.value);
    if ('refusal' in pasted) {
      notice.textContent = pasted.refusal;
      return;
    }
    act(() => importStack(interp, storage, pasted.values));
  });

  const refresh = (): void => {
    const history = readHistory(storage);
    historyRegion.replaceChildren(
      history === null ? renderUnreadable(doc) : renderHistory(doc, history, view, revert),
    );
    limit.value = String(readSettings(storage).historyLimit);
    panel.value = '';
    notice.textContent = '';
  };

  return {
    element: dialog,
    open: () => {
      refresh();
      dialog.showModal();
    },
  };
};

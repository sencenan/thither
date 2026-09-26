// @vitest-environment happy-dom

// browser-client.md "Fallback UI and settings" / "Bounded history" — the settings modal: the
// history listed newest first with the current stack on top, an entry's JSON shown in the stack
// panel on click, and the three actions plus the history limit wired to `persistence.ts`. The
// actions themselves are fixture-covered there; these tests check what the modal calls with what,
// what it shows, and when it closes.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createInterpreter } from '../../dsl/index.ts';
import { createBrowserEnv } from '../browser-env.ts';
import type { StorageArea } from '../persistence.ts';
import { createSettingsDialog } from '../settings.ts';

const STACKS_KEY = 'thither.stacks.v1';
const SETTINGS_KEY = 'thither.settings.v1';

const fakeStorage = (initial: Record<string, string> = {}): StorageArea => {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value);
    },
    removeItem: (key) => {
      map.delete(key);
    },
  };
};

const state = (targets: Record<string, readonly string[]>) => ['S', { targets, focus: [] }];

// Oldest first: no targets, then `home`, then `home` + `docs` (the current stack).
const threeDeep = [
  [state({})],
  [state({ home: ['https://example.com/'] })],
  [state({ home: ['https://example.com/'], docs: ['https://example.com/docs/{}'] })],
];
const threeDeepRecord = JSON.stringify(threeDeep);

let host: HTMLElement;

beforeEach(() => {
  document.body.innerHTML = '<div id="app"></div>';
  const app = document.querySelector('#app');
  if (!(app instanceof HTMLElement)) {
    throw new Error('missing #app');
  }
  host = app;
});

const mount = (storage: StorageArea, onAction = vi.fn()) => {
  const interp = createInterpreter(createBrowserEnv(storage));
  const dialog = createSettingsDialog(document, interp, storage, onAction);
  host.appendChild(dialog.element);
  return { dialog, onAction };
};

const rows = (dialog: HTMLDialogElement): HTMLLIElement[] => [...dialog.querySelectorAll('li')];

describe('the history list ("newest first, the current stack at the top")', () => {
  it('opening lists every entry newest first, the current one on top and marked, each with its target count', () => {
    const { dialog } = mount(fakeStorage({ [STACKS_KEY]: threeDeepRecord }));

    dialog.open();

    expect(dialog.element.open).toBe(true);
    const entries = rows(dialog.element);
    expect(entries.map((li) => li.textContent)).toEqual([
      '2 targetscurrent',
      '1 targetRevert',
      '0 targetsRevert',
    ]);
    expect(entries.map((li) => li.classList.contains('current'))).toEqual([true, false, false]);
  });

  it('a stack sealed by an E (an import that failed to parse) carries an E marker beside the count of the S beneath', () => {
    const sealed = [
      [state({ home: ['https://example.com/'] })],
      [
        state({ home: ['https://example.com/'] }),
        ['E', { type: 'parse_error', description: 'not a value' }],
      ],
    ];
    const { dialog } = mount(fakeStorage({ [STACKS_KEY]: JSON.stringify(sealed) }));

    dialog.open();

    expect(rows(dialog.element).map((li) => li.textContent)).toEqual([
      '1 target · Ecurrent',
      '1 targetRevert',
    ]);
  });

  it('a stack with no recognizable S reads as such rather than as zero targets', () => {
    const record = [[['E', { type: 'parse_error', description: 'not a value' }]]];
    const { dialog } = mount(fakeStorage({ [STACKS_KEY]: JSON.stringify(record) }));

    dialog.open();

    expect(rows(dialog.element).map((li) => li.textContent)).toEqual(['no state · Ecurrent']);
  });
});

const panel = (dialog: HTMLDialogElement): HTMLTextAreaElement => {
  const textarea = dialog.querySelector('textarea');
  if (textarea === null) {
    throw new Error('the dialog has no stack panel');
  }
  return textarea;
};

const click = (element: Element | null | undefined): void => {
  if (!(element instanceof HTMLElement)) {
    throw new Error('nothing to click');
  }
  element.click();
};

describe('the stack panel ("selecting one shows its JSON in a stack panel beside the list")', () => {
  it('opens with an empty panel; clicking an entry shows that stack as JSON, and nothing is written', () => {
    const storage = fakeStorage({ [STACKS_KEY]: threeDeepRecord });
    const { dialog, onAction } = mount(storage);
    dialog.open();
    expect(panel(dialog.element).value).toBe('');

    click(rows(dialog.element)[1]?.querySelector('.view'));

    expect(JSON.parse(panel(dialog.element).value)).toEqual(threeDeep[1]);
    expect(storage.getItem(STACKS_KEY)).toBe(threeDeepRecord);
    expect(dialog.element.open).toBe(true);
    expect(onAction).not.toHaveBeenCalled();
  });
});

describe('revert ("drops every entry newer than it, so the selected stack is the last")', () => {
  it('Revert on the oldest entry truncates the record to it, closes the dialog, then reports', () => {
    const storage = fakeStorage({ [STACKS_KEY]: threeDeepRecord });
    const { dialog, onAction } = mount(storage);
    dialog.open();

    click(rows(dialog.element)[2]?.querySelector('.revert'));

    expect(JSON.parse(storage.getItem(STACKS_KEY) ?? 'null')).toEqual([threeDeep[0]]);
    expect(dialog.element.open).toBe(false);
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('the current entry has no Revert button', () => {
    const { dialog } = mount(fakeStorage({ [STACKS_KEY]: threeDeepRecord }));
    dialog.open();

    expect(rows(dialog.element)[0]?.querySelector('.revert')).toBeNull();
  });
});

describe('clear ("removes the record outright … Settings are kept")', () => {
  it('Clear removes the stacks record, keeps the settings record, closes, then reports', () => {
    const storage = fakeStorage({
      [STACKS_KEY]: threeDeepRecord,
      [SETTINGS_KEY]: '{"historyLimit":3}',
    });
    const { dialog, onAction } = mount(storage);
    dialog.open();

    click(dialog.element.querySelector('.clear'));

    expect(storage.getItem(STACKS_KEY)).toBeNull();
    expect(storage.getItem(SETTINGS_KEY)).toBe('{"historyLimit":3}');
    expect(dialog.element.open).toBe(false);
    expect(onAction).toHaveBeenCalledTimes(1);
  });
});

const message = (dialog: HTMLDialogElement): string =>
  dialog.querySelector('[role="alert"]')?.textContent ?? '';

describe('import ("accepts a JSON stack array directly \u2026 appended as the last entry")', () => {
  it('Import pushes the pasted stack through the interpreter and appends it as the current entry', () => {
    const storage = fakeStorage({ [STACKS_KEY]: threeDeepRecord });
    const { dialog, onAction } = mount(storage);
    dialog.open();

    panel(dialog.element).value =
      '[["S", {"targets": {"Docs": ["https://example.com/d"]}, "focus": []}]]';
    click(dialog.element.querySelector('.import'));

    expect(JSON.parse(storage.getItem(STACKS_KEY) ?? 'null')).toEqual([
      ...threeDeep,
      [state({ docs: ['https://example.com/d'] })],
    ]);
    expect(dialog.element.open).toBe(false);
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['text that is not JSON', '[["S", {'],
    ['JSON that is not an array', '{"targets": {}}'],
  ])('%s is a modal-level message: nothing is written and the dialog stays open', (_name, text) => {
    const storage = fakeStorage({ [STACKS_KEY]: threeDeepRecord });
    const { dialog, onAction } = mount(storage);
    dialog.open();

    panel(dialog.element).value = text;
    click(dialog.element.querySelector('.import'));

    expect(message(dialog.element)).not.toBe('');
    expect(storage.getItem(STACKS_KEY)).toBe(threeDeepRecord);
    expect(dialog.element.open).toBe(true);
    expect(onAction).not.toHaveBeenCalled();
    expect(panel(dialog.element).value).toBe(text);
  });

  it('a value that fails to parse is imported as the E it parses to, not refused ("Import does not validate")', () => {
    const storage = fakeStorage({ [STACKS_KEY]: threeDeepRecord });
    const { dialog } = mount(storage);
    dialog.open();

    panel(dialog.element).value = '[["S", {"targets": {}, "focus": []}], ["X"]]';
    click(dialog.element.querySelector('.import'));

    const record: unknown[] = JSON.parse(storage.getItem(STACKS_KEY) ?? 'null');
    expect(record).toHaveLength(4);
    const imported = record[3];
    expect(Array.isArray(imported) && imported.length === 2).toBe(true);
    expect(Array.isArray(imported) && imported[1]?.[0]).toBe('E');
    expect(dialog.element.open).toBe(false);
  });
});

describe('closing without an action', () => {
  it('Close shuts the dialog, writes nothing, and reports nothing', () => {
    const storage = fakeStorage({ [STACKS_KEY]: threeDeepRecord });
    const { dialog, onAction } = mount(storage);
    dialog.open();

    click(dialog.element.querySelector('.close'));

    expect(dialog.element.open).toBe(false);
    expect(storage.getItem(STACKS_KEY)).toBe(threeDeepRecord);
    expect(onAction).not.toHaveBeenCalled();
  });

  it('reopening re-reads the record and starts from a clean panel and message', () => {
    const storage = fakeStorage({ [STACKS_KEY]: threeDeepRecord });
    const { dialog } = mount(storage);
    dialog.open();
    panel(dialog.element).value = 'junk';
    click(dialog.element.querySelector('.import'));
    expect(message(dialog.element)).not.toBe('');
    click(dialog.element.querySelector('.close'));

    storage.setItem(STACKS_KEY, JSON.stringify([threeDeep[0]]));
    dialog.open();

    expect(rows(dialog.element)).toHaveLength(1);
    expect(panel(dialog.element).value).toBe('');
    expect(message(dialog.element)).toBe('');
  });
});

describe('an unreadable record ("say so in place of the list and offer clear and import only")', () => {
  it('shows a line in place of the list; Clear and Import stay, Revert is gone', () => {
    const storage = fakeStorage({ [STACKS_KEY]: 'not json' });
    const { dialog, onAction } = mount(storage);
    dialog.open();

    expect(rows(dialog.element)).toEqual([]);
    expect(dialog.element.querySelector('.history-column')?.textContent).toMatch(/cannot be read/i);
    expect(dialog.element.querySelector('.revert')).toBeNull();
    expect(dialog.element.querySelector('.clear')).not.toBeNull();
    expect(dialog.element.querySelector('.import')).not.toBeNull();

    panel(dialog.element).value = '[["S", {"targets": {}, "focus": []}]]';
    click(dialog.element.querySelector('.import'));

    expect(JSON.parse(storage.getItem(STACKS_KEY) ?? 'null')).toEqual([[state({})]]);
    expect(onAction).toHaveBeenCalledTimes(1);
  });
});

const limitField = (dialog: HTMLDialogElement): HTMLInputElement => {
  const input = dialog.querySelector('input');
  if (input === null) {
    throw new Error('the dialog has no limit field');
  }
  return input;
};

describe('the history limit ("accepts nonnegative integers; 0 retains only the current stack")', () => {
  it('shows the stored limit, and the default when none is stored', () => {
    const { dialog: stored } = mount(fakeStorage({ [SETTINGS_KEY]: '{"historyLimit":3}' }));
    stored.open();
    expect(limitField(stored.element).value).toBe('3');
    stored.element.close();

    const { dialog: fresh } = mount(fakeStorage());
    fresh.open();
    expect(limitField(fresh.element).value).toBe('10');
  });

  it('Save writes the typed limit, closes, then reports', () => {
    const storage = fakeStorage();
    const { dialog, onAction } = mount(storage);
    dialog.open();

    limitField(dialog.element).value = '0';
    click(dialog.element.querySelector('.save-limit'));

    expect(JSON.parse(storage.getItem(SETTINGS_KEY) ?? 'null')).toEqual({ historyLimit: 0 });
    expect(dialog.element.open).toBe(false);
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('Enter in the limit field saves too, and does not leave the dialog to the page', () => {
    const storage = fakeStorage();
    const { dialog } = mount(storage);
    dialog.open();

    const field = limitField(dialog.element);
    field.value = '4';
    field.form?.requestSubmit();

    expect(JSON.parse(storage.getItem(SETTINGS_KEY) ?? 'null')).toEqual({ historyLimit: 4 });
    expect(dialog.element.open).toBe(false);
  });

  it.each([['-1'], ['2.5'], ['ten'], ['']])(
    '%j is refused with a message; nothing is written and the dialog stays open',
    (text) => {
      const storage = fakeStorage();
      const { dialog, onAction } = mount(storage);
      dialog.open();

      limitField(dialog.element).value = text;
      click(dialog.element.querySelector('.save-limit'));

      expect(message(dialog.element)).not.toBe('');
      expect(storage.getItem(SETTINGS_KEY)).toBeNull();
      expect(dialog.element.open).toBe(true);
      expect(onAction).not.toHaveBeenCalled();
    },
  );
});

// @vitest-environment happy-dom

// browser-client.md "Fallback UI and settings" — the text field and live execution: the field
// is seeded from the run's input and owns the keyboard; editing re-runs the ordinary program on
// a 60 ms debounce and re-renders from the register; live runs never navigate. Navigation from
// the page is by click, `Ctrl+digit`, or Enter on a row; navigating in happy-dom only moves
// `location.href`, which every test starts from `PAGE`.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createInterpreter } from '../../dsl/index.ts';
import { createBrowserEnv } from '../browser-env.ts';
import { mountFallbackPage } from '../fallback-page.ts';
import type { StorageArea } from '../persistence.ts';
import { run } from '../run.ts';

const STACKS_KEY = 'thither.stacks.v1';

// `writes` counts `setItem` calls; setting `unavailable` makes every access throw, as a
// localStorage that has gone away does.
const fakeStorage = (
  initial: Record<string, string> = {},
): StorageArea & { writes: number; unavailable: boolean } => {
  const map = new Map(Object.entries(initial));
  const storage = {
    writes: 0,
    unavailable: false,
    getItem: (key: string) => {
      if (storage.unavailable) {
        throw new Error('localStorage is unavailable');
      }
      return map.get(key) ?? null;
    },
    setItem: (key: string, value: string) => {
      storage.writes += 1;
      map.set(key, value);
    },
    removeItem: (key: string) => {
      map.delete(key);
    },
  };
  return storage;
};

const oneTargetRecord = JSON.stringify([
  [['S', { targets: { home: ['https://example.com/'] }, focus: [] }]],
]);

// `t01` … `t11`, each to `https://example.com/tNN`, in target-set order.
const elevenTargetsRecord = JSON.stringify([
  [
    [
      'S',
      {
        targets: Object.fromEntries(
          Array.from({ length: 11 }, (_, i) => {
            const name = `t${String(i + 1).padStart(2, '0')}`;
            return [name, [`https://example.com/${name}`]];
          }),
        ),
        focus: [],
      },
    ],
  ],
]);

const PAGE = location.href;

let root: HTMLElement;

beforeEach(() => {
  vi.useFakeTimers();
  location.replace(PAGE);
  document.body.innerHTML = '<div id="app"></div>';
  const app = document.querySelector('#app');
  if (!(app instanceof HTMLElement)) {
    throw new Error('missing #app');
  }
  root = app;
});

afterEach(() => {
  vi.useRealTimers();
});

// The page as main.ts shows it: the page-load run has executed and did not navigate.
const open = (storage: StorageArea, input: readonly string[]) => {
  const env = createBrowserEnv(storage, input);
  const interp = createInterpreter(env);
  run(interp, input);
  const page = mountFallbackPage(root, interp, env, storage);
  const field = root.querySelector('.field input');
  if (!(field instanceof HTMLInputElement)) {
    throw new Error('the page has no text field');
  }
  return { env, page, field };
};

const settingsDialog = (): HTMLDialogElement => {
  const dialog = root.querySelector('dialog');
  if (dialog === null) {
    throw new Error('the page has no settings dialog');
  }
  return dialog;
};

const click = (element: Element | null | undefined): void => {
  if (!(element instanceof HTMLElement)) {
    throw new Error('nothing to click');
  }
  element.click();
};

const type = (field: HTMLInputElement, text: string): void => {
  field.value = text;
  field.dispatchEvent(new Event('input', { bubbles: true }));
};

const links = (): string[] =>
  [...root.querySelectorAll('a')].map((a) => a.getAttribute('href') ?? '');

describe('the text field', () => {
  it('is seeded from env.input, focused, with the caret at the end', () => {
    const { field } = open(fakeStorage(), ['company', 'git']);

    expect(field.value).toBe('company git');
    expect(document.activeElement).toBe(field);
    expect(field.selectionStart).toBe('company git'.length);
    expect(field.selectionEnd).toBe('company git'.length);
  });

  it('mounting renders the page-load run from the register without executing again', () => {
    const storage = fakeStorage({ [STACKS_KEY]: oneTargetRecord });
    const before = storage.writes;
    open(storage, ['zzz']);

    expect(root.textContent).toContain('No matches');
    expect(storage.writes).toBe(before + 1);
  });
});

describe('the Settings control ("Provide a Settings control on the page, opening a modal dialog")', () => {
  it('the gear beside the field opens the dialog over the page', () => {
    open(fakeStorage({ [STACKS_KEY]: oneTargetRecord }), []);
    expect(settingsDialog().open).toBe(false);

    click(root.querySelector('.field .settings-control'));

    expect(settingsDialog().open).toBe(true);
    expect(settingsDialog().textContent).toContain('1 target');
  });

  const twoDeepRecord = JSON.stringify([
    [['S', { targets: {}, focus: [] }]],
    [['S', { targets: { home: ['https://example.com/'] }, focus: [] }]],
  ]);

  it('"After an action the modal closes and the page re-runs the field\'s current contents": a revert shows the reverted stack', () => {
    const storage = fakeStorage({ [STACKS_KEY]: twoDeepRecord });
    const { field } = open(storage, ['home']);
    expect(links()).toEqual(['https://example.com/']);
    click(root.querySelector('.settings-control'));

    click(settingsDialog().querySelector('.revert'));

    expect(settingsDialog().open).toBe(false);
    expect(links()).toEqual([]);
    expect(root.textContent).toContain('No targets yet');
    expect(field.value).toBe('home');
    expect(document.activeElement).toBe(field);
  });

  it('a clear re-runs against first initialization, which the run then persists', () => {
    const storage = fakeStorage({ [STACKS_KEY]: twoDeepRecord });
    open(storage, []);
    click(root.querySelector('.settings-control'));

    click(settingsDialog().querySelector('.clear'));

    expect(root.textContent).toContain('No targets yet');
    expect(JSON.parse(storage.getItem(STACKS_KEY) ?? 'null')).toEqual([
      [['S', { targets: {}, focus: [] }]],
    ]);
  });

  describe('the keyboard while the dialog is open ("Neither may open a row while the dialog is open")', () => {
    it('Ctrl+1 opens nothing', () => {
      open(fakeStorage({ [STACKS_KEY]: elevenTargetsRecord }), ['t0']);
      click(root.querySelector('.settings-control'));

      keydown(settingsDialog(), { key: '1', code: 'Digit1', ctrlKey: true });

      expect(location.href).toBe(PAGE);
    });

    it("Enter outside the dialog's editables opens nothing, and is not prevented", () => {
      open(fakeStorage({ [STACKS_KEY]: elevenTargetsRecord }), ['t0']);
      click(root.querySelector('.settings-control'));
      const event = new KeyboardEvent('keydown', {
        bubbles: true,
        cancelable: true,
        key: 'Enter',
        code: 'Enter',
      });

      settingsDialog().dispatchEvent(event);

      expect(location.href).toBe(PAGE);
      expect(event.defaultPrevented).toBe(false);
    });

    it('a printable key does not pull focus back to the field', () => {
      const { field } = open(fakeStorage({ [STACKS_KEY]: oneTargetRecord }), []);
      click(root.querySelector('.settings-control'));
      const textarea = settingsDialog().querySelector('textarea');
      textarea?.focus();
      expect(document.activeElement).toBe(textarea);

      keydown(settingsDialog(), { key: 'a', code: 'KeyA' });

      expect(document.activeElement).not.toBe(field);
    });
  });

  it('closing without an action re-runs nothing and refocuses the field', () => {
    const storage = fakeStorage({ [STACKS_KEY]: oneTargetRecord });
    const { field } = open(storage, []);
    const before = storage.writes;
    click(root.querySelector('.settings-control'));
    field.blur();

    click(settingsDialog().querySelector('.close'));

    expect(storage.writes).toBe(before);
    expect(document.activeElement).toBe(field);
  });
});

describe('live execution ("triggers live execution after a 60 ms keystroke debounce")', () => {
  it('re-runs the field 60 ms after the edit, not before, through the ordinary flow', () => {
    const storage = fakeStorage();
    const { field } = open(storage, []);
    const before = storage.writes;

    type(field, 'https://example.com/ home .set');
    vi.advanceTimersByTime(59);
    expect(storage.writes).toBe(before);
    expect(links()).toEqual([]);

    vi.advanceTimersByTime(1);
    expect(links()).toEqual(['https://example.com/']);
    expect(JSON.parse(storage.getItem(STACKS_KEY) ?? 'null')).toEqual([
      [['S', { targets: {}, focus: [] }]],
      [['S', { targets: { home: ['https://example.com/'] }, focus: [] }]],
    ]);
  });

  it('each keystroke restarts the delay, so a burst of edits runs once', () => {
    const storage = fakeStorage();
    const { field } = open(storage, []);
    const before = storage.writes;

    type(field, 'https://example.com/ ho');
    vi.advanceTimersByTime(40);
    type(field, 'https://example.com/ home .set');
    vi.advanceTimersByTime(40);
    expect(storage.writes).toBe(before);

    vi.advanceTimersByTime(20);
    expect(storage.writes).toBe(before + 1);
    expect(links()).toEqual(['https://example.com/']);
  });

  it('a live run with a single complete match and a query is listed, never navigated to', () => {
    const { field } = open(fakeStorage({ [STACKS_KEY]: oneTargetRecord }), ['zzz']);
    const href = location.href;
    expect(links()).toEqual([]);

    type(field, 'home');
    vi.advanceTimersByTime(60);

    expect(links()).toEqual(['https://example.com/']);
    expect(location.href).toBe(href);
    expect(document.activeElement).toBe(field);
  });

  it('a live E replaces the list beneath the field', () => {
    const { field } = open(fakeStorage({ [STACKS_KEY]: oneTargetRecord }), ['home']);
    expect(links()).toEqual(['https://example.com/']);

    type(field, 'git .set');
    vi.advanceTimersByTime(60);

    expect(links()).toEqual([]);
    expect(root.textContent).toContain('invalid_destination');
    expect(root.querySelector('input')).toBe(field);
  });
});

describe('a completed mutation empties the field ("a program ending in `.set` or `.rm` that ran to its search leaves the field empty")', () => {
  it('a live .set that ran to its search clears the field; the list shows every target', () => {
    const { field } = open(fakeStorage(), []);

    type(field, 'https://example.com/ home .set');
    vi.advanceTimersByTime(60);

    expect(field.value).toBe('');
    expect(links()).toEqual(['https://example.com/']);
    expect(document.activeElement).toBe(field);
  });

  it('a live .rm that ran to its search clears the field', () => {
    const { field } = open(fakeStorage({ [STACKS_KEY]: oneTargetRecord }), []);

    type(field, 'home .rm');
    vi.advanceTimersByTime(60);

    expect(field.value).toBe('');
    expect(links()).toEqual([]);
  });

  it('a mutation that errored keeps its text, so it can be corrected', () => {
    const { field } = open(fakeStorage({ [STACKS_KEY]: oneTargetRecord }), []);

    type(field, 'git .set');
    vi.advanceTimersByTime(60);

    expect(field.value).toBe('git .set');
    expect(root.textContent).toContain('invalid_destination');
  });

  it.each([
    ['a search', 'home'],
    ['a focus', 'home .@'],
    ['a mutation followed by a search', 'https://example.com/ home .set home'],
  ])('%s keeps its text', (_name, program) => {
    const { field } = open(fakeStorage({ [STACKS_KEY]: oneTargetRecord }), []);

    type(field, program);
    vi.advanceTimersByTime(60);

    expect(field.value).toBe(program);
  });

  it('the page-load run is treated the same: `?q=<url> home .set` opens with an empty field', () => {
    const { field } = open(fakeStorage(), ['https://example.com/', 'home', '.set']);

    expect(field.value).toBe('');
    expect(links()).toEqual(['https://example.com/']);
  });

  it('a page-load mutation that errored seeds the field with the program', () => {
    const { field } = open(fakeStorage(), ['git', '.set']);

    expect(field.value).toBe('git .set');
  });
});

describe('setup instructions ("While the target set is empty … They disappear once the target set is non-empty")', () => {
  it('a fresh profile shows the shortcut template for this page, and the first .set removes them', () => {
    const page = `${location.origin}/thither/`;
    history.replaceState(null, '', `${page}?x=1`);
    const { field } = open(fakeStorage(), []);

    expect(root.textContent).toContain(`${page}?q=%s`);
    expect(root.textContent).not.toContain(`${page}#q=%s`);
    expect(links()).toEqual([]);

    type(field, 'https://example.com/ home .set');
    vi.advanceTimersByTime(60);

    expect(root.textContent).not.toContain('?q=%s');
    expect(links()).toEqual(['https://example.com/']);
  });

  it('a page opened on a non-empty target set never shows them', () => {
    open(fakeStorage({ [STACKS_KEY]: oneTargetRecord }), []);

    expect(root.textContent).not.toContain('?q=%s');
    expect(links()).toEqual(['https://example.com/']);
  });
});

const keydown = (target: EventTarget, init: KeyboardEventInit): void => {
  target.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init }));
};

const helpDialog = (): HTMLDialogElement => {
  const dialog = root.querySelector('dialog.help');
  if (!(dialog instanceof HTMLDialogElement)) {
    throw new Error('the page has no help dialog');
  }
  return dialog;
};

describe('the Help control', () => {
  it('the ? button beside the field opens the Help dialog', () => {
    open(fakeStorage(), []);
    expect(helpDialog().open).toBe(false);

    click(root.querySelector('.field .help-control'));

    expect(helpDialog().open).toBe(true);
    expect(helpDialog().textContent).toContain('Usage');
  });

  it('both field controls render an SVG icon, so they match in size', () => {
    open(fakeStorage(), []);

    expect(root.querySelector('.field .help-control svg')).not.toBeNull();
    expect(root.querySelector('.field .settings-control svg')).not.toBeNull();
  });

  it('shows the thither wordmark above the field', () => {
    open(fakeStorage(), []);

    expect(root.querySelector('.brand .brand-name')?.textContent).toBe('thither');
  });

  it('the keyboard bails while Help is open: Ctrl+1 opens nothing', () => {
    open(fakeStorage({ [STACKS_KEY]: elevenTargetsRecord }), ['t0']);
    click(root.querySelector('.field .help-control'));

    keydown(helpDialog(), { key: '1', code: 'Digit1', ctrlKey: true });

    expect(location.href).toBe(PAGE);
  });

  it('closing Help refocuses the field', () => {
    const { field } = open(fakeStorage(), []);
    click(root.querySelector('.field .help-control'));
    field.blur();

    helpDialog().close();

    expect(document.activeElement).toBe(field);
  });
});

describe('the field owns the keyboard ("a printable key pressed while it is not focused returns focus to it")', () => {
  it('a printable key pressed elsewhere refocuses the field', () => {
    const { field } = open(fakeStorage(), []);
    field.blur();
    expect(document.activeElement).not.toBe(field);

    keydown(document.body, { key: 'a', code: 'KeyA' });

    expect(document.activeElement).toBe(field);
  });

  const ignored: ReadonlyArray<readonly [name: string, init: KeyboardEventInit]> = [
    ['an arrow key', { key: 'ArrowDown', code: 'ArrowDown' }],
    ['a Ctrl chord', { key: '1', code: 'Digit1', ctrlKey: true }],
    ['a Meta chord', { key: 'a', code: 'KeyA', metaKey: true }],
    ['an Alt chord', { key: 'a', code: 'KeyA', altKey: true }],
  ];

  it.each(ignored)('%s does not refocus the field', (_name, init) => {
    const { field } = open(fakeStorage(), []);
    field.blur();

    keydown(document.body, init);

    expect(document.activeElement).not.toBe(field);
  });

  it('Escape clears the field, refocuses it, and re-runs', () => {
    const { field } = open(fakeStorage(), ['company', 'git']);
    expect(field.value).toBe('company git');
    field.blur();

    keydown(document.body, { key: 'Escape', code: 'Escape' });

    expect(field.value).toBe('');
    expect(document.activeElement).toBe(field);
  });

  it('typing in another editable element is left alone', () => {
    const { field } = open(fakeStorage(), []);
    const other = document.createElement('textarea');
    document.body.appendChild(other);
    other.focus();

    keydown(other, { key: 'a', code: 'KeyA' });

    expect(document.activeElement).toBe(other);
    expect(field).not.toBe(document.activeElement);
  });
});

describe('flush ("a pending debounce is run first, so Enter acts on what was typed")', () => {
  it('runs a pending debounce now, once', () => {
    const storage = fakeStorage();
    const { field, page } = open(storage, []);
    const before = storage.writes;

    type(field, 'https://example.com/ home .set');
    page.flush();

    expect(storage.writes).toBe(before + 1);
    expect(links()).toEqual(['https://example.com/']);

    vi.advanceTimersByTime(60);
    expect(storage.writes).toBe(before + 1);
  });

  it('with nothing pending it executes nothing: a settled mutation is not repeated', () => {
    const storage = fakeStorage();
    const { field, page } = open(storage, []);

    type(field, 'https://example.com/ home .set');
    vi.advanceTimersByTime(60);
    const before = storage.writes;

    page.flush();

    expect(storage.writes).toBe(before);
  });
});

describe('an unavailable localStorage ("caught once … rendered as a bare error page")', () => {
  it('a live run that throws replaces the page with the bare error', () => {
    const storage = fakeStorage();
    const { field } = open(storage, []);

    storage.unavailable = true;
    type(field, 'home');
    expect(() => vi.advanceTimersByTime(60)).not.toThrow();

    expect(root.textContent).toBe('localStorage is unavailable');
    expect(root.querySelector('input')).toBeNull();
  });

  it('the bare error page releases the keyboard: Ctrl+1 opens nothing', () => {
    const storage = fakeStorage({ [STACKS_KEY]: elevenTargetsRecord });
    const { field } = open(storage, []);
    expect(links()).toHaveLength(11);

    storage.unavailable = true;
    type(field, 'x');
    vi.advanceTimersByTime(60);
    keydown(document.body, { key: '1', code: 'Digit1', ctrlKey: true });

    expect(location.href).toBe(PAGE);
  });
});

describe('shortcuts ("navigation shortcuts Ctrl+1 through Ctrl+9, then Ctrl+0 for the tenth, active whether or not the text field has focus")', () => {
  it('Ctrl+2 with the field focused opens the second row', () => {
    const { field } = open(fakeStorage({ [STACKS_KEY]: elevenTargetsRecord }), []);
    expect(document.activeElement).toBe(field);

    keydown(field, { key: '2', code: 'Digit2', ctrlKey: true });

    expect(location.href).toBe('https://example.com/t02');
  });

  it('Ctrl+2 with the field blurred opens the same row', () => {
    const { field } = open(fakeStorage({ [STACKS_KEY]: elevenTargetsRecord }), []);
    field.blur();

    keydown(document.body, { key: '2', code: 'Digit2', ctrlKey: true });

    expect(location.href).toBe('https://example.com/t02');
  });

  it('a numpad digit is read by code too', () => {
    open(fakeStorage({ [STACKS_KEY]: elevenTargetsRecord }), []);

    keydown(document.body, { key: '3', code: 'Numpad3', ctrlKey: true });

    expect(location.href).toBe('https://example.com/t03');
  });

  it('Ctrl+0 opens the tenth row', () => {
    open(fakeStorage({ [STACKS_KEY]: elevenTargetsRecord }), []);

    keydown(document.body, { key: '0', code: 'Digit0', ctrlKey: true });

    expect(location.href).toBe('https://example.com/t10');
  });

  it('a digit past the last row opens nothing', () => {
    open(fakeStorage({ [STACKS_KEY]: oneTargetRecord }), []);
    expect(links()).toHaveLength(1);

    keydown(document.body, { key: '2', code: 'Digit2', ctrlKey: true });

    expect(location.href).toBe(PAGE);
  });

  it('a plain digit is typing, not a shortcut', () => {
    const { field } = open(fakeStorage({ [STACKS_KEY]: elevenTargetsRecord }), []);
    const event = new KeyboardEvent('keydown', {
      bubbles: true,
      cancelable: true,
      key: '2',
      code: 'Digit2',
    });

    field.dispatchEvent(event);

    expect(location.href).toBe(PAGE);
    expect(event.defaultPrevented).toBe(false);
  });

  it('"A shortcut … opens the row\'s destination as rendered, an unfilled {} included"', () => {
    const record = JSON.stringify([
      [['S', { targets: { 'company git': ['https://github.com/company/{}'] }, focus: [] }]],
    ]);
    open(fakeStorage({ [STACKS_KEY]: record }), ['company']);
    expect(links()).toEqual(['https://github.com/company/{}']);

    keydown(document.body, { key: '1', code: 'Digit1', ctrlKey: true });

    expect(location.href).toBe(new URL('https://github.com/company/{}').href);
  });
});

describe('Enter ("Enter opens the first row when the run searched a query … a pending debounce is run first, so Enter acts on what was typed")', () => {
  it('Enter after typing a query runs the pending debounce now and opens its first row', () => {
    const storage = fakeStorage({ [STACKS_KEY]: elevenTargetsRecord });
    const { field } = open(storage, []);
    const before = storage.writes;

    type(field, 't07');
    keydown(field, { key: 'Enter', code: 'Enter' });

    expect(storage.writes).toBe(before + 1);
    expect(location.href).toBe('https://example.com/t07');
  });

  it('`<url> home .set` then Enter commits and lists rather than opening the first of every target', () => {
    const storage = fakeStorage();
    const { field } = open(storage, []);

    type(field, 'https://example.com/ home .set');
    keydown(field, { key: 'Enter', code: 'Enter' });

    expect(location.href).toBe(PAGE);
    expect(links()).toEqual(['https://example.com/']);
    expect(JSON.parse(storage.getItem(STACKS_KEY) ?? 'null')).toEqual([
      [['S', { targets: {}, focus: [] }]],
      [['S', { targets: { home: ['https://example.com/'] }, focus: [] }]],
    ]);
  });

  it('Enter on a blank open (R.inputs empty) opens nothing, though every target is listed', () => {
    const { field } = open(fakeStorage({ [STACKS_KEY]: elevenTargetsRecord }), []);
    expect(links()).toHaveLength(11);

    keydown(field, { key: 'Enter', code: 'Enter' });

    expect(location.href).toBe(PAGE);
  });

  it('Enter with no matches opens nothing', () => {
    const { field } = open(fakeStorage({ [STACKS_KEY]: oneTargetRecord }), ['zzz']);
    expect(links()).toEqual([]);

    keydown(field, { key: 'Enter', code: 'Enter' });

    expect(location.href).toBe(PAGE);
  });

  it('Enter with the field blurred still opens the first row of the query', () => {
    const { field } = open(fakeStorage({ [STACKS_KEY]: elevenTargetsRecord }), ['t1']);
    const [first] = links();
    expect(first).toBeDefined();
    field.blur();

    keydown(document.body, { key: 'Enter', code: 'Enter' });

    expect(location.href).toBe(first);
  });

  it('Enter pressed in another editable element is left alone', () => {
    open(fakeStorage({ [STACKS_KEY]: elevenTargetsRecord }), ['t07']);
    const other = document.createElement('textarea');
    document.body.appendChild(other);
    other.focus();
    const event = new KeyboardEvent('keydown', {
      bubbles: true,
      cancelable: true,
      key: 'Enter',
      code: 'Enter',
    });

    other.dispatchEvent(event);

    expect(location.href).toBe(PAGE);
    expect(event.defaultPrevented).toBe(false);
  });
});

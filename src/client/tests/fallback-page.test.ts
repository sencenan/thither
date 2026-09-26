// @vitest-environment happy-dom

// browser-client.md "Fallback UI and settings" — the text field and live execution: the field
// is seeded from the run's input and owns the keyboard; editing re-runs the ordinary program on
// a 60 ms debounce and re-renders from the register; live runs never navigate.

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

let root: HTMLElement;

beforeEach(() => {
  vi.useFakeTimers();
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
  const page = mountFallbackPage(root, interp, env);
  const field = root.querySelector('input');
  if (field === null) {
    throw new Error('the page has no text field');
  }
  return { env, page, field };
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
  it('a fresh profile shows the shortcut templates for this page, and the first .set removes them', () => {
    const page = `${location.origin}/thither/`;
    history.replaceState(null, '', `${page}?x=1`);
    const { field } = open(fakeStorage(), []);

    expect(root.textContent).toContain(`${page}?q=%s`);
    expect(root.textContent).toContain(`${page}#q=%s`);
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

describe('the field owns the keyboard ("a printable key pressed while it is not focused returns focus to it")', () => {
  it('a printable key pressed elsewhere refocuses the field', () => {
    const { field } = open(fakeStorage(), []);
    field.blur();
    expect(document.activeElement).not.toBe(field);

    keydown(document.body, { key: 'a', code: 'KeyA' });

    expect(document.activeElement).toBe(field);
  });

  const ignored: ReadonlyArray<readonly [name: string, init: KeyboardEventInit]> = [
    ['a non-printable key', { key: 'Escape', code: 'Escape' }],
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
});

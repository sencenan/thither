// browser-client.md "Persistence" / "Bounded history" — the two versioned localStorage records
// and their formats. This module is the only place that names `thither.stacks.v1` and
// `thither.settings.v1`; the host operations in `browser-env.ts` read and write through it.

import type { Stack, ThitherError } from '../dsl/index.ts';
import { emptyState } from '../dsl/index.ts';

const STACKS_KEY = 'thither.stacks.v1';
const SETTINGS_KEY = 'thither.settings.v1';
const DEFAULT_HISTORY_LIMIT = 10;

// The `getItem`/`setItem`/`removeItem` slice of `localStorage`, injected so tests can back
// it with a `Map` and run in plain Node with no DOM.
export interface StorageArea {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

// browser-client.md "Persistence" — `thither.settings.v1` holds configuration only, never
// language stack values.
export interface Settings {
  readonly historyLimit: number;
}

// browser-client.md "Bounded history" — the history limit `N` is a nonnegative integer; `0`
// retains only the current stack.
export const isHistoryLimit = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0;

// An absent or malformed record reads as the defaults; reading never repairs the record.
export const readSettings = (storage: StorageArea): Settings => {
  const raw = storage.getItem(SETTINGS_KEY);
  if (raw === null) {
    return { historyLimit: DEFAULT_HISTORY_LIMIT };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (_ex) {
    return { historyLimit: DEFAULT_HISTORY_LIMIT };
  }

  const historyLimit =
    typeof parsed === 'object' && parsed !== null && 'historyLimit' in parsed
      ? parsed.historyLimit
      : undefined;
  return { historyLimit: isHistoryLimit(historyLimit) ? historyLimit : DEFAULT_HISTORY_LIMIT };
};

export const writeSettings = (storage: StorageArea, settings: Settings): void => {
  storage.setItem(SETTINGS_KEY, JSON.stringify(settings));
};

// browser-client.md "Persistence" — `thither.stacks.v1`: a non-empty array of stacks, oldest
// first, whose last element is the current stack. Values are stored as-is and unvalidated;
// `.load` validates the current stack through the interpreter.
export type StackHistory = readonly (readonly unknown[])[];

const parseHistory = (raw: string): StackHistory | null => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (_ex) {
    return null;
  }

  if (!Array.isArray(parsed) || parsed.length === 0) {
    return null;
  }
  const stacks: (readonly unknown[])[] = [];
  for (const it of parsed) {
    if (!Array.isArray(it)) {
      return null;
    }
    stacks.push(it);
  }
  return stacks;
};

// browser-client.md "Bounded history" — an absent key is first initialization, whose current
// stack is `[emptyState()]` (so the first mutation is undoable). Returns null when the record
// is unreadable; reading never repairs it. A throwing storage is fatal — let it throw.
export const readHistory = (storage: StorageArea): StackHistory | null => {
  const raw = storage.getItem(STACKS_KEY);
  return raw === null ? [[emptyState()]] : parseHistory(raw);
};

// browser-client.md "Bounded history" — the previous current stack enters history only when the
// new one differs by structural JSON equality; the record is then trimmed from the front to
// `N + 1` entries.
const appendHistory = (
  previous: StackHistory,
  current: Stack,
  historyLimit: number,
): StackHistory => {
  const previousCurrent = previous.at(-1);
  const unchanged =
    previousCurrent !== undefined && JSON.stringify(previousCurrent) === JSON.stringify(current);
  const next = unchanged ? [...previous.slice(0, -1), current] : [...previous, current];
  return next.slice(Math.max(0, next.length - (historyLimit + 1)));
};

// Make `stack` the current stack of the record. An unreadable record has no previous current
// stack to retain, so the new record is `[stack]` alone. A write the storage refuses (quota) is
// not retried: the failure is pushed onto the stack as an `E` and the record is left as it was.
export const writeCurrentStack = (storage: StorageArea, stack: Stack): void => {
  const previous = readHistory(storage) ?? [];
  const next = appendHistory(previous, stack, readSettings(storage).historyLimit);
  try {
    storage.setItem(STACKS_KEY, JSON.stringify(next));
  } catch (_ex) {
    const failure: ThitherError = [
      'E',
      { type: 'unknown_error', description: 'the stack could not be saved: storage is full' },
    ];
    stack.push(failure);
  }
};

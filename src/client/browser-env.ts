// browser-client.md "Host operations" / "Persistence" — the browser interpreter environment:
// `defaultEnv()`'s four language operations plus the three host operations (`.load`, `.out`,
// `.save`) that are the whole of the client's persistence (ADR 0005, ADR 0007). Mirrors the
// core's `defaultEnv`; the caller builds an interpreter from it and reads the env's output
// register fields (`terminal`/`loaded`) after each run.
//
// This is the naive skeleton: one stored stack, no history, eviction, or quota retry — S4
// deepens the same three operations without touching their callers. This module is the only
// place that names `thither.stacks.v1` and `thither.settings.v1`.

import type {
  InterpreterEnv,
  OpFn,
  Program,
  Result,
  Stack,
  State,
  ThitherError,
} from '../dsl/index.ts';
import { defaultEnv, emptyState } from '../dsl/index.ts';

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

// The client-held slot the host operations write and the client reads after execution.
// Cleared at the start of each run by `.load`.
export interface OutputRegister {
  terminal?: Result | ThitherError | undefined;
  loaded: boolean;
}

// An interpreter environment (ADR 0005) that is *also* the client's output register: the fields
// of OutputRegister are splatted onto the env, so the browser world is one value. Build an
// interpreter from it, then read `terminal`/`loaded` off the same object after each run.
export interface BrowserEnv extends InterpreterEnv, OutputRegister {}

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

const parseError = (description: string): ThitherError => [
  'E',
  { type: 'parse_error', description },
];

// A stored value is always an array from JSON; parse resolves it to S/R/E (or a parse_error E).
const isStackValue = (token: Program[number] | undefined): token is State | Result | ThitherError =>
  token !== undefined && (token[0] === 'S' || token[0] === 'R' || token[0] === 'E');

// browser-client.md "Persistence" — a record is a non-empty array of stacks; the current
// stack is its last element. Returns null when the record is not that shape.
const currentStackOf = (raw: string): readonly unknown[] | null => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (_ex) {
    return null;
  }

  if (!Array.isArray(parsed) || parsed.length === 0 || !parsed.every((it) => Array.isArray(it))) {
    return null;
  }

  const current: unknown = parsed[parsed.length - 1];
  return Array.isArray(current) ? current : null;
};

export const createBrowserEnv = (storage: StorageArea): BrowserEnv => {
  // The env is also the output register (its fields are splatted in), so the host operations
  // mutate it directly and the client reads terminal/loaded off the same object.
  const { symbols } = defaultEnv();
  const env: BrowserEnv = { symbols, loaded: true };

  // browser-client.md "Host operations" — open a run: clear the register, read the stored
  // record, and push the current stack (or `[emptyState()]` when absent). A malformed record
  // or a value that fails validation seals the stack with the `parse_error` and flags the run.
  // The interpreter is handed in by the evaluator (ADR 0005), so validation reuses pushToken.
  const load: OpFn = (interp, stack) => {
    env.terminal = undefined;
    env.loaded = true;

    const raw = storage.getItem(STACKS_KEY); // storage throwing is fatal — let it throw
    if (raw === null) {
      stack.push(emptyState());
      return stack;
    }

    const current = currentStackOf(raw);
    if (current === null) {
      env.loaded = false;
      stack.push(parseError(`${STACKS_KEY} is not a stack record`));
      return stack;
    }

    // Validate every value through the interpreter; parse normalizes as it validates, so the
    // pushed values are canonical. Any value that parses to an E fails the whole load.
    const validated: Stack = [];
    for (const value of current) {
      const token = interp.pushToken([], value)[0];
      if (!isStackValue(token) || token[0] === 'E') {
        env.loaded = false;
        stack.push(isStackValue(token) ? token : parseError('malformed stored value'));
        return stack;
      }
      validated.push(token);
    }

    for (const value of validated) {
      stack.push(value);
    }
    return stack;
  };

  // browser-client.md "Host operations" — pop the run's terminal (R or E) into the register.
  // Not a general pop: any other top value is left in place.
  const out: OpFn = (_interp, stack) => {
    const top = stack[stack.length - 1];
    if (top !== undefined && (top[0] === 'R' || top[0] === 'E')) {
      stack.pop();
      env.terminal = top;
    }
    return stack;
  };

  // browser-client.md "Host operations" — persist the stack as it stands, never an empty one.
  // Naive: the record is the single current stack.
  const save: OpFn = (_interp, stack) => {
    if (stack.length === 0) {
      return stack;
    }

    storage.setItem(STACKS_KEY, JSON.stringify([stack]));
    return stack;
  };

  symbols.set('.load', load);
  symbols.set('.out', out);
  symbols.set('.save', save);

  return env;
};

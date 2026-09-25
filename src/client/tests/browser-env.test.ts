// browser-client.md "Host operations" / ADR 0007 — the three host operations tested through
// the interpreter, exactly as the client runs them: `execute(['.load', ...tokens, '.$', '.out',
// '.save'])` against a Map-backed storage fake, in plain Node with no DOM.

import { describe, expect, it } from 'vitest';
import { createInterpreter, emptyState, type Program } from '../../dsl/index.ts';
import {
  createBrowserEnv,
  isHistoryLimit,
  readSettings,
  type StorageArea,
  writeSettings,
} from '../browser-env.ts';

const STACKS_KEY = 'thither.stacks.v1';
const SETTINGS_KEY = 'thither.settings.v1';

// A Map-backed localStorage fake. `throwOnRead` models an unavailable localStorage.
const fakeStorage = (
  initial: Record<string, string> = {},
  throwOnRead = false,
): StorageArea & { map: Map<string, string> } => {
  const map = new Map(Object.entries(initial));
  return {
    map,
    getItem: (key) => {
      if (throwOnRead) {
        throw new Error('localStorage unavailable');
      }
      return map.get(key) ?? null;
    },
    setItem: (key, value) => {
      map.set(key, value);
    },
    removeItem: (key) => {
      map.delete(key);
    },
  };
};

// Build the browser env (defaultEnv + host operations) and its interpreter, exactly as the
// client does. The env *is* the output register (its fields are read after each run).
const wire = (storage: StorageArea) => {
  const env = createBrowserEnv(storage);
  return { interp: createInterpreter(env), register: env };
};

const runClient = (storage: StorageArea, tokens: readonly string[]) => {
  const { interp, register } = wire(storage);
  const program: Program = ['.load', ...tokens, '.$', '.out', '.save'].reduce<Program>(
    (acc, token) => interp.pushToken(acc, token),
    [],
  );
  const stack = interp.execute(program);
  return { register, stack };
};

const record = (storage: StorageArea & { map: Map<string, string> }): unknown =>
  JSON.parse(storage.map.get(STACKS_KEY) ?? 'null');

const emptyRecord = [[emptyState()]];

describe('browser env host operations', () => {
  it('seeds and persists [S] on the first run', () => {
    const storage = fakeStorage();
    const { register, stack } = runClient(storage, []);

    expect(stack).toEqual([emptyState()]);
    expect(record(storage)).toEqual(emptyRecord);
    expect(register.terminal?.[0]).toBe('R');
    expect(register.loaded).toBe(true);
  });

  it('a plain search persists the stack it loaded', () => {
    const storage = fakeStorage();
    runClient(storage, []);

    const { register } = runClient(storage, ['github']);
    expect(record(storage)).toEqual(emptyRecord);
    expect(register.loaded).toBe(true);
  });

  it('a mutation is persisted and a reload resumes from the stored stack', () => {
    const storage = fakeStorage();
    runClient(storage, ['https://github.com/company/{}', 'company', 'git', '.set']);

    expect(record(storage)).not.toEqual(emptyRecord);

    // The stored current stack now carries the target: a reload resumes from it and searches it.
    const reload = runClient(storage, ['company']);
    expect(reload.register.terminal?.[0]).toBe('R');
    const terminal = reload.register.terminal;
    if (terminal?.[0] === 'R') {
      expect(terminal[1].matches).toHaveLength(1);
    }
  });

  it('flags a malformed record and leaves it untouched', () => {
    const storage = fakeStorage({ [STACKS_KEY]: '{"not":"a stack record"}' });
    const { register } = runClient(storage, ['github']);

    expect(register.loaded).toBe(false);
    expect(register.terminal?.[0]).toBe('E');
    const terminal = register.terminal;
    if (terminal?.[0] === 'E') {
      expect(terminal[1].type).toBe('parse_error');
    }
    // .out drained the E, .save saw an empty stack: the bad record is untouched.
    expect(record(storage)).toEqual({ not: 'a stack record' });
  });

  it('flags a pre-variants record: the old target-set shape no longer validates (ADR 0008)', () => {
    // ADR 0008 changed the persisted shape (targets: array -> keyed object) with no migration; an
    // existing record parses to parse_error and is reset by hand rather than silently converted.
    const oldShape = JSON.stringify([
      [['S', { targets: [[['home'], 'https://example.com/']], focus: [] }]],
    ]);
    const storage = fakeStorage({ [STACKS_KEY]: oldShape });
    const { register } = runClient(storage, ['home']);

    expect(register.loaded).toBe(false);
    expect(register.terminal?.[0]).toBe('E');
    if (register.terminal?.[0] === 'E') {
      expect(register.terminal[1].type).toBe('parse_error');
    }
    // The bad record is left untouched for the human to reset.
    expect(record(storage)).toEqual(JSON.parse(oldShape));
  });

  it('flags a record whose current value fails validation', () => {
    const storage = fakeStorage({ [STACKS_KEY]: JSON.stringify([[['S', { bad: true }]]]) });
    const { register } = runClient(storage, []);

    expect(register.loaded).toBe(false);
    expect(register.terminal?.[0]).toBe('E');
    if (register.terminal?.[0] === 'E') {
      expect(register.terminal[1].type).toBe('parse_error');
    }
  });

  it('.out is a no-op when the top is not a terminal', () => {
    const { interp, register } = wire(fakeStorage());

    // .load then .out, with no .$ between: the top is the loaded S, so .out leaves it.
    const program = ['.load', '.out'].reduce<Program>((acc, t) => interp.pushToken(acc, t), []);
    const stack = interp.execute(program);

    expect(stack).toEqual([emptyState()]);
    expect(register.terminal).toBeUndefined();
  });

  it('.save writes nothing when the stack is empty', () => {
    const storage = fakeStorage();
    const { interp, register } = wire(storage);

    // A bare .save on an empty stack: nothing to persist.
    const program = interp.pushToken([], '.save');
    interp.execute(program);

    expect(register.terminal).toBeUndefined();
    expect(storage.map.size).toBe(0);
  });

  it('lets an unavailable localStorage throw', () => {
    const storage = fakeStorage({}, true);
    expect(() => runClient(storage, [])).toThrow('localStorage unavailable');
  });
});

// browser-client.md "Persistence" / "Bounded history" — `thither.settings.v1` holds configuration
// only; `historyLimit` is a nonnegative integer defaulting to 10.
describe('settings record', () => {
  it('"Bounded history": historyLimit defaults to 10 when the key is absent', () => {
    expect(readSettings(fakeStorage())).toEqual({ historyLimit: 10 });
  });

  it('"Persistence": a stored { historyLimit } round-trips', () => {
    const storage = fakeStorage();
    writeSettings(storage, { historyLimit: 3 });

    expect(readSettings(storage)).toEqual({ historyLimit: 3 });
    expect(JSON.parse(storage.map.get(SETTINGS_KEY) ?? 'null')).toEqual({ historyLimit: 3 });
  });

  it('"Bounded history": 0 is legal (retain only the current stack)', () => {
    const storage = fakeStorage();
    writeSettings(storage, { historyLimit: 0 });
    expect(readSettings(storage)).toEqual({ historyLimit: 0 });
  });

  it.each([
    ['not JSON', 'nonsense'],
    ['a JSON array', '[10]'],
    ['a JSON null', 'null'],
    ['an object missing historyLimit', '{}'],
    ['a string historyLimit', '{"historyLimit":"10"}'],
    ['a negative historyLimit', '{"historyLimit":-1}'],
    ['a fractional historyLimit', '{"historyLimit":2.5}'],
  ])('"Bounded history": a malformed record (%s) reads as the default', (_label, raw) => {
    const storage = fakeStorage({ [SETTINGS_KEY]: raw });
    expect(readSettings(storage)).toEqual({ historyLimit: 10 });
    // Reading never repairs: the malformed record stays as it was.
    expect(storage.map.get(SETTINGS_KEY)).toBe(raw);
  });

  it('"Persistence": settings never hold language stack values', () => {
    const storage = fakeStorage();
    writeSettings(storage, { historyLimit: 5 });
    runClient(storage, ['https://example.com/{}', 'home', '.set']);

    expect(JSON.parse(storage.map.get(SETTINGS_KEY) ?? 'null')).toEqual({ historyLimit: 5 });
  });

  it.each([
    [0, true],
    [10, true],
    [-1, false],
    [1.5, false],
    [Number.NaN, false],
    [Number.POSITIVE_INFINITY, false],
    ['10', false],
    [null, false],
  ])('"Bounded history": isHistoryLimit(%p) is %p', (value, expected) => {
    expect(isHistoryLimit(value)).toBe(expected);
  });

  it('lets an unavailable localStorage throw on read', () => {
    expect(() => readSettings(fakeStorage({}, true))).toThrow('localStorage unavailable');
  });
});

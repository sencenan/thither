// browser-client.md "Execution flow" — one run is `B .load .merge <tokens> .$ .out .save`, B being
// the client base state, executed synchronously: afterwards the register holds the run's terminal
// and the mutation is persisted.

import { describe, expect, it } from 'vitest';
import { createInterpreter, type State } from '../../dsl/index.ts';
import { baseState } from '../base-state.ts';
import { createBrowserEnv } from '../browser-env.ts';
import type { StorageArea } from '../persistence.ts';
import { compose, load, run } from '../run.ts';

const PAGE = 'https://host.example/thither/';
const base = baseState(PAGE);

const stored = (state: State[1]): Record<string, string> => ({
  [STACKS_KEY]: JSON.stringify([[['S', state]]]),
});

const currentState = (storage: StorageArea): unknown => {
  const record: unknown = JSON.parse(storage.getItem(STACKS_KEY) ?? 'null');
  return Array.isArray(record) ? record.at(-1)?.[0] : undefined;
};

const STACKS_KEY = 'thither.stacks.v1';

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

describe('run', () => {
  it('a search leaves the R in the register, with the tokens as the query', () => {
    const storage = fakeStorage({
      [STACKS_KEY]: JSON.stringify([
        [['S', { targets: { home: ['https://example.com/'] }, focus: [], alias: {} }]],
      ]),
    });
    const env = createBrowserEnv(storage);
    const interp = createInterpreter(env);

    run(interp, env.base, ['home']);

    expect(env.terminal?.[0]).toBe('R');
    expect(env.terminal?.[1]).toMatchObject({ inputs: ['home'], args: [] });
    expect(env.loaded).toBe(true);
  });

  it('a mutation is persisted by the epilogue', () => {
    const storage = fakeStorage();
    const env = createBrowserEnv(storage);
    const interp = createInterpreter(env);

    run(interp, env.base, ['https://example.com/', 'home', '.set']);

    const record: unknown = JSON.parse(storage.getItem(STACKS_KEY) ?? 'null');
    expect(record).toEqual([
      [['S', { targets: {}, focus: [], alias: {} }]],
      [['S', { targets: { home: ['https://example.com/'] }, focus: [], alias: {} }]],
    ]);
  });

  it('each run clears the register before it writes: a later E replaces an earlier R', () => {
    const env = createBrowserEnv(fakeStorage());
    const interp = createInterpreter(env);

    run(interp, env.base, []);
    expect(env.terminal?.[0]).toBe('R');

    run(interp, env.base, ['git', '.set']);
    expect(env.terminal?.[0]).toBe('E');
  });
});

// ADR 0015 — what the page shows while a nontrivial program waits: the stored world, with no
// search and nothing written.
describe('load', () => {
  it('records the stored state without searching or saving', () => {
    const record = JSON.stringify([
      [['S', { targets: { home: ['https://example.com/'] }, focus: ['company'], alias: {} }]],
    ]);
    const storage = fakeStorage({ [STACKS_KEY]: record });
    const env = createBrowserEnv(storage);
    const interp = createInterpreter(env);

    load(interp, env.base);

    expect(env.state?.[1].focus).toEqual(['company']);
    expect(env.terminal).toBeUndefined();
    expect(env.loaded).toBe(true);
    expect(storage.getItem(STACKS_KEY)).toBe(record);
  });

  it('reports an unreadable record, as a run would', () => {
    const env = createBrowserEnv(fakeStorage({ [STACKS_KEY]: 'not json' }));
    const interp = createInterpreter(env);

    load(interp, env.base);

    expect(env.loaded).toBe(false);
  });
});

// browser-client.md "Execution flow" — the client base state goes beneath the stored state and the
// stored state is merged into it (dsl.md §4.6), so its `thither` target exists unless overridden.
describe('the client base state', () => {
  const thither = [PAGE];
  const home = ['https://example.com/'];

  it('the composed program puts the base state before .load and merges after it', () => {
    expect(compose(base, ['home', '.set'])).toEqual([
      base,
      '.load',
      '.merge',
      'home',
      '.set',
      '.$',
      '.out',
      '.save',
    ]);
  });

  it('a first run, with no stored record, searches the base state alone', () => {
    const env = createBrowserEnv(fakeStorage(), [], base);
    run(createInterpreter(env), env.base, []);

    expect(env.state).toEqual(base);
    expect(env.terminal?.[1]).toMatchObject({ matches: [[PAGE, PAGE, 'thither', [], {}]] });
  });

  it('the stored targets follow the base target, and the stored focus is kept', () => {
    const storage = fakeStorage(stored({ targets: { home }, focus: ['h'], alias: {} }));
    const env = createBrowserEnv(storage, [], base);
    run(createInterpreter(env), env.base, []);

    expect(env.state).toEqual(['S', { targets: { thither, home }, focus: ['h'], alias: {} }]);
  });

  it('the merged state is what the run saves', () => {
    const storage = fakeStorage(stored({ targets: { home }, focus: [], alias: {} }));
    const env = createBrowserEnv(storage, [], base);
    run(createInterpreter(env), env.base, []);

    expect(currentState(storage)).toEqual([
      'S',
      { targets: { thither, home }, focus: [], alias: {} },
    ]);
  });

  it('a stored thither target overrides the base one', () => {
    const mine = ['https://mine.example/'];
    const storage = fakeStorage(stored({ targets: { thither: mine }, focus: [], alias: {} }));
    const env = createBrowserEnv(storage, [], base);
    run(createInterpreter(env), env.base, []);

    expect(env.state?.[1].targets).toEqual({ thither: mine });
  });

  it('a removed thither target is merged in again by the next run', () => {
    const storage = fakeStorage(stored({ targets: { home }, focus: [], alias: {} }));
    const env = createBrowserEnv(storage, [], base);
    const interp = createInterpreter(env);

    run(interp, env.base, ['thither', '.rm']);
    expect(currentState(storage)).toEqual(['S', { targets: { home }, focus: [], alias: {} }]);

    run(interp, env.base, []);
    expect(env.state?.[1].targets).toEqual({ thither, home });
  });

  it('load merges the stored state into the base state too', () => {
    const storage = fakeStorage(stored({ targets: { home }, focus: ['h'], alias: {} }));
    const env = createBrowserEnv(storage, [], base);
    load(createInterpreter(env), env.base);

    expect(env.state).toEqual(['S', { targets: { thither, home }, focus: ['h'], alias: {} }]);
  });

  it('an unreadable record still fails the run, leaving the base state in the register', () => {
    const env = createBrowserEnv(fakeStorage({ [STACKS_KEY]: 'not json' }), [], base);
    run(createInterpreter(env), env.base, ['home']);

    expect(env.loaded).toBe(false);
    expect(env.terminal?.[1]).toMatchObject({ type: 'parse_error' });
    expect(env.state).toEqual(base);
  });

  it('without a base state the env merges onto an empty one', () => {
    const env = createBrowserEnv(fakeStorage(stored({ targets: { home }, focus: [], alias: {} })));
    run(createInterpreter(env), env.base, []);

    expect(env.state?.[1].targets).toEqual({ home });
  });
});

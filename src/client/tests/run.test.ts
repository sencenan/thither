// browser-client.md "Execution flow" — one run is `.load <tokens> .$ .out .save`, executed
// synchronously: afterwards the register holds the run's terminal and the mutation is persisted.

import { describe, expect, it } from 'vitest';
import { createInterpreter } from '../../dsl/index.ts';
import { createBrowserEnv } from '../browser-env.ts';
import type { StorageArea } from '../persistence.ts';
import { load, run } from '../run.ts';

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

    run(interp, ['home']);

    expect(env.terminal?.[0]).toBe('R');
    expect(env.terminal?.[1]).toMatchObject({ inputs: ['home'], args: [] });
    expect(env.loaded).toBe(true);
  });

  it('a mutation is persisted by the epilogue', () => {
    const storage = fakeStorage();
    const env = createBrowserEnv(storage);
    const interp = createInterpreter(env);

    run(interp, ['https://example.com/', 'home', '.set']);

    const record: unknown = JSON.parse(storage.getItem(STACKS_KEY) ?? 'null');
    expect(record).toEqual([
      [['S', { targets: {}, focus: [], alias: {} }]],
      [['S', { targets: { home: ['https://example.com/'] }, focus: [], alias: {} }]],
    ]);
  });

  it('each run clears the register before it writes: a later E replaces an earlier R', () => {
    const env = createBrowserEnv(fakeStorage());
    const interp = createInterpreter(env);

    run(interp, []);
    expect(env.terminal?.[0]).toBe('R');

    run(interp, ['git', '.set']);
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

    load(interp);

    expect(env.state?.[1].focus).toEqual(['company']);
    expect(env.terminal).toBeUndefined();
    expect(env.loaded).toBe(true);
    expect(storage.getItem(STACKS_KEY)).toBe(record);
  });

  it('reports an unreadable record, as a run would', () => {
    const env = createBrowserEnv(fakeStorage({ [STACKS_KEY]: 'not json' }));
    const interp = createInterpreter(env);

    load(interp);

    expect(env.loaded).toBe(false);
  });
});

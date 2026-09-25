// browser-client.md "Execution flow" step 4 / ADR 0009 — the auto-navigation rule, first as a
// table over hand-built registers, then end to end through the real browser env and
// interpreter exactly as main.ts runs it: `.load <tokens> .$ .out .save` against a Map-backed
// storage fake, then ask the register where to go.

import { describe, expect, it } from 'vitest';
import { createInterpreter, type Match } from '../../dsl/index.ts';
import { createBrowserEnv, type OutputRegister } from '../browser-env.ts';
import { resolveNavigationDestination } from '../navigation.ts';
import type { StorageArea } from '../persistence.ts';
import { run } from '../run.ts';

const STACKS_KEY = 'thither.stacks.v1';

// `quota` is the longest value `setItem` accepts before throwing the browser's
// `QuotaExceededError`.
const fakeStorage = (
  initial: Record<string, string> = {},
  quota = Number.POSITIVE_INFINITY,
): StorageArea => {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      if (value.length > quota) {
        throw new DOMException('quota exceeded', 'QuotaExceededError');
      }
      map.set(key, value);
    },
    removeItem: (key) => {
      map.delete(key);
    },
  };
};

const match = (argDelta: number): Match => [
  'https://example.com/',
  'https://example.com/',
  'home',
  [],
  { argDelta, positions: [], score: 1 },
];

const register = (over: Partial<OutputRegister>): OutputRegister => ({
  loaded: true,
  terminal: ['R', { matches: [match(0)], inputs: ['home'] }],
  ...over,
});

describe('resolveNavigationDestination', () => {
  it('resolves to the rendered destination of a single nonnegative match with a non-empty query', async () => {
    await expect(resolveNavigationDestination(register({}))).resolves.toBe('https://example.com/');
  });

  it('resolves after a mutation: the register carries no changed flag to consult', async () => {
    // `<u> a b .set a b` — the trailing `.$` consumed `a b`, so `inputs` is non-empty.
    await expect(
      resolveNavigationDestination(
        register({ terminal: ['R', { matches: [match(0)], inputs: ['a', 'b'] }] }),
      ),
    ).resolves.toBe('https://example.com/');
  });

  const rejected: ReadonlyArray<[string, OutputRegister]> = [
    [
      'a terminal E does not navigate',
      register({ terminal: ['E', { type: 'parse_error', description: 'x' }] }),
    ],
    ['no matches do not navigate', register({ terminal: ['R', { matches: [], inputs: ['x'] }] })],
    [
      'more than one match does not navigate',
      register({ terminal: ['R', { matches: [match(0), match(0)], inputs: ['home'] }] }),
    ],
    [
      'a negative argument balance does not navigate',
      register({ terminal: ['R', { matches: [match(-1)], inputs: ['home'] }] }),
    ],
    [
      'an empty query does not navigate, even to a single complete match',
      register({ terminal: ['R', { matches: [match(0)], inputs: [] }] }),
    ],
  ];

  for (const [name, reg] of rejected) {
    it(name, async () => {
      await expect(resolveNavigationDestination(reg)).rejects.toBeUndefined();
    });
  }
});

// A record whose current stack holds one complete, single-match target.
const oneTargetRecord = JSON.stringify([
  [['S', { targets: { home: ['https://example.com/'] }, focus: [] }]],
]);

// As main.ts performs it: run, then ask the register where to go. The destination is
// `undefined` when the rule rejected, so each case reads as one value.
const open = async (storage: StorageArea, tokens: readonly string[]) => {
  const env = createBrowserEnv(storage);
  const interp = createInterpreter(env);
  run(interp, tokens);
  const destination = await resolveNavigationDestination(env).catch(() => undefined);
  return { register: env, destination };
};

describe('the run, end to end (browser-client.md "Execution flow")', () => {
  it('a first empty run yields an R and no destination', async () => {
    const { register, destination } = await open(fakeStorage(), []);
    expect(destination).toBeUndefined();
    expect(register.terminal?.[0]).toBe('R');
  });

  it('a plain search with a single complete match navigates', async () => {
    const { destination } = await open(fakeStorage({ [STACKS_KEY]: oneTargetRecord }), ['home']);
    expect(destination).toBe('https://example.com/');
  });

  it('a blank open never navigates, even with a single-target state', async () => {
    const { register, destination } = await open(
      fakeStorage({ [STACKS_KEY]: oneTargetRecord }),
      [],
    );
    expect(destination).toBeUndefined();
    expect(register.terminal?.[0]).toBe('R');
  });

  it('set-and-go: `<u> a b .set a b` sets the target and navigates to it (ADR 0009)', async () => {
    const { destination } = await open(fakeStorage(), [
      'https://example.com/',
      'a',
      'b',
      '.set',
      'a',
      'b',
    ]);
    expect(destination).toBe('https://example.com/');
  });

  it('set-to-confirm: `<u> home .set` with no query shows the list', async () => {
    const { register, destination } = await open(fakeStorage(), [
      'https://example.com/',
      'home',
      '.set',
    ]);
    expect(destination).toBeUndefined();
    expect(register.terminal?.[0]).toBe('R');
  });

  it('a focus-only search shows the page: focus is not part of the query', async () => {
    const { register, destination } = await open(fakeStorage({ [STACKS_KEY]: oneTargetRecord }), [
      'home',
      '.@',
    ]);
    expect(destination).toBeUndefined();
    expect(register.terminal?.[0]).toBe('R');
  });

  it('an incomplete single match is listed but not navigated to', async () => {
    const record = JSON.stringify([
      [['S', { targets: { docs: ['https://example.com/{}'] }, focus: [] }]],
    ]);
    const { register, destination } = await open(fakeStorage({ [STACKS_KEY]: record }), ['docs']);

    expect(destination).toBeUndefined();
    const terminal = register.terminal;
    if (terminal?.[0] === 'R') {
      expect(terminal[1].matches).toHaveLength(1);
      expect(terminal[1].matches[0]?.[4].argDelta).toBe(-1);
    } else {
      expect.fail('expected an R');
    }
  });

  it('a save that fails on quota surfaces the E and never navigates, even on a single complete match ("Persistence")', async () => {
    const { register, destination } = await open(
      fakeStorage({ [STACKS_KEY]: oneTargetRecord }, 0),
      ['home'],
    );

    expect(destination).toBeUndefined();
    expect(register.terminal).toEqual([
      'E',
      { type: 'unknown_error', description: expect.any(String) },
    ]);
  });
});

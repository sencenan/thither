// browser-client.md "Execution flow" — the walking skeleton's session: build the run program,
// execute it, and either navigate or render. Wired through the real browser env and interpreter
// against a Map-backed storage fake, exactly as the client runs it, in plain Node.

import { describe, expect, it } from 'vitest';
import { createInterpreter, type Match } from '../../dsl/index.ts';
import { createBrowserEnv, type OutputRegister, type StorageArea } from '../browser-env.ts';
import { createSession, decideNavigation, type LockRunner } from '../session.ts';

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

const wireSession = (storage: StorageArea, locks?: LockRunner) => {
  const env = createBrowserEnv(storage);
  const interp = createInterpreter(env);
  const navigated: string[] = [];
  const rendered: OutputRegister[] = [];
  const session = createSession({
    interp,
    register: env,
    locks,
    navigate: (url) => navigated.push(url),
    render: () => rendered.push({ ...env }),
  });
  return { session, navigated, rendered };
};

// A record whose current stack holds one complete, single-match target.
const oneTargetRecord = JSON.stringify([
  [['S', { targets: { home: ['https://example.com/'] }, focus: [] }]],
]);

const match = (argDelta: number): Match => [
  'https://example.com/',
  'home',
  [],
  { argDelta, positions: [], score: 1 },
];

const register = (over: Partial<OutputRegister>): OutputRegister => ({
  loaded: true,
  terminal: ['R', { matches: [match(0)], inputs: ['home'] }],
  saved: { changed: false },
  ...over,
});

describe('decideNavigation (browser-client.md "Execution flow" step 4)', () => {
  it('navigates on an armed single nonnegative match with an unchanged stack', () => {
    expect(decideNavigation(register({}), true)).toBe(true);
  });

  const rejected: ReadonlyArray<[string, OutputRegister]> = [
    ['a disarmed run never navigates', register({})],
    [
      'a terminal E does not navigate',
      register({ terminal: ['E', { type: 'parse_error', description: 'x' }] }),
    ],
    ['no matches do not navigate', register({ terminal: ['R', { matches: [], inputs: [] }] })],
    [
      'more than one match does not navigate',
      register({ terminal: ['R', { matches: [match(0), match(0)], inputs: ['home'] }] }),
    ],
    [
      'a negative argument balance does not navigate',
      register({ terminal: ['R', { matches: [match(-1)], inputs: ['home'] }] }),
    ],
    ['a changed stack does not navigate', register({ saved: { changed: true } })],
    ['an unsaved run does not navigate', register({ saved: undefined })],
    [
      'a failed save does not navigate',
      register({ saved: ['E', { type: 'unknown_error', description: 'x' }] }),
    ],
  ];

  for (const [name, reg] of rejected) {
    it(name, () => {
      // The first case is disarmed; the rest are armed but fail another gate.
      const armed = name !== 'a disarmed run never navigates';
      expect(decideNavigation(reg, armed)).toBe(false);
    });
  }
});

describe('createSession.run (walking skeleton)', () => {
  it('renders the fallback list on a first empty run and does not navigate', async () => {
    const { session, navigated, rendered } = wireSession(fakeStorage());
    await session.run([], 'initial');

    expect(navigated).toEqual([]);
    expect(rendered).toHaveLength(1);
    expect(rendered[0]?.terminal?.[0]).toBe('R');
  });

  it('navigates on a single complete match with an unchanged stack', async () => {
    const { session, navigated, rendered } = wireSession(
      fakeStorage({ [STACKS_KEY]: oneTargetRecord }),
    );
    await session.run(['home'], 'initial');

    expect(navigated).toEqual(['https://example.com/']);
    expect(rendered).toEqual([]);
  });

  it('never navigates on empty input, even with a single-target state', async () => {
    const { session, navigated, rendered } = wireSession(
      fakeStorage({ [STACKS_KEY]: oneTargetRecord }),
    );
    await session.run([], 'initial');

    expect(navigated).toEqual([]);
    expect(rendered).toHaveLength(1);
    expect(rendered[0]?.terminal?.[0]).toBe('R');
  });

  it('shows the list after a mutation rather than navigating (changed guard)', async () => {
    const { session, navigated, rendered } = wireSession(fakeStorage());
    await session.run(['https://example.com/', 'home', '.set'], 'initial');

    expect(navigated).toEqual([]);
    expect(rendered).toHaveLength(1);
  });

  it('disarms after the first render: a later eligible run does not navigate', async () => {
    const { session, navigated } = wireSession(fakeStorage({ [STACKS_KEY]: oneTargetRecord }));

    // First run has no match, so it renders and disarms the latch.
    await session.run(['nothere'], 'initial');
    // Second run would be eligible, but the page has already shown the UI.
    await session.run(['home'], 'initial');

    expect(navigated).toEqual([]);
  });

  it('never navigates in live mode', async () => {
    const { session, navigated, rendered } = wireSession(
      fakeStorage({ [STACKS_KEY]: oneTargetRecord }),
    );
    await session.run(['home'], 'live');

    expect(navigated).toEqual([]);
    expect(rendered).toHaveLength(1);
  });

  it('runs inside the lock when one is provided', async () => {
    const held: string[] = [];
    const locks: LockRunner = {
      request: async (name, callback) => {
        held.push(name);
        return callback();
      },
    };
    const { session, navigated } = wireSession(
      fakeStorage({ [STACKS_KEY]: oneTargetRecord }),
      locks,
    );
    await session.run(['home'], 'initial');

    expect(held).toEqual(['thither']);
    expect(navigated).toEqual(['https://example.com/']);
  });
});

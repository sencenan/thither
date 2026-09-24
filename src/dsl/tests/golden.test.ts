// dsl.md §7 — worked programs, end to end through the public surface

import { describe, expect, it } from 'vitest';
import { createInterpreter, defaultEnv, emptyState, type Program, type Stack } from '../index.ts';

const run = (items: readonly unknown[], stack?: Stack) => {
  const interp = createInterpreter(defaultEnv());
  const program: Program = [];
  for (const item of items) {
    interp.pushToken(program, item);
  }
  return interp.execute(program, stack);
};

describe('execute resumes from a caller-supplied stack', () => {
  it('§7 create and implicitly search, seeded through the stack instead of the program', () => {
    const persisted: Stack = [emptyState()];
    const stack = run(['company', 'git', 'https://github.com/company/{}', '.set'], persisted);

    expect(stack[0]).toEqual([
      'S',
      { targets: [[['company', 'git'], 'https://github.com/company/{}']], focus: [] },
    ]);
    expect(stack[1]?.[0]).toBe('R');
    expect(persisted).toEqual([['S', { targets: [], focus: [] }]]);
  });
});

describe('the public surface holds the browser-client.md contract', () => {
  const state = [
    'S',
    { targets: [[['company', 'git'], 'https://github.com/company/{}']], focus: [] },
  ];

  it('§2 a whitespace-bearing token is an E in the stream: earlier items execute, then it stops', () => {
    // The client splits on whitespace, so it can never send this; a host extension could.
    // No try/catch: the failure is a value, and the state before it is preserved.
    const stack = run([state, 'company git', 'MyRepo']);

    expect(stack).toEqual([state, ['E', expect.objectContaining({ type: 'parse_error' })]]);
  });

  it('execute leaves the program reusable: two runs give equal stacks, and tokens appended after a run still execute', () => {
    const interp = createInterpreter(defaultEnv());
    const program: Program = [];
    interp.pushToken(program, state);
    interp.pushToken(program, 'company');

    const first = interp.execute(program);
    const second = interp.execute(program);
    expect(second).toEqual(first);
    expect(program).toHaveLength(2);

    // Had the terminal .$ landed in `program`, this literal would sit past a result and never run.
    interp.pushToken(program, 'MyRepo');
    const third = interp.execute(program);
    expect(third[1]).toEqual([
      'R',
      expect.objectContaining({
        matches: [
          [
            'https://github.com/company/MyRepo',
            ['company', 'git'],
            ['MyRepo'],
            expect.objectContaining({ argDelta: 0 }),
          ],
        ],
      }),
    ]);
  });
});

describe('dsl.md §7 worked programs', () => {
  it('§7 create and implicitly search', () => {
    const stack = run([
      ['S', { targets: [], focus: [] }],
      'company',
      'git',
      'https://github.com/company/{}',
      '.set',
    ]);

    expect(stack).toEqual([
      ['S', { targets: [[['company', 'git'], 'https://github.com/company/{}']], focus: [] }],
      [
        'R',
        {
          matches: [
            [
              'https://github.com/company/{}',
              ['company', 'git'],
              [],
              { argDelta: -1, positions: [], score: 0 },
            ],
          ],
          inputs: [],
        },
      ],
    ]);
  });

  it('§7 navigate with inferred arguments', () => {
    const state = [
      'S',
      { targets: [[['company', 'git'], 'https://github.com/company/{}']], focus: [] },
    ];
    const stack = run([state, 'company', 'git', 'MyRepo']);

    expect(stack).toEqual([
      state,
      [
        'R',
        {
          matches: [
            [
              'https://github.com/company/MyRepo',
              ['company', 'git'],
              ['MyRepo'],
              expect.objectContaining({ argDelta: 0 }),
            ],
          ],
          inputs: ['company', 'git'],
        },
      ],
    ]);
  });

  it('§7 preserve ambiguity when arguments are missing', () => {
    const state = [
      'S',
      {
        targets: [
          [['company', 'git'], 'https://github.com/company/{}'],
          [['git', 'personal'], 'https://github.com/personal/{}/tree/{}'],
        ],
        focus: [],
      },
    ];
    const stack = run([state, 'git', '.', 'thither', '.$']);

    expect(stack).toEqual([
      state,
      [
        'R',
        {
          matches: [
            [
              'https://github.com/company/thither',
              ['company', 'git'],
              ['thither'],
              expect.objectContaining({ argDelta: 0 }),
            ],
            [
              'https://github.com/personal/thither/tree/{}',
              ['git', 'personal'],
              ['thither'],
              expect.objectContaining({ argDelta: -1 }),
            ],
          ],
          inputs: ['git'],
        },
      ],
    ]);
  });

  it('§7 select every target with an empty query', () => {
    const state = [
      'S',
      {
        targets: [
          [['company', 'git'], 'https://github.com/company/{}'],
          [['docs'], 'https://docs.example.com/'],
        ],
        focus: [],
      },
    ];
    const stack = run([state]);

    expect(stack).toEqual([
      state,
      [
        'R',
        {
          matches: [
            ['https://docs.example.com/', ['docs'], [], { argDelta: 0, positions: [], score: 0 }],
            [
              'https://github.com/company/{}',
              ['company', 'git'],
              [],
              { argDelta: -1, positions: [], score: 0 },
            ],
          ],
          inputs: [],
        },
      ],
    ]);
  });

  it('§7 stop at the first result', () => {
    const s0 = ['S', { targets: [[['git'], 'https://github.com/']], focus: [] }];
    const s1 = ['S', { targets: [[['docs'], 'https://docs.example.com/']], focus: [] }];
    const stack = run([s0, 'git', '.$', s1, 'docs', '.$']);

    expect(stack).toHaveLength(2);
    expect(stack[0]).toEqual(s0);
    expect(stack[1]).toEqual([
      'R',
      expect.objectContaining({
        matches: [['https://github.com/', ['git'], [], expect.objectContaining({ argDelta: 0 })]],
        inputs: ['git'],
      }),
    ]);
  });
});

// Tokens chosen to reach every parse branch: separator, escapes, bound and unbound operations,
// templates, URLs, JSON that is and is not a valid envelope, and plain junk.
const alphabet: readonly unknown[] = [
  '.',
  '..',
  '...',
  '..$',
  '.$',
  '.set',
  '.rm',
  '.@',
  '.nope',
  '',
  ' ',
  '{}',
  '{}{}',
  'https://example.com/{}',
  'https://example.com/{}/tree/{}',
  'javascript:alert(1)',
  'not a url',
  'Ünïcödé',
  '$&',
  '["S", {"targets": [], "focus": []}]',
  ['S', { targets: [], focus: [] }],
  ['S', { targets: [[['a'], 'https://a/{}']], focus: ['a'] }],
  ['S', { targets: 'wrong' }],
  ['S', { targets: [[['a'], 'not-a-url']], focus: [] }],
  ['R', { matches: [], inputs: [] }],
  ['R', 'wrong'],
  ['E', { type: 'unknown_error', description: 'boom' }],
  ['E', { type: 'made_up', description: 'boom' }],
  ['L', ['a']],
  ['x', {}],
  null,
  undefined,
  42,
  {},
  [],
  ['S'],
];

// Deterministic PRNG so a failing sequence is reproducible from its seed.
const mulberry32 = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

describe('totality (dsl.md §2, §6)', () => {
  it('no sequence of items makes pushToken or execute throw', () => {
    const interp = createInterpreter(defaultEnv());
    const random = mulberry32(14);

    for (let round = 0; round < 500; round++) {
      const length = Math.floor(random() * 12);
      const items = Array.from({ length }, () => alphabet[Math.floor(random() * alphabet.length)]);
      const seed: Stack = random() < 0.5 ? [emptyState()] : [];

      expect(() => {
        const program: Program = [];
        for (const item of items) {
          interp.pushToken(program, item);
        }
        interp.execute(program, seed);
      }, JSON.stringify(items)).not.toThrow();
    }
  });
});

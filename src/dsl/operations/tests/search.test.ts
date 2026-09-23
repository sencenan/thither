// dsl.md §4.4, §5 — .$: boundary inference, rendering, and match ordering

import { describe, expect, it } from 'vitest';
import { createInterpreter } from '../../interpreter.ts';
import type { OpFn, Program, Stack, Target } from '../../types.ts';
import { search } from '../search.ts';
import { companyGit, state } from './harness.ts';

// Binds the real `.$`; the interpreter appends it when a program does not end in one.
const run = (items: readonly unknown[]): Stack => {
  const interp = createInterpreter({ symbols: new Map<string, OpFn>([['.$', search]]) });
  const program: Program = [];
  for (const item of items) {
    interp.pushToken(program, item);
  }
  return interp.execute(program);
};

// hint with only argDelta asserted (score is the port's, never pinned); positions asserted when given.
const hint = (argDelta: number, positions?: readonly number[]) =>
  positions === undefined
    ? expect.objectContaining({ argDelta })
    : expect.objectContaining({ argDelta, positions });

const m = (
  dest: string,
  dims: readonly string[],
  args: readonly string[],
  argDelta: number,
  positions?: readonly number[],
) => [dest, dims, args, hint(argDelta, positions)];

const result = (matches: readonly unknown[], inputs: readonly string[]) => [
  'R',
  { matches, inputs },
];

// rendering-table targets (one target per state, so ordering is trivial)
const one = [['x'], 'https://example.com/{}'] as const;
const two = [['x'], 'https://example.com/{}/tree/{}'] as const;
const zero = [['x'], 'https://example.com/'] as const;

// ordering targets: all share `shared`, so `shared` selects every one
const oA: Target = [['alpha', 'shared'], 'https://a/{}']; // P1
const oB: Target = [['beta', 'shared'], 'https://b/{}/{}']; // P2
const oC: Target = [['gamma', 'shared'], 'https://c/']; // P0

type Case = readonly [name: string, program: readonly unknown[], stack: readonly unknown[]];

const cases: readonly Case[] = [
  // §4.4 longest-prefix inference — the company/company git/company git thither ladder
  [
    '§4.4 a single-literal prefix matches; the template keeps its {}',
    [state([companyGit]), 'company'],
    [
      state([companyGit]),
      result(
        [m('https://github.com/company/{}', ['company', 'git'], [], -1, [0, 1, 2, 3, 4, 5, 6])],
        ['company'],
      ),
    ],
  ],
  [
    '§4.4 the longest matching prefix is taken, not the first: company git consumes both',
    [state([companyGit]), 'company', 'git'],
    [
      state([companyGit]),
      result(
        [
          m(
            'https://github.com/company/{}',
            ['company', 'git'],
            [],
            -1,
            [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
          ),
        ],
        ['company', 'git'],
      ),
    ],
  ],
  [
    '§4.4 a literal past the longest matching prefix becomes an argument',
    [state([companyGit]), 'company', 'git', 'thither'],
    [
      state([companyGit]),
      result(
        [m('https://github.com/company/thither', ['company', 'git'], ['thither'], 0)],
        ['company', 'git'],
      ),
    ],
  ],
  [
    '§4.4 when no prefix matches, the result is empty and inputs still report the attempt',
    [state([companyGit]), 'zzz'],
    [state([companyGit]), result([], ['zzz'])],
  ],

  // §4.4 focus-only and select-all
  [
    '§4.4 [K, S] .$ searches on focus alone; inputs is empty',
    [state([companyGit, [['git', 'personal'], 'https://github.com/me/{}']], ['company'])],
    [
      state([companyGit, [['git', 'personal'], 'https://github.com/me/{}']], ['company']),
      result([m('https://github.com/company/{}', ['company', 'git'], [], -1)], []),
    ],
  ],
  [
    '§7 an empty query selects every target with empty evidence; argument balance orders them',
    [state([companyGit, [['docs'], 'https://docs.example.com/']])],
    [
      state([companyGit, [['docs'], 'https://docs.example.com/']]),
      result(
        [
          m('https://docs.example.com/', ['docs'], [], 0, []),
          m('https://github.com/company/{}', ['company', 'git'], [], -1, []),
        ],
        [],
      ),
    ],
  ],

  // §4.4 R.inputs records original spelling of the matching literals
  [
    '§7 inputs keep original case while matching lowercased; the trailing literal renders',
    [state([companyGit]), 'Company', 'Git', 'MyRepo'],
    [
      state([companyGit]),
      result(
        [m('https://github.com/company/MyRepo', ['company', 'git'], ['MyRepo'], 0)],
        ['Company', 'Git'],
      ),
    ],
  ],

  // §5 rendering table — one row each
  [
    '§5 one placeholder, one argument: rendered exactly, argDelta 0',
    [state([one]), 'x', 'MyRepo'],
    [state([one]), result([m('https://example.com/MyRepo', ['x'], ['MyRepo'], 0)], ['x'])],
  ],
  [
    '§5 an extra argument is ignored during substitution but counted in argDelta',
    [state([one]), 'x', 'thither', 'extra'],
    [state([one]), result([m('https://example.com/thither', ['x'], ['thither'], 1)], ['x'])],
  ],
  [
    '§5 a slash in an argument produces a path segment, not new template syntax',
    [state([one]), 'x', 'a/b'],
    [state([one]), result([m('https://example.com/a/b', ['x'], ['a/b'], 0)], ['x'])],
  ],
  [
    '§5 a missing argument leaves its placeholder intact in a later slot',
    [state([two]), 'x', 'thither'],
    [
      state([two]),
      result([m('https://example.com/thither/tree/{}', ['x'], ['thither'], -1)], ['x']),
    ],
  ],
  [
    '§5 no argument leaves the whole template intact with argDelta -1',
    [state([one]), 'x'],
    [state([one]), result([m('https://example.com/{}', ['x'], [], -1)], ['x'])],
  ],
  [
    '§5 a zero-placeholder template ignores its argument, argDelta +1',
    [state([zero]), 'x', 'ignored'],
    [state([zero]), result([m('https://example.com/', ['x'], [], 1)], ['x'])],
  ],

  // §4.4 the separator: matching portion matched in full, suffix taken as arguments
  [
    '§4.4 a URL after the separator is an unescaped argument, not fuzzy-matched',
    [state([[['lookup'], 'https://example.com/{}']]), 'lookup', '.', 'https://example.com'],
    [
      state([[['lookup'], 'https://example.com/{}']]),
      result(
        [m('https://example.com/https://example.com', ['lookup'], ['https://example.com'], 0)],
        ['lookup'],
      ),
    ],
  ],
  [
    '§4.4 an empty matching portion searches on focus alone and keeps the suffix; inputs empty',
    [state([companyGit], ['company']), '.', 'MyRepo'],
    [
      state([companyGit], ['company']),
      result([m('https://github.com/company/MyRepo', ['company', 'git'], ['MyRepo'], 0)], []),
    ],
  ],

  // §5 match ordering — each key isolated
  [
    '§5 nonnegative argDelta leads, negative trails (one argument over the shared targets)',
    [state([oA, oB, oC]), 'shared', 'q'],
    [
      state([oA, oB, oC]),
      result(
        [
          m('https://a/q', ['alpha', 'shared'], ['q'], 0),
          m('https://c/', ['gamma', 'shared'], [], 1),
          m('https://b/q/{}', ['beta', 'shared'], ['q'], -1),
        ],
        ['shared'],
      ),
    ],
  ],
  [
    '§5 within the nonnegative group |argDelta| ascends: 0, then +1, then +2',
    [state([oA, oB, oC]), 'shared', 'q', 'w'],
    [
      state([oA, oB, oC]),
      result(
        [
          m('https://b/q/w', ['beta', 'shared'], ['q', 'w'], 0),
          m('https://a/q', ['alpha', 'shared'], ['q'], 1),
          m('https://c/', ['gamma', 'shared'], [], 2),
        ],
        ['shared'],
      ),
    ],
  ],
  [
    '§5 a weakly-scored +1 still precedes a strongly-scored +2, against target-set order',
    [
      state([
        [['shared'], 'https://p2/'],
        [['ashared'], 'https://p1/{}'],
      ]),
      'shared',
      'q',
      'w',
    ],
    [
      state([
        [['shared'], 'https://p2/'],
        [['ashared'], 'https://p1/{}'],
      ]),
      result(
        [m('https://p1/q', ['ashared'], ['q'], 1), m('https://p2/', ['shared'], [], 2)],
        ['shared'],
      ),
    ],
  ],
  [
    '§5 equal argDelta falls to score descending, overriding target-set order',
    [
      state([
        [['ashared'], 'https://lo/{}'],
        [['shared'], 'https://hi/{}'],
      ]),
      'shared',
    ],
    [
      state([
        [['ashared'], 'https://lo/{}'],
        [['shared'], 'https://hi/{}'],
      ]),
      result(
        [m('https://hi/{}', ['shared'], [], -1), m('https://lo/{}', ['ashared'], [], -1)],
        ['shared'],
      ),
    ],
  ],
  [
    '§5 tied score and argDelta fall to target-set order, not dimension order',
    [
      state([
        [['bbb'], 'https://b1/{}'],
        [['aaa'], 'https://a2/{}'],
      ]),
    ],
    [
      state([
        [['bbb'], 'https://b1/{}'],
        [['aaa'], 'https://a2/{}'],
      ]),
      result(
        [m('https://b1/{}', ['bbb'], [], -1, []), m('https://a2/{}', ['aaa'], [], -1, [])],
        [],
      ),
    ],
  ],
];

describe('.$ (dsl.md §4.4, §5)', () => {
  it.each(cases)('%s', (_name, program, stack) => {
    expect(run(program)).toEqual(stack);
  });
});

// The transition table's invalid-stack rule: no state to search over is missing_operand.
describe('.$ — operand contract', () => {
  const error = (type: string) => ['E', expect.objectContaining({ type })];

  it('§6 .$ with no state anywhere is missing_operand', () => {
    expect(run(['git'])).toEqual([error('missing_operand')]);
  });

  it('§1 a trailing .$ on a sealed error stack is absorbed', () => {
    const sealed = ['E', { type: 'unknown_error', description: 'boom' }];
    expect(run([state([]), sealed])).toEqual([state([]), sealed]);
  });
});

// dsl.md §4.4, §5 — .$: boundary inference, rendering, variant fan-out, and match ordering

import { describe, expect, it } from 'vitest';
import { createInterpreter } from '../../interpreter.ts';
import type { OpFn, Program, Stack } from '../../types.ts';
import { search } from '../search.ts';
import { companyDocs, companyGit, personalGit, state, type TargetSpec } from './harness.ts';

// Binds the real `.$` and closes each program with it, as a host does (ADR 0007):
// the interpreter appends nothing, so the terminal search must be explicit.
const run = (items: readonly unknown[]): Stack => {
  const interp = createInterpreter({ symbols: new Map<string, OpFn>([['.$', search]]) });
  const program: Program = [];
  for (const item of [...items, '.$']) {
    interp.pushToken(program, item);
  }
  return interp.execute(program);
};

// hint with only argDelta asserted (score is the port's, never pinned); positions asserted when given.
const hint = (argDelta: number, positions?: readonly number[]) =>
  positions === undefined
    ? expect.objectContaining({ argDelta })
    : expect.objectContaining({ argDelta, positions });

// m carries the target's key (a string) in its second slot (dsl.md §1).
const m = (
  dest: string,
  key: string,
  args: readonly string[],
  argDelta: number,
  positions?: readonly number[],
) => [dest, key, args, hint(argDelta, positions)];

const result = (matches: readonly unknown[], inputs: readonly string[]) => [
  'R',
  { matches, inputs },
];

// rendering-table targets (one target, one variant, so ordering is trivial)
const one: TargetSpec = [['x'], 'https://example.com/{}'];
const two: TargetSpec = [['x'], 'https://example.com/{}/tree/{}'];
const zero: TargetSpec = [['x'], 'https://example.com/'];

// variant targets — one target, several arities
const gap: TargetSpec = [['gap'], 'https://gap/', 'https://gap/{}/{}']; // arities {0, 2}
const ladder: TargetSpec = [['ladder'], 'https://l/', 'https://l/{}', 'https://l/{}/{}']; // {0,1,2}
const neg: TargetSpec = [['neg'], 'https://n/{}', 'https://n/{}/{}', 'https://n/{}/{}/{}']; // {1,2,3}

// per-dimension matching target
const apple: TargetSpec = [['apple', 'mango'], 'https://fruit.example/{}'];

type Case = readonly [name: string, program: readonly unknown[], stack: readonly unknown[]];

const cases: readonly Case[] = [
  // §4.4 longest-prefix inference — the company/company git/company git thither ladder
  [
    '§4.4 a single-literal prefix matches; the template keeps its {}',
    [state([companyGit]), 'company'],
    [
      state([companyGit]),
      result(
        [m('https://github.com/company/{}', 'company git', [], -1, [0, 1, 2, 3, 4, 5, 6])],
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
            'company git',
            [],
            -1,
            [0, 1, 2, 3, 4, 5, 6, 8, 9, 10], // the joining space (7) is never evidence
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
        [m('https://github.com/company/thither', 'company git', ['thither'], 0)],
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
    [state([companyGit, personalGit], ['company'])],
    [
      state([companyGit, personalGit], ['company']),
      result([m('https://github.com/company/{}', 'company git', [], -1)], []),
    ],
  ],
  [
    '§7 an empty query selects every target; ties on score fall to target-set order',
    [state([companyGit, [['docs'], 'https://docs.example.com/']])],
    [
      state([companyGit, [['docs'], 'https://docs.example.com/']]),
      result(
        [
          m('https://github.com/company/{}', 'company git', [], -1, []),
          m('https://docs.example.com/', 'docs', [], 0, []),
        ],
        [],
      ),
    ],
  ],

  // §4.4 R.inputs records original spelling of the matching literals
  [
    '§7 inputs keep original spelling; the trailing literal renders with its case intact',
    [state([companyGit]), 'company', 'git', 'MyRepo'],
    [
      state([companyGit]),
      result(
        [m('https://github.com/company/MyRepo', 'company git', ['MyRepo'], 0)],
        ['company', 'git'],
      ),
    ],
  ],
  [
    '§3 smart-case: an uppercase term is case-sensitive and matches no key, so it is taken as an argument',
    [state([companyGit]), 'company', 'Git'],
    [
      state([companyGit]),
      result([m('https://github.com/company/Git', 'company git', ['Git'], 0)], ['company']),
    ],
  ],

  // §3 fzf operators are live in .$ queries
  [
    '§3 OR: git | docs selects targets matching either; ties fall to target-set order',
    [state([companyGit, companyDocs, personalGit]), 'git', '|', 'docs', '.'],
    [
      state([companyGit, companyDocs, personalGit]),
      result(
        [
          m('https://docs.company.com/{}', 'company docs', [], -1), // docs outscores git (4 chars vs 3)
          m('https://github.com/company/{}', 'company git', [], -1),
          m('https://github.com/me/{}', 'git personal', [], -1),
        ],
        ['git', '|', 'docs'],
      ),
    ],
  ],
  [
    '§3 NOT: git !personal selects the git targets without personal; the NOT term adds no evidence',
    [state([companyGit, companyDocs, personalGit]), 'git', '!personal', '.'],
    [
      state([companyGit, companyDocs, personalGit]),
      result(
        [m('https://github.com/company/{}', 'company git', [], -1, [8, 9, 10])],
        ['git', '!personal'],
      ),
    ],
  ],
  [
    "§3 exact: 'ompany matches the substring, cmpny does not",
    [state([companyGit]), "'ompany", '.'],
    [
      state([companyGit]),
      result(
        [m('https://github.com/company/{}', 'company git', [], -1, [1, 2, 3, 4, 5, 6])],
        ["'ompany"],
      ),
    ],
  ],
  [
    '§3 prefix anchor: ^git selects only the target whose key starts with git',
    [state([companyGit, personalGit]), '^git', '.'],
    [
      state([companyGit, personalGit]),
      result([m('https://github.com/me/{}', 'git personal', [], -1, [0, 1, 2])], ['^git']),
    ],
  ],
  [
    '§3 suffix anchor: git$ selects only the target whose key ends with git',
    [state([companyGit, personalGit]), 'git$', '.'],
    [
      state([companyGit, personalGit]),
      result([m('https://github.com/company/{}', 'company git', [], -1, [8, 9, 10])], ['git$']),
    ],
  ],
  [
    '§3 operators take part in prefix inference: git !personal MyRepo consumes the NOT term, MyRepo is the argument',
    [state([companyGit, personalGit]), 'git', '!personal', 'MyRepo'],
    [
      state([companyGit, personalGit]),
      result(
        [m('https://github.com/company/MyRepo', 'company git', ['MyRepo'], 0)],
        ['git', '!personal'],
      ),
    ],
  ],
  [
    '§3 focus joins the query as leading terms: focus [company] with git | docs is company AND (git OR docs)',
    [state([companyGit, companyDocs, personalGit], ['company']), 'git', '|', 'docs', '.'],
    [
      state([companyGit, companyDocs, personalGit], ['company']),
      result(
        [
          m('https://docs.company.com/{}', 'company docs', [], -1),
          m('https://github.com/company/{}', 'company git', [], -1),
        ],
        ['git', '|', 'docs'],
      ),
    ],
  ],

  // §3 each query term is matched independently (fzf extended search): every term must match, in
  // any order, so how an abbreviation sorts never affects selection.
  [
    '§3 each query term matches independently: m ppl selects apple mango with no argument',
    [state([apple]), 'm', 'ppl'],
    [
      state([apple]),
      result([m('https://fruit.example/{}', 'apple mango', [], -1, [1, 2, 3, 6])], ['m', 'ppl']),
    ],
  ],

  // §2 escaping — the accumulated form keeps `..`; one dot is removed wherever the literal is used
  [
    '§2 an escaped argument renders resolved: ..git substitutes as .git, and args holds .git',
    [state([companyGit]), 'company', 'git', '..git'],
    [
      state([companyGit]),
      result(
        [m('https://github.com/company/.git', 'company git', ['.git'], 0)],
        ['company', 'git'],
      ),
    ],
  ],
  [
    '§2 an escaped separator argument renders as a single dot',
    [state([one]), 'x', '.', '..'],
    [state([one]), result([m('https://example.com/.', 'x', ['.'], 0)], ['x'])],
  ],
  [
    '§2 an escaped matching literal is resolved when matched but kept verbatim in inputs',
    [state([[['.git', 'hooks'], 'https://hooks.example/{}']]), '..git', 'pre-commit'],
    [
      state([[['.git', 'hooks'], 'https://hooks.example/{}']]),
      result([m('https://hooks.example/pre-commit', '.git hooks', ['pre-commit'], 0)], ['..git']),
    ],
  ],

  // §5 rendering table — one row each
  [
    '§5 one placeholder, one argument: rendered exactly, argDelta 0',
    [state([one]), 'x', 'MyRepo'],
    [state([one]), result([m('https://example.com/MyRepo', 'x', ['MyRepo'], 0)], ['x'])],
  ],
  [
    '§5 an extra argument is ignored during substitution but counted in argDelta',
    [state([one]), 'x', 'thither', 'extra'],
    [state([one]), result([m('https://example.com/thither', 'x', ['thither'], 1)], ['x'])],
  ],
  [
    '§5 a slash in an argument produces a path segment, not new template syntax',
    [state([one]), 'x', 'a/b'],
    [state([one]), result([m('https://example.com/a/b', 'x', ['a/b'], 0)], ['x'])],
  ],
  [
    '§5 a missing argument leaves its placeholder intact in a later slot',
    [state([two]), 'x', 'thither'],
    [state([two]), result([m('https://example.com/thither/tree/{}', 'x', ['thither'], -1)], ['x'])],
  ],
  [
    '§5 no argument leaves the whole template intact with argDelta -1',
    [state([one]), 'x'],
    [state([one]), result([m('https://example.com/{}', 'x', [], -1)], ['x'])],
  ],
  [
    '§5 a zero-placeholder template ignores its argument, argDelta +1',
    [state([zero]), 'x', 'ignored'],
    [state([zero]), result([m('https://example.com/', 'x', [], 1)], ['x'])],
  ],

  // §4.4 the separator: matching portion matched in full, suffix taken as arguments
  [
    '§4.4 a URL after the separator is an unescaped argument, not fuzzy-matched',
    [state([[['lookup'], 'https://example.com/{}']]), 'lookup', '.', 'https://example.com'],
    [
      state([[['lookup'], 'https://example.com/{}']]),
      result(
        [m('https://example.com/https://example.com', 'lookup', ['https://example.com'], 0)],
        ['lookup'],
      ),
    ],
  ],
  [
    '§4.4 an empty matching portion searches on focus alone and keeps the suffix; inputs empty',
    [state([companyGit], ['company']), '.', 'MyRepo'],
    [
      state([companyGit], ['company']),
      result([m('https://github.com/company/MyRepo', 'company git', ['MyRepo'], 0)], []),
    ],
  ],

  // §4.4 best fit vs one-per-variant, within one target
  [
    '§4.4 a best fit yields exactly one match: ladder with one argument uses the arity-1 variant',
    [state([ladder]), 'ladder', '.', 'q'],
    [state([ladder]), result([m('https://l/q', 'ladder', ['q'], 0)], ['ladder'])],
  ],
  [
    '§4.4 no best fit fans out one row per variant: gap with one argument lists both',
    [state([gap]), 'gap', '.', 'q'],
    [
      state([gap]),
      result([m('https://gap/', 'gap', [], 1), m('https://gap/q/{}', 'gap', ['q'], -1)], ['gap']),
    ],
  ],

  // §5 variant ordering within a target
  [
    '§5 within a target, the nonnegative group ascends by |argDelta|: +1 before +2 before +3',
    [state([ladder]), 'ladder', '.', 'q', 'w', 'z'],
    [
      state([ladder]),
      result(
        [
          m('https://l/q/w', 'ladder', ['q', 'w'], 1),
          m('https://l/q', 'ladder', ['q'], 2),
          m('https://l/', 'ladder', [], 3),
        ],
        ['ladder'],
      ),
    ],
  ],
  [
    '§5 within a target, the negative group ascends by |argDelta|: -1 before -2 before -3',
    [state([neg]), 'neg'],
    [
      state([neg]),
      result(
        [
          m('https://n/{}', 'neg', [], -1),
          m('https://n/{}/{}', 'neg', [], -2),
          m('https://n/{}/{}/{}', 'neg', [], -3),
        ],
        ['neg'],
      ),
    ],
  ],

  // §5 match ordering across targets
  [
    '§5 targets are ordered by score descending, overriding target-set order',
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
        [m('https://hi/{}', 'shared', [], -1), m('https://lo/{}', 'ashared', [], -1)],
        ['shared'],
      ),
    ],
  ],
  [
    '§5 equal score falls to target-set order, not key order',
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
      result([m('https://b1/{}', 'bbb', [], -1, []), m('https://a2/{}', 'aaa', [], -1, [])], []),
    ],
  ],
  [
    '§5 a multi-variant target keeps its rows contiguous while ordered among other targets by score',
    [
      state([
        [['shared'], 'https://a/', 'https://a/{}/{}'],
        [['ashared'], 'https://b/{}'],
      ]),
      'shared',
      'q',
    ],
    [
      state([
        [['shared'], 'https://a/', 'https://a/{}/{}'],
        [['ashared'], 'https://b/{}'],
      ]),
      result(
        [
          m('https://a/', 'shared', [], 1),
          m('https://a/q/{}', 'shared', ['q'], -1),
          m('https://b/q', 'ashared', ['q'], 0),
        ],
        ['shared'],
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

// dsl.md §4.1 — .set: insert or update a target by exact key

import { describe, expect, it } from 'vitest';
import type { Stack } from '../../types.ts';
import { set } from '../set.ts';
import {
  type Case,
  companyDocs,
  companyGit,
  error,
  explicitError,
  personalGit,
  runWith,
  state,
  type TargetSpec,
  testInterp,
  three,
} from './harness.ts';

const run = runWith({ '.set': set });
const companyGitLab: TargetSpec = [['company', 'git'], 'https://gitlab.com/company/{}'];
const jira0: TargetSpec = [['jira'], 'https://jira.example.com'];
const jira01: TargetSpec = [
  ['jira'],
  'https://jira.example.com',
  'https://jira.example.com/browse/{}',
];

const cases: readonly Case[] = [
  // operand extraction
  [
    '§4.1 the first literal is the destination; the separator and its suffix play no part',
    [state([]), 'https://github.com/company/{}', 'company', 'git', '.', 'ignored', '.set'],
    [state([companyGit])],
  ],
  [
    '§4.1 a plain URL with zero placeholders is a valid destination',
    [state([]), 'https://example.com/', 'home', '.set'],
    [state([[['home'], 'https://example.com/']])],
  ],
  [
    '§2 stores the original template text, not the parser-normalized probe',
    [state([]), 'MyApp:Open/{}', 'app', '.set'],
    [state([[['app'], 'MyApp:Open/{}']])],
  ],
  [
    '§2 validation renders {} before parsing: a placeholder in the scheme is accepted',
    [state([]), '{}://example.com', 'proto', '.set'],
    [state([[['proto'], '{}://example.com']])],
  ],

  // exact-key insert / replace
  [
    '§4.1 an unknown key appends a target to the end with the normalized combined dimensions',
    [state([companyDocs]), 'https://github.com/company/{}', 'GIT', 'Company', 'git', '.set'],
    [state([companyDocs, companyGit])],
  ],
  [
    '§4.1 an existing key replaces only that arity, keeping the key and position',
    [state(three), 'https://gitlab.com/company/{}', 'company', 'git', '.set'],
    [state([companyGitLab, companyDocs, personalGit])],
  ],
  [
    '§4.1 the key is normalized, so query order is irrelevant: git company hits company git',
    [state(three), 'https://gitlab.com/company/{}', 'git', 'company', '.set'],
    [state([companyGitLab, companyDocs, personalGit])],
  ],
  [
    '§4.1 Git normalizes to git and hits the same key rather than duplicating it',
    [state([[['git'], 'https://a/']]), 'https://b/', 'Git', '.set'],
    [state([[['git'], 'https://b/']])],
  ],
  [
    '§4.1 exact key, not fuzzy: comp git is a different key and inserts a new target',
    [state([companyGit]), 'https://gitlab.com/company/{}', 'comp', 'git', '.set'],
    [state([companyGit, [['comp', 'git'], 'https://gitlab.com/company/{}']])],
  ],
  [
    '§4.1 a subset key is its own target: company beside company git, not a rewrite',
    [state([companyGit]), 'https://company.com/', 'company', '.set'],
    [state([companyGit, [['company'], 'https://company.com/']])],
  ],

  // variants keyed by arity
  [
    '§4.1 a second .set of a new arity adds a variant, kept in arity-ascending order',
    [state([jira0]), 'https://jira.example.com/browse/{}', 'jira', '.set'],
    [state([jira01])],
  ],
  [
    '§4.1 setting a variant of an existing arity replaces just that variant',
    [
      state([[['jira'], 'https://jira.example.com', 'https://old/browse/{}']]),
      'https://jira.example.com/browse/{}',
      'jira',
      '.set',
    ],
    [state([jira01])],
  ],
  [
    '§4.1 jira and company jira are different targets even though a search selects both',
    [state([[['company', 'jira'], 'https://x/']]), 'https://jira.example.com', 'jira', '.set'],
    [state([[['company', 'jira'], 'https://x/'], jira0])],
  ],

  // focus plays no part
  [
    '§4.1 focus is not consulted: with focus [company], jira .set stores the key jira alone',
    [state([], ['company']), 'https://jira.example.com', 'jira', '.set'],
    [state([jira0], ['company'])],
  ],

  // missing_operand
  [
    '§6 S .set is missing_operand: no literal array',
    [state([]), '.set'],
    [state([]), error('missing_operand')],
  ],
  [
    '§6 S https://github.com/company/{} .set is missing_operand: no explicit dimension',
    [state([]), 'https://github.com/company/{}', '.set'],
    [state([]), error('missing_operand')],
  ],
  [
    '§6 S https://github.com/company/{} . ignored .set is missing_operand: the suffix is ignored',
    [state([]), 'https://github.com/company/{}', '.', 'ignored', '.set'],
    [state([]), error('missing_operand')],
  ],
  [
    '§4.1 focus cannot satisfy the explicit-dimension requirement',
    [state([], ['company']), 'https://github.com/company/{}', '.set'],
    [state([], ['company']), error('missing_operand')],
  ],
  [
    '§6 with no state anywhere on the stack the literal array is consumed and E is pushed',
    ['https://example.com/{}', 'git', '.set'],
    [error('missing_operand')],
  ],

  // invalid_dimension — what .set stores is a key, so fzf operator syntax is never a dimension
  [
    '§4.1 an explicit NOT term is invalid_dimension: !personal https://x/ .set stores nothing',
    [state(three), 'https://x/', '!personal', '.set'],
    [state(three), error('invalid_dimension')],
  ],
  [
    '§4.1 an anchored term is invalid_dimension: ^git https://x/ .set',
    [state([]), 'https://x/', '^git', '.set'],
    [state([]), error('invalid_dimension')],
  ],
  [
    '§4.1 a trailing-$ term is invalid_dimension: git$ https://x/ .set',
    [state([]), 'https://x/', 'git$', '.set'],
    [state([]), error('invalid_dimension')],
  ],
  [
    '§4.1 the OR token is invalid_dimension: git | docs https://x/ .set',
    [state([]), 'https://x/', 'git', '|', 'docs', '.set'],
    [state([]), error('invalid_dimension')],
  ],
  [
    '§4.1 the destination is extracted before the check, so an operator after the separator is ignored',
    [state([]), 'https://example.com/', 'home', '.', '!ignored', '.set'],
    [state([[['home'], 'https://example.com/']])],
  ],

  // invalid_destination
  [
    '§2 a scheme-bearing literal that fails render-then-parse is invalid_destination',
    [state([]), 'https://exa|mple.com/{}', 'company', '.set'],
    [state([]), error('invalid_destination')],
  ],
  [
    '§6 S company git .set is invalid_destination: the first literal is always the destination',
    [state([]), 'company', 'git', '.set'],
    [state([]), error('invalid_destination')],
  ],
  [
    '§4.1 does not search forward for a URL: a leading dimension is an unusable destination',
    [state([]), 'company', 'https://github.com/company/{}', 'git', '.set'],
    [state([]), error('invalid_destination')],
  ],

  // state preservation
  [
    '§6 failure retains the nearest state: [S0, L0, S1, L1] .set -> [S0, L0, S1, E]',
    [state([]), 'stray', state(three), 'notaurl', 'git', '.set'],
    [state([]), ['L', ['stray']], state(three), error('invalid_destination')],
  ],
  [
    '§1 on a sealed stack .set produces nothing that survives',
    [state([]), 'git', explicitError, 'company', 'https://example.com/{}', '.set'],
    [state([]), ['L', ['git']], explicitError],
  ],
];

describe('.set (dsl.md §4.1)', () => {
  it.each(cases)('%s', (_name, program, stack) => {
    expect(run(program)).toEqual(stack);
  });
});

// The evaluator never leaves anything but a state (or nothing) beneath a literal
// array, so this contract is only observable by calling the operation directly.
describe('.set — operand contract', () => {
  it('§6 consumes only its literal array: a non-state value beneath it is left in place', () => {
    const stack: Stack = [
      ['L', ['stray']],
      ['L', ['git', 'https://example.com/{}']],
    ];
    expect(set(testInterp, stack)).toEqual([['L', ['stray']], error('missing_operand')]);
  });
});

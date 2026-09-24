// dsl.md §4.1 — .set: insert or update a target

import { describe, expect, it } from 'vitest';
import type { Stack, Target } from '../../types.ts';
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
  testInterp,
  three,
} from './harness.ts';

const run = runWith({ '.set': set });
const companyGitLab: Target = [['company', 'git'], 'https://gitlab.com/company/{}'];

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

  // cardinality
  [
    '§4.1 zero matches appends a target to the end with normalized combined dimensions',
    [state([companyDocs]), 'https://github.com/company/{}', 'GIT', 'Company', 'git', '.set'],
    [state([companyDocs, companyGit])],
  ],
  [
    '§4.1 exactly one match replaces only that destination, keeping dimensions and position',
    [state(three), 'https://gitlab.com/company/{}', 'comp', 'git', '.set'],
    [state([companyGitLab, companyDocs, personalGit])],
  ],
  [
    '§4.1 fuzzy updating does not rename dimensions: comp git keeps [company, git]',
    [state([companyGit]), 'https://gitlab.com/company/{}', 'comp', 'git', '.set'],
    [state([companyGitLab])],
  ],
  [
    '§4.1 more than one match is ambiguous_set and leaves the input state unchanged',
    [state(three), 'https://gitlab.com/{}', 'git', '.set'],
    [state(three), error('ambiguous_set')],
  ],

  // §4.1 fuzzy selection has no exact-match preference: a query that is a subset of an
  // existing target's dimensions selects that target, so the subset can never be inserted
  // beside it. Pinned here so the consequence is visible; changing it is a §4.1 amendment.
  [
    '§4.1 a subset query updates its superset target: company alone rewrites [company, git], no [company] target is inserted',
    [state([companyGit]), 'https://company.com/', 'company', '.set'],
    [state([[['company', 'git'], 'https://company.com/']])],
  ],
  [
    '§4.1 a subset query with two superset targets is ambiguous_set: [company] cannot be created beside [company, git] and [company, docs]',
    [state([companyGit, companyDocs]), 'https://company.com/', 'company', '.set'],
    [state([companyGit, companyDocs]), error('ambiguous_set')],
  ],

  // focus joins the query
  [
    '§3 focus is prepended to the explicit dimensions when matching',
    [state(three, ['company']), 'https://gitlab.com/company/{}', 'git', '.set'],
    [state([companyGitLab, companyDocs, personalGit], ['company'])],
  ],
  [
    '§4.1 an inserted target carries the combined focus and explicit dimensions',
    [state([companyDocs], ['personal']), 'https://docs.me.com/{}', 'docs', '.set'],
    [state([companyDocs, [['docs', 'personal'], 'https://docs.me.com/{}']], ['personal'])],
  ],
  [
    '§3 query order is irrelevant: git company selects the same target as company git',
    [state(three), 'https://gitlab.com/company/{}', 'git', 'company', '.set'],
    [state([companyGitLab, companyDocs, personalGit])],
  ],
  [
    '§3 the query is one sorted pattern: comp git updates [company, git]',
    [state([companyGit]), 'https://gitlab.com/company/{}', 'comp', 'git', '.set'],
    [state([companyGitLab])],
  ],
  [
    '§3 matching is diacritic-insensitive: cafe matches café',
    [state([[['café'], 'https://cafe.example/']]), 'https://cafe.example/menu', 'cafe', '.set'],
    [state([[['café'], 'https://cafe.example/menu']])],
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

  // invalid_dimension — what .set stores must be plain dimensions, never fzf operator syntax
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
  [
    '§4.1 .set matches on the normalized query, so Git https://x/ .set updates the stored git target rather than duplicating it',
    [state([[['git'], 'https://a/']]), 'https://b/', 'Git', '.set'],
    [state([[['git'], 'https://b/']])],
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
    [state([]), 'stray', state(three), 'https://gitlab.com/{}', 'git', '.set'],
    [state([]), ['L', ['stray']], state(three), error('ambiguous_set')],
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

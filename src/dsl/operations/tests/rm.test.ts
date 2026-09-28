// dsl.md §4.2 — .rm: remove matching targets, or a single variant by arity

import { describe, expect, it } from 'vitest';
import type { Stack } from '../../types.ts';
import { rm } from '../rm.ts';
import {
  type Case,
  companyDocs,
  error,
  explicitError,
  personalGit,
  runWith,
  state,
  type TargetSpec,
  testInterp,
  three,
} from './harness.ts';

const run = runWith({ '.rm': rm });

// A single target with two variants (arity 0 and arity 1), to exercise arity-targeted removal.
const jira: TargetSpec = [
  ['jira'],
  'https://jira.example.com',
  'https://jira.example.com/browse/{}',
];
const jira0: TargetSpec = [['jira'], 'https://jira.example.com'];
const jira1: TargetSpec = [['jira'], 'https://jira.example.com/browse/{}'];

const cases: readonly Case[] = [
  // whole-target removal (exact key, single variant)
  [
    '§4.2 removes the target with the exact key',
    [state(three), 'company', 'git', '.rm'],
    [state([companyDocs, personalGit])],
  ],
  [
    '§4.2 a single-variant target with no separator is removed whole',
    [state([jira0]), 'jira', '.rm'],
    [state([])],
  ],
  [
    '§4.2 no fuzzy matching: git alone names no key and removes nothing',
    [state(three), 'git', '.rm'],
    [state(three)],
  ],
  [
    '§4.2 no prefix matching: comp docs names no key and removes nothing',
    [state(three), 'comp', 'docs', '.rm'],
    [state(three)],
  ],
  [
    '§4.2 a key with no target is a successful no-op',
    [state(three), 'nonexistent', '.rm'],
    [state(three)],
  ],
  [
    '§4.2 dimensions are normalized: GIT company names the same key as company git',
    [state(three), 'GIT', 'company', '.rm'],
    [state([companyDocs, personalGit])],
  ],

  // a multi-variant target must be disambiguated by arity
  [
    '§4.2 a multi-variant target with no separator is missing_operand',
    [state([jira]), 'jira', '.rm'],
    [state([jira]), error('missing_operand')],
  ],

  // arity-targeted removal (with a separator)
  [
    '§4.2 with a separator, the suffix length names the arity to remove: jira . x removes arity 1',
    [state([jira]), 'jira', '.', 'x', '.rm'],
    [state([jira0])],
  ],
  [
    '§4.2 jira . .rm removes the arity-0 variant',
    [state([jira]), 'jira', '.', '.rm'],
    [state([jira1])],
  ],
  [
    "§4.2 removing a target's last variant drops the target",
    [state([jira0]), 'jira', '.', '.rm'],
    [state([])],
  ],
  [
    '§4.2 an arity with no matching variant leaves the target unchanged',
    [state([jira]), 'jira', '.', 'a', 'b', '.rm'],
    [state([jira])],
  ],
  [
    '§4.2 the suffix count is read, not its text: jira . anything removes arity 1',
    [state([jira]), 'jira', '.', 'anything', '.rm'],
    [state([jira0])],
  ],

  // focus never authorizes removal, and plays no part in the lookup
  [
    '§4.2 S .rm leaves state unchanged regardless of focus',
    [state(three, ['git']), '.rm'],
    [state(three, ['git'])],
  ],
  [
    '§4.2 S . ignored .rm: an empty matching portion removes nothing regardless of focus',
    [state(three, ['git']), '.', 'ignored', '.rm'],
    [state(three, ['git'])],
  ],
  [
    '§4.2 focus plays no part in the key: a focused git still names no target',
    [state(three, ['company']), 'git', '.rm'],
    [state(three, ['company'])],
  ],

  // operator syntax is refused, exactly as in .set
  [
    '§4.2 the NOT operator is invalid_dimension in .rm',
    [state(three), '!git', '.rm'],
    [state(three), error('invalid_dimension')],
  ],
  [
    '§4.2 the OR operator is invalid_dimension in .rm',
    [state(three), 'docs', '|', 'personal', '.rm'],
    [state(three), error('invalid_dimension')],
  ],
  [
    '§2 an escaped literal is resolved into the key: ..git names the dimension .git',
    [state([[['.git'], 'https://example.com/']]), '..git', '.rm'],
    [state([])],
  ],

  // missing_operand
  [
    '§6 with no state anywhere on the stack the literal array is consumed and E is pushed',
    ['git', '.rm'],
    [error('missing_operand')],
  ],
  ['§6 an empty stack is missing_operand', ['.rm'], [error('missing_operand')]],

  // state preservation
  [
    "§6 operates on the nearest state: [S0, L0, S1, L1] .rm -> [S0, L0, S1']",
    [state([]), 'stray', state(three), 'company', 'git', '.rm'],
    [state([]), ['L', ['stray']], state([companyDocs, personalGit])],
  ],
  [
    '§1 on a sealed stack .rm produces nothing that survives',
    [state(three), 'git', explicitError, 'company', '.rm'],
    [state(three), ['L', ['git']], explicitError],
  ],
];

describe('.rm (dsl.md §4.2)', () => {
  it.each(cases)('%s', (_name, program, stack) => {
    expect(run(program)).toEqual(stack);
  });
});

// The evaluator never leaves anything but a state (or nothing) beneath a literal
// array, so this contract is only observable by calling the operation directly.
describe('.rm — operand contract', () => {
  it('§6 consumes only its literal array: a non-state value beneath it is left in place', () => {
    const stack: Stack = [
      ['L', ['stray']],
      ['L', ['git']],
    ];
    expect(rm(testInterp, stack)).toEqual([['L', ['stray']], error('missing_operand')]);
  });
});

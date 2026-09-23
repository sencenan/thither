// dsl.md §4.2 — .rm: remove matching targets

import { describe, expect, it } from 'vitest';
import type { Stack } from '../../types.ts';
import { rm } from '../rm.ts';
import {
  type Case,
  companyDocs,
  companyGit,
  error,
  explicitError,
  personalGit,
  runWith,
  state,
  three,
} from './harness.ts';

const run = runWith({ '.rm': rm });

const cases: readonly Case[] = [
  // removal
  [
    '§4.2 removes every target matching the complete combined query',
    [state(three), 'git', '.rm'],
    [state([companyDocs])],
  ],
  [
    '§4.2 a unique match removes only that target, leaving the rest in place',
    [state(three), 'comp', 'docs', '.rm'],
    [state([companyGit, personalGit])],
  ],
  ['§4.2 zero matches is a successful no-op', [state(three), 'nonexistent', '.rm'], [state(three)]],
  [
    '§4.2 never shortens the query: company nonexistent removes nothing',
    [state(three), 'company', 'nonexistent', '.rm'],
    [state(three)],
  ],
  [
    "§4.2 the separator's suffix plays no part",
    [state(three), 'git', '.', 'company', '.rm'],
    [state([companyDocs])],
  ],

  // focus never authorizes removal
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

  // focus joins the query
  [
    '§3 focus is prepended to the explicit dimensions when matching',
    [state(three, ['company']), 'git', '.rm'],
    [state([companyDocs, personalGit], ['company'])],
  ],
  [
    '§3 query order is irrelevant: git company removes the same target as company git',
    [state(three), 'git', 'company', '.rm'],
    [state([companyDocs, personalGit])],
  ],
  [
    '§3 matching is case-insensitive: GIT removes the git targets',
    [state(three), 'GIT', '.rm'],
    [state([companyDocs])],
  ],
  [
    '§2 an escaped literal is resolved when matched: ..git matches the dimension .git',
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
    [state([]), 'stray', state(three), 'git', '.rm'],
    [state([]), ['L', ['stray']], state([companyDocs])],
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
    expect(rm(stack)).toEqual([['L', ['stray']], error('missing_operand')]);
  });
});

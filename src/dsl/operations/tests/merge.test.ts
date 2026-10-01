// dsl.md §4.6 — .merge: combine two states into one

import { describe, expect, it } from 'vitest';
import { defaultEnv } from '../../env.ts';
import type { Stack } from '../../types.ts';
import { merge } from '../merge.ts';
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
} from './harness.ts';

const frozen = <T>(value: T): T => {
  if (value !== null && typeof value === 'object') {
    Object.values(value).forEach(frozen);
    Object.freeze(value);
  }
  return value;
};

const run = runWith({ '.merge': merge });

const jiraBelow: TargetSpec = [['jira'], 'https://jira.a.com', 'https://jira.a.com/browse/{}'];
const jiraAbove: TargetSpec = [['jira'], 'https://jira.b.com/{}', 'https://jira.b.com/{}/{}'];

const cases: readonly Case[] = [
  // targets
  [
    '§4.6 [S1, S2] unites the targets of both',
    [state([companyGit]), state([personalGit]), '.merge'],
    [state([companyGit, personalGit])],
  ],
  [
    '§4.6 a key in both unites its variants, the top state winning an arity both hold',
    [state([jiraBelow]), state([jiraAbove]), '.merge'],
    [
      state([
        [['jira'], 'https://jira.a.com', 'https://jira.b.com/{}', 'https://jira.b.com/{}/{}'],
      ]),
    ],
  ],
  [
    '§4.6 the top state wins an arity-0 variant too',
    [state([[['home'], 'https://a.com']]), state([[['home'], 'https://b.com']]), '.merge'],
    [state([[['home'], 'https://b.com']])],
  ],

  // focus
  [
    "§4.6 focus is the top state's",
    [state([], ['company']), state([], ['!personal']), '.merge'],
    [state([], ['!personal'])],
  ],
  [
    "§4.6 the top state's empty focus clears the merged focus",
    [state([], ['company']), state([]), '.merge'],
    [state([])],
  ],

  // alias definitions
  [
    '§4.6 alias definitions are united, the top state winning a short form both define',
    [
      state([], [], { gh: 'github', doc: 'docs' }),
      state([], [], { gh: 'GitHub', me: 'sencenan' }),
      '.merge',
    ],
    [state([], [], { gh: 'GitHub', doc: 'docs', me: 'sencenan' })],
  ],

  // the untouched prefix
  [
    "§4.6 only the top two states are merged: [K, S1, S2] .merge -> [K, S']",
    [state([companyDocs]), 'stray', state([companyGit]), state([personalGit]), '.merge'],
    [state([companyDocs]), ['L', ['stray']], state([companyGit, personalGit])],
  ],

  // missing_operand: a state taken off the stack is put back beneath the error
  [
    '§6 [S] .merge puts its state back: [S, E]',
    [state([companyGit]), '.merge'],
    [state([companyGit]), error('missing_operand')],
  ],
  [
    '§6 [L, S] .merge puts its state back above the L: [L, S, E]',
    ['stray', state([companyGit]), '.merge'],
    [['L', ['stray']], state([companyGit]), error('missing_operand')],
  ],
  [
    '§6 [S1, L, S2] .merge puts S2 back: [S1, L, S2, E]',
    [state([companyDocs]), 'stray', state([companyGit]), '.merge'],
    [state([companyDocs]), ['L', ['stray']], state([companyGit]), error('missing_operand')],
  ],
  [
    '§6 an L on top is not an operand and stays: [S, L] -> [S, L, E]',
    [state([companyGit]), 'stray', '.merge'],
    [state([companyGit]), ['L', ['stray']], error('missing_operand')],
  ],
  [
    '§6 an L above two states stays and nothing is merged: [S1, S2, L] -> [S1, S2, L, E]',
    [state([companyDocs]), state([companyGit]), 'stray', '.merge'],
    [state([companyDocs]), state([companyGit]), ['L', ['stray']], error('missing_operand')],
  ],
  ['§6 an empty stack is missing_operand', ['.merge'], [error('missing_operand')]],
  [
    '§1 on a sealed stack .merge produces nothing that survives',
    [state([companyDocs]), state([companyGit]), explicitError, '.merge'],
    [state([companyDocs]), state([companyGit]), explicitError],
  ],
];

describe('.merge (dsl.md §4.6)', () => {
  it.each(cases)('%s', (_name, program, stack) => {
    expect(run(program)).toEqual(stack);
  });

  it("§3/§4.6 target-set order: the lower state's order, then the top state's new keys", () => {
    const below = state([companyGit, jiraBelow]);
    const above = state([personalGit, jiraAbove, companyDocs]);
    const [merged] = run([below, above, '.merge']);
    expect(merged?.[0]).toBe('S');
    const targets = merged?.[0] === 'S' ? merged[1].targets : {};
    expect(Object.keys(targets)).toEqual(['company git', 'jira', 'git personal', 'company docs']);
  });

  it('§4.6 .merge is a language operation, bound by defaultEnv', () => {
    expect(defaultEnv().symbols.get('.merge')).toBe(merge);
  });

  it('§4.6 the merged states are not mutated', () => {
    const below = frozen(state([jiraBelow], ['a'], { gh: 'github' }));
    const above = frozen(state([jiraAbove], ['b'], { gh: 'GitHub' }));
    const stack: Stack = [below, above];
    expect(() => merge(testInterp, stack)).not.toThrow();
    expect(below).toEqual(state([jiraBelow], ['a'], { gh: 'github' }));
    expect(above).toEqual(state([jiraAbove], ['b'], { gh: 'GitHub' }));
  });
});

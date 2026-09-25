// dsl.md §4.3 — .@: replace or clear focus

import { describe, expect, it } from 'vitest';
import type { Stack } from '../../types.ts';
import { at } from '../at.ts';
import { set } from '../set.ts';
import { type Case, error, explicitError, runWith, state, testInterp, three } from './harness.ts';

const run = runWith({ '.@': at, '.set': set });

const cases: readonly Case[] = [
  // replace
  [
    '§4.3 stores the matching portion verbatim: no normalization, typed order and case kept',
    [state(three, ['old']), 'GIT', 'Company', 'git', '.@'],
    [state(three, ['GIT', 'Company', 'git'])],
  ],
  [
    '§4.3 does not combine with the old focus',
    [state(three, ['personal']), 'git', '.@'],
    [state(three, ['git'])],
  ],
  [
    '§4.3 focus may carry search operators: !personal .@ stores the NOT term verbatim',
    [state(three, ['company']), '!personal', '.@'],
    [state(three, ['!personal'])],
  ],
  [
    '§4.3 the OR token may enter focus: git | docs .@ stores all three terms',
    [state(three), 'git', '|', 'docs', '.@'],
    [state(three, ['git', '|', 'docs'])],
  ],
  [
    '§4.3 a bare $ is plain text, a valid focus term',
    [state(three), '$', '.@'],
    [state(three, ['$'])],
  ],
  [
    '§4.3 S company . git .@ sets focus to [company], not [company, git]',
    [state(three), 'company', '.', 'git', '.@'],
    [state(three, ['company'])],
  ],
  [
    '§3 .@ does not search for targets: focus may name no target',
    [state(three), 'nonexistent', '.@'],
    [state(three, ['nonexistent'])],
  ],
  [
    '§2/§3 an escaped literal is stored in accumulated form: ..git is kept verbatim, resolved on use',
    [state(three), '..git', '.@'],
    [state(three, ['..git'])],
  ],

  // clear
  ['§4.3 no literal array clears focus', [state(three, ['company']), '.@'], [state(three)]],
  [
    '§4.3 an empty matching portion clears focus',
    [state(three, ['company']), '.', 'git', '.@'],
    [state(three)],
  ],

  // missing_operand
  [
    '§6 with no state anywhere on the stack the literal array is consumed and E is pushed',
    ['git', '.@'],
    [error('missing_operand')],
  ],
  ['§6 an empty stack is missing_operand', ['.@'], [error('missing_operand')]],

  // state preservation
  [
    "§6 operates on the nearest state: [S0, L0, S1, L1] .@ -> [S0, L0, S1']",
    [state([]), 'stray', state(three), 'git', '.@'],
    [state([]), ['L', ['stray']], state(three, ['git'])],
  ],
  [
    '§6 earlier operations are not rolled back: the error stack retains the cleared focus',
    [state(three, ['personal']), 'company', '.@', '.@', 'example.com/{}', 'git', '.set'],
    [state(three), error('invalid_destination')],
  ],
  [
    '§1 on a sealed stack .@ produces nothing that survives',
    [state(three), 'git', explicitError, 'company', '.@'],
    [state(three), ['L', ['git']], explicitError],
  ],
];

describe('.@ (dsl.md §4.3)', () => {
  it.each(cases)('%s', (_name, program, stack) => {
    expect(run(program)).toEqual(stack);
  });
});

// The evaluator never leaves anything but a state (or nothing) beneath a literal
// array, so this contract is only observable by calling the operation directly.
describe('.@ — operand contract', () => {
  it('§6 consumes only its literal array: a non-state value beneath it is left in place', () => {
    const stack: Stack = [
      ['L', ['stray']],
      ['L', ['git']],
    ];
    expect(at(testInterp, stack)).toEqual([['L', ['stray']], error('missing_operand')]);
  });
});

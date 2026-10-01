// dsl.md §4.5 — .alias: store an alias in the state

import { describe, expect, it } from 'vitest';
import { defaultEnv } from '../../env.ts';
import type { Stack } from '../../types.ts';
import { alias } from '../alias.ts';
import { type Case, error, explicitError, runWith, state, testInterp, three } from './harness.ts';

const run = runWith({ '.alias': alias });

const cases: readonly Case[] = [
  // store
  [
    '§4.5 [S, L(a, b)] maps a to b',
    [state(three), 'gh', 'github', '.alias'],
    [state(three, [], { gh: 'github' })],
  ],
  [
    '§4.5 the short form is lowercased; the literal keeps its spelling and case',
    [state(three), 'GH', 'GitHub', '.alias'],
    [state(three, [], { gh: 'GitHub' })],
  ],
  [
    '§4.5 an existing short form is overwritten',
    [state(three, [], { gh: 'old', doc: 'docs' }), 'gh', 'github', '.alias'],
    [state(three, [], { gh: 'github', doc: 'docs' })],
  ],
  [
    '§4.5 targets, focus, and the other aliases are left as they were',
    [state(three, ['company'], { doc: 'docs' }), 'gh', 'github', '.alias'],
    [state(three, ['company'], { doc: 'docs', gh: 'github' })],
  ],
  [
    '§4.5 the literal may be any literal: a URL',
    [state(three), 'ex', 'https://example.com/{}', '.alias'],
    [state(three, [], { ex: 'https://example.com/{}' })],
  ],
  [
    '§4.5 the pair is taken as is: search operators are kept in either position',
    [state(three), '!p', '!personal', '.alias'],
    [state(three, [], { '!p': '!personal' })],
  ],
  [
    '§2/§4.5 escaped literals are stored in accumulated form, like focus',
    [state(three), '..gh', '..set', '.alias'],
    [state(three, [], { '..gh': '..set' })],
  ],

  // the rest of L
  [
    '§4.5 only the last two literals are consumed; the rest stays as L above the new state',
    [state(three), 'company', 'git', 'gh', 'github', '.alias'],
    [state(three, [], { gh: 'github' }), ['L', ['company', 'git']]],
  ],

  // missing_operand
  [
    '§4.5 a lone literal is consumed, then .alias fails, keeping the state',
    [state(three), 'gh', '.alias'],
    [state(three), error('missing_operand')],
  ],
  [
    '§4.5 a separator anywhere in L fails before anything is consumed',
    [state(three), 'gh', 'github', '.', 'x', '.alias'],
    [state(three), ['L', ['gh', 'github', '.', 'x']], error('missing_operand')],
  ],
  [
    '§4.5 a leading separator fails the same way',
    [state(three), '.', 'gh', 'github', '.alias'],
    [state(three), ['L', ['.', 'gh', 'github']], error('missing_operand')],
  ],
  [
    '§6 [S] .alias has no literal array',
    [state(three), '.alias'],
    [state(three), error('missing_operand')],
  ],
  [
    '§6 with no state anywhere on the stack the literal array is consumed and E is pushed',
    ['gh', 'github', '.alias'],
    [error('missing_operand')],
  ],
  ['§6 an empty stack is missing_operand', ['.alias'], [error('missing_operand')]],

  // state preservation
  [
    "§6 operates on the nearest state: [S0, L0, S1, L1] .alias -> [S0, L0, S1']",
    [state([]), 'stray', state(three), 'gh', 'github', '.alias'],
    [state([]), ['L', ['stray']], state(three, [], { gh: 'github' })],
  ],
  [
    '§1 on a sealed stack .alias produces nothing that survives',
    [state(three), 'git', explicitError, 'gh', 'github', '.alias'],
    [state(three), ['L', ['git']], explicitError],
  ],
];

describe('.alias (dsl.md §4.5)', () => {
  it.each(cases)('%s', (_name, program, stack) => {
    expect(run(program)).toEqual(stack);
  });

  it('§4.5 .alias is a language operation, bound by defaultEnv', () => {
    expect(defaultEnv().symbols.get('.alias')).toBe(alias);
  });
});

// The evaluator never leaves anything but a state (or nothing) beneath a literal
// array, so this contract is only observable by calling the operation directly.
describe('.alias — operand contract', () => {
  it('§6 consumes only its literal array: a non-state value beneath it is left in place', () => {
    const stack: Stack = [
      ['L', ['stray']],
      ['L', ['gh', 'github']],
    ];
    expect(alias(testInterp, stack)).toEqual([['L', ['stray']], error('missing_operand')]);
  });
});

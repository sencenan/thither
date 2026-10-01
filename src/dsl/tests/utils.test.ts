// dsl.md §6 — operations take their operands off the top of the stack: what fits is consumed, the
// first value that does not is put back, and the caller decides whether to push the error.

import { describe, expect, expectTypeOf, it } from 'vitest';
import type { LiteralArray, Result, Stack, State, ThitherError } from '../types.ts';
import { emptyState, resolveAliases, resolveEscape, takeOperands } from '../utils.ts';

type Sigil = Stack[number][0];

const s0: State = emptyState();
const s1: State = ['S', { targets: { git: ['https://github.com/'] }, focus: [], alias: {} }];
const l: LiteralArray = ['L', ['git']];
const r: Result = ['R', { matches: [], inputs: [], args: [] }];
const e: ThitherError = ['E', { type: 'unknown_error', description: 'x' }];
const unmatched = ['unmatched', ['E', expect.objectContaining({ type: 'missing_operand' })]];

describe('takeOperands', () => {
  it.each<[string, Stack, readonly Sigil[], unknown, Stack]>([
    ['§6 [.., S, L] takes both, bottom first', [s0, l], ['S', 'L'], ['matched', [s0, l]], []],
    [
      '§6 only the top values are taken; the rest stays',
      [s0, s1, l],
      ['S', 'L'],
      ['matched', [s1, l]],
      [s0],
    ],
    ['§6 [.., S] takes the S alone', [s0], ['S'], ['matched', [s0]], []],
    ['§6 an empty stack takes nothing', [], ['S', 'L'], unmatched, []],
    ['§6 a top that does not fit is put back', [s0], ['S', 'L'], unmatched, [s0]],
    ['§6 [L] takes the L, then finds no S: [L] -> [E]', [l], ['S', 'L'], unmatched, []],
    [
      '§6 a consumed L stays consumed when the S beneath is missing',
      [l, l],
      ['S', 'L'],
      unmatched,
      [l],
    ],
    ['§1 a sealing R on top is put back', [s0, r], ['S', 'L'], unmatched, [s0, r]],
    ['§1 a sealing E on top is put back', [s0, e], ['S'], unmatched, [s0, e]],
    ['§1 an R under the L is put back', [r, l], ['S', 'L'], unmatched, [r]],
    [
      'a pattern may expect an E: the E is matched, not mistaken for a failure',
      [e],
      ['E'],
      ['matched', [e]],
      [],
    ],
    ['a pattern may expect an E beneath its top', [s0, e], ['S', 'E'], ['matched', [s0, e]], []],
  ])('%s', (_name, before, pattern, taken, after) => {
    const stack = [...before];
    expect(takeOperands(stack, pattern)).toEqual(taken);
    expect(stack).toEqual(after);
  });

  it('the error names the expected pattern', () => {
    expect(takeOperands([], ['S', 'L'])).toEqual([
      'unmatched',
      ['E', { type: 'missing_operand', description: 'expected [.., S, L]' }],
    ]);
  });

  it('narrows on the tag and types each operand by its sigil', () => {
    const [matched, operands] = takeOperands([s0, e], ['S', 'E']);
    if (matched === 'unmatched') {
      expectTypeOf(operands).toEqualTypeOf<ThitherError>();
      throw new Error('expected operands');
    }
    const [state, error] = operands;
    expectTypeOf(state).toEqualTypeOf<State>();
    expectTypeOf(error).toEqualTypeOf<ThitherError>();
  });
});

describe('resolveAliases', () => {
  const aliased: State = [
    'S',
    { targets: {}, focus: [], alias: { gh: 'github', dot: '..set', re: '~gh' } },
  ];

  it.each<[string, readonly string[], readonly string[]]>([
    ['§2 an alias with a definition becomes the defined literal', ['~gh'], ['github']],
    ['§2 the short form is looked up lowercased', ['~GH'], ['github']],
    ['§2 an alias with no definition stays as typed, case included', ['~Zz'], ['~Zz']],
    ['§2 a bare ~ is not an alias', ['~'], ['~']],
    ['§2 an escaped .~gh is not an alias', ['.~gh'], ['.~gh']],
    ['§2 the literal is not resolved again: its escape is kept', ['~dot'], ['..set']],
    [
      '§2 resolution is one level, even for a defined literal that looks like an alias',
      ['~re'],
      ['~gh'],
    ],
    [
      '§2 only aliases change; order and other literals are kept',
      ['a', '~gh', '.', 'b'],
      ['a', 'github', '.', 'b'],
    ],
    [
      '§2 an inherited Object property is not a definition',
      ['~constructor', '~__proto__'],
      ['~constructor', '~__proto__'],
    ],
  ])('%s', (_name, literals, resolved) => {
    expect(resolveAliases(aliased, literals)).toEqual(resolved);
  });
});

describe('resolveEscape', () => {
  it.each([
    ['§2 ..x is the text .x', '..x', '.x'],
    ['§2 .~x is the text ~x', '.~x', '~x'],
    ['§2 .~ is the text ~', '.~', '~'],
    ['§2 an unescaped literal is unchanged', '~x', '~x'],
  ])('%s', (_name, literal, text) => {
    expect(resolveEscape(literal)).toBe(text);
  });
});

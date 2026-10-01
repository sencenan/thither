// dsl.md §4.3 — .@: replace or clear focus

import type { Dim, OpFn, State } from '../types.ts';
import { push, splitAtSeparator, takeOperands, thitherError } from '../utils.ts';

const unexpectedStackError = thitherError('missing_operand', '.@ expects [.., S, L] or [.., S]');

export const at: OpFn = (_interp, stack) => {
  const [matched, operands] = takeOperands(stack, ['S', 'L']);
  if (matched === 'matched') {
    const [state, ls] = operands;
    // §4.3/§3 — focus is the matching portion exactly as accumulated: no normalization, escapes
    // resolved only on use, and operators are legal because focus is only ever a search prefix.
    const [matching] = splitAtSeparator(ls[1]);
    return push(stack, withFocus(state, [...matching]));
  }

  const [bareMatched, bare] = takeOperands(stack, ['S']);
  if (bareMatched === 'unmatched') {
    return push(stack, unexpectedStackError);
  }
  const [state] = bare;
  return push(stack, withFocus(state, []));
};

const withFocus = (state: State, focus: readonly Dim[]): State => ['S', { ...state[1], focus }];

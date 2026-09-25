// dsl.md §4.3 — .@: replace or clear focus

import type { Dim, OpFn, State } from '../types.ts';
import { push, splitAtSeparator, thitherError } from '../utils.ts';

const unexpectedStackError = thitherError('missing_operand', '.@ expects [.., S, L] or [.., S]');

export const at: OpFn = (_interp, stack) => {
  const ls = stack.pop();

  if (!ls) {
    return push(stack, unexpectedStackError);
  } else if (ls[0] === 'S') {
    return push(stack, withFocus(ls, []));
  } else if (ls[0] !== 'L') {
    push(stack, ls);
    return push(stack, unexpectedStackError);
  }

  const state = stack[stack.length - 1];

  if (state?.[0] !== 'S') {
    return push(stack, unexpectedStackError);
  }

  // §4.3/§3 — focus is the matching portion exactly as accumulated: no normalization, escapes
  // resolved only on use, and operators are legal because focus is only ever a search prefix.
  const [matching] = splitAtSeparator(ls[1]);

  stack.pop();
  return push(stack, withFocus(state, [...matching]));
};

const withFocus = (state: State, focus: readonly Dim[]): State => [
  'S',
  { targets: state[1].targets, focus },
];

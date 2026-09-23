// dsl.md §4.3 — .@: replace or clear focus

import type { Dim, OpFn, State } from '../types';
import { normalizeDimensions, push, resolveEscape, splitAtSeparator, thitherError } from '../utils';

const unexpectedStackError = thitherError('missing_operand', '.@ expects [.., S, L] or [.., S]');

export const at: OpFn = (stack) => {
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

  const [matching] = splitAtSeparator(ls[1]);
  const focus = normalizeDimensions(matching.map(resolveEscape));

  stack.pop();
  return push(stack, withFocus(state, focus));
};

const withFocus = (state: State, focus: readonly Dim[]): State => [
  'S',
  { targets: state[1].targets, focus },
];

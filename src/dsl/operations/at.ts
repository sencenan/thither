// dsl.md §4.3 — .@: replace or clear focus

import type { Dim, OpFn, State } from '../types.ts';
import {
  isOperatorTerm,
  normalizeDimensions,
  push,
  resolveEscape,
  splitAtSeparator,
  thitherError,
} from '../utils.ts';

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

  const [matching] = splitAtSeparator(ls[1]);
  const explicit = matching.map(resolveEscape);

  // §4.3 — focus is a stored dimension list, so fzf operator syntax has no place in it.
  const operator = explicit.find(isOperatorTerm);
  if (operator !== undefined) {
    return push(
      stack,
      thitherError('invalid_dimension', `${operator} is search syntax, not a dimension`),
    );
  }

  const focus = normalizeDimensions(explicit);

  stack.pop();
  return push(stack, withFocus(state, focus));
};

const withFocus = (state: State, focus: readonly Dim[]): State => [
  'S',
  { targets: state[1].targets, focus },
];

// dsl.md §4.2 — .rm: remove matching targets

import { searchTargets } from '../selector';
import type { OpFn, State } from '../types';
import { push, resolveEscape, splitAtSeparator, thitherError } from '../utils';

const unexpectedStackError = thitherError('missing_operand', '.rm expects [.., S, L] or [.., S]');

export const rm: OpFn = (stack) => {
  const ls = stack.pop();

  if (!ls) {
    return push(stack, unexpectedStackError);
  } else if (ls[0] === 'S') {
    return push(stack, ls);
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
  if (explicit.length === 0) {
    return stack;
  }

  const { targets, focus } = state[1];
  // §3 — the query is fzf's: typed order, operators live (`!git .rm` removes the non-git targets).
  const query = [...focus, ...explicit];
  const matched = searchTargets(targets, query).map((selection) => selection.target);

  const nextState: State = [
    'S',
    {
      targets: targets.filter((target) => !matched.includes(target)),
      focus,
    },
  ];

  stack.pop();
  return push(stack, nextState);
};

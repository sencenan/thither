// dsl.md §4.1 — .set: insert or update a target

import { searchTargets } from '../selector.ts';
import type { OpFn, State } from '../types.ts';
import {
  isOperatorTerm,
  isTemplate,
  normalizeDimensions,
  push,
  resolveEscape,
  splitAtSeparator,
  thitherError,
} from '../utils.ts';

const unexpectedStackError = thitherError('missing_operand', '.set expects [.., S, L]');

export const set: OpFn = (stack) => {
  const ls = stack.pop();

  if (!ls) {
    return push(stack, unexpectedStackError);
  } else if (ls[0] !== 'L') {
    push(stack, ls);
    return push(stack, unexpectedStackError);
  }

  const state = stack[stack.length - 1];

  if (state?.[0] !== 'S') {
    return push(stack, unexpectedStackError);
  }

  const dest = ls[1].pop();
  const dims = ls[1];
  if (!dest || !isTemplate(dest)) {
    return push(stack, thitherError('invalid_destination', `${dest} is not a valid URL`));
  }

  const [matching] = splitAtSeparator(dims);
  const explicit = matching.map(resolveEscape);
  if (explicit.length === 0) {
    return push(stack, thitherError('missing_operand', 'no explicit dimension'));
  }

  // §4.1 — what .set matches on is what it stores, so fzf operator syntax cannot be a dimension.
  const operator = explicit.find(isOperatorTerm);
  if (operator !== undefined) {
    return push(
      stack,
      thitherError('invalid_dimension', `${operator} is search syntax, not a dimension`),
    );
  }

  // .set matches on the *normalized* combined dimensions, exactly the set it would store: under
  // fzf's smart-case a raw `Git` would be case-sensitive, miss the stored `git`, and insert a
  // duplicate dimension set. Lowercase-on-lowercase always finds an identical existing target.
  const { targets, focus } = state[1];
  const query = normalizeDimensions([...focus, ...explicit]);
  const matched = searchTargets(targets, query).map((selection) => selection.target);

  if (matched.length > 1) {
    return push(
      stack,
      thitherError('ambiguous_set', `${query.join(' ')} matches more than one target`),
    );
  }

  const nextState: State = [
    'S',
    {
      targets:
        matched.length === 0
          ? [...targets, [query, dest]]
          : targets.map((target) => (target === matched[0] ? [target[0], dest] : target)),
      focus,
    },
  ];

  stack.pop();
  return push(stack, nextState);
};

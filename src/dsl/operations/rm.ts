// dsl.md §4.2 — .rm: remove a target by exact key, or one of its variants by arity

import { type OpFn, SEP, type State, type Template } from '../types.ts';
import {
  arityOf,
  isOperatorTerm,
  keyOf,
  push,
  resolveEscape,
  splitAtSeparator,
  thitherError,
} from '../utils.ts';

const unexpectedStackError = thitherError('missing_operand', '.rm expects [.., S, L] or [.., S]');

export const rm: OpFn = (_interp, stack) => {
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

  const [matching, suffix] = splitAtSeparator(ls[1]);
  const explicit = matching.map(resolveEscape);
  // §4.2 — an empty matching portion never authorizes removal, regardless of focus.
  if (explicit.length === 0) {
    return stack;
  }

  // §4.2 — like .set, .rm names a key, so operator syntax is refused rather than searched.
  const operator = explicit.find(isOperatorTerm);
  if (operator !== undefined) {
    return push(
      stack,
      thitherError('invalid_dimension', `${operator} is search syntax, not a dimension`),
    );
  }

  // §4.2 — exact key lookup, no search, no focus. A missing key is a successful no-op.
  const { targets, focus } = state[1];
  const key = keyOf(explicit);
  const variants = targets[key];
  if (variants === undefined) {
    return stack;
  }

  const hasSeparator = ls[1].includes(SEP);

  // §4.2 — no separator removes the whole target, but only when it is unambiguous: a target with
  // more than one variant must be disambiguated by naming the arity with the `. x x x` suffix.
  if (!hasSeparator && variants.length > 1) {
    return push(
      stack,
      thitherError(
        'missing_operand',
        `${key} has ${variants.length} variants; name the arity to remove with a separator`,
      ),
    );
  }

  const nextTargets: Record<string, readonly Template[]> = {};
  for (const [otherKey, otherVariants] of Object.entries(targets)) {
    if (otherKey !== key) {
      nextTargets[otherKey] = otherVariants;
      continue;
    }
    if (!hasSeparator) {
      // Unambiguous whole-target removal: drop the single-variant target entirely.
      continue;
    }
    // §4.2 — the suffix length is the arity to remove; a target left with no variant is dropped.
    const remaining = otherVariants.filter((variant) => arityOf(variant) !== suffix.length);
    if (remaining.length > 0) {
      nextTargets[otherKey] = remaining;
    }
  }

  stack.pop();
  const nextState: State = ['S', { targets: nextTargets, focus }];
  return push(stack, nextState);
};

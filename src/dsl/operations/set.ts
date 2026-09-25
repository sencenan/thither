// dsl.md §4.1 — .set: insert or update a target by exact key

import type { OpFn, State, Template } from '../types.ts';
import {
  arityOf,
  isOperatorTerm,
  isTemplate,
  keyOf,
  push,
  resolveEscape,
  splitAtSeparator,
  thitherError,
} from '../utils.ts';

const unexpectedStackError = thitherError('missing_operand', '.set expects [.., S, L]');

export const set: OpFn = (_interp, stack) => {
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

  const dest = ls[1].shift();
  const dims = ls[1];
  if (!dest || !isTemplate(dest)) {
    return push(stack, thitherError('invalid_destination', `${dest} is not a valid URL`));
  }

  const [matching] = splitAtSeparator(dims);
  const explicit = matching.map(resolveEscape);
  if (explicit.length === 0) {
    return push(stack, thitherError('missing_operand', 'no explicit dimension'));
  }

  // §4.1 — what .set stores is a key, and a key is plain text, so operator syntax is refused.
  const operator = explicit.find(isOperatorTerm);
  if (operator !== undefined) {
    return push(
      stack,
      thitherError('invalid_dimension', `${operator} is search syntax, not a dimension`),
    );
  }

  // §4.1 — exact key lookup, no search, no focus. A missing key inserts; an existing key gains
  // or replaces the variant of the destination's arity, keeping its position and other variants.
  const { targets, focus } = state[1];
  const key = keyOf(explicit);
  const existing = targets[key];
  const variants = existing === undefined ? [dest] : upsertVariant(existing, dest);

  const nextTargets: Record<string, readonly Template[]> = { ...targets, [key]: variants };

  stack.pop();
  const nextState: State = ['S', { targets: nextTargets, focus }];
  return push(stack, nextState);
};

// §4.1 — a variant is addressed by arity: replace the same-arity variant when present, otherwise
// add it, keeping the list in arity-ascending order.
const upsertVariant = (variants: readonly Template[], dest: Template): Template[] => {
  const arity = arityOf(dest);
  return [...variants.filter((variant) => arityOf(variant) !== arity), dest].sort(
    (a, b) => arityOf(a) - arityOf(b),
  );
};

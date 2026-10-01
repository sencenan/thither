// dsl.md §4.1 — .set: insert or update a target by exact key

import type { LiteralArray, OpFn, State, Template, ThitherError } from '../types.ts';
import {
  arityOf,
  isAlias,
  isOperatorTerm,
  isTemplate,
  keyOf,
  push,
  resolveEscape,
  splitAtSeparator,
  takeOperands,
  thitherError,
} from '../utils.ts';

const unexpectedStackError = thitherError('missing_operand', '.set expects [.., S, L]');

export const set: OpFn = (_interp, stack) => {
  const [matched, operands] = takeOperands(stack, ['S', 'L']);
  if (matched === 'unmatched') {
    return push(stack, unexpectedStackError);
  }

  // §6 — a failed .set leaves its input state in place under the error.
  const [state, ls] = operands;
  const next = setTarget(state, ls);
  return next[0] === 'E' ? push(push(stack, state), next) : push(stack, next);
};

const setTarget = (state: State, ls: LiteralArray): State | ThitherError => {
  // §4.1 — .set does not resolve aliases, so any alias in L is refused outright.
  const typedAlias = ls[1].find(isAlias);
  if (typedAlias !== undefined) {
    return thitherError(
      'invalid_dimension',
      `${typedAlias} is an alias; .set does not resolve aliases`,
    );
  }

  const [dest, ...dims] = ls[1];
  if (!dest || !isTemplate(dest)) {
    return thitherError('invalid_destination', `${dest} is not a valid URL`);
  }

  const [matching] = splitAtSeparator(dims);
  const explicit = matching.map(resolveEscape);
  if (explicit.length === 0) {
    return thitherError('missing_operand', 'no explicit dimension');
  }

  // §4.1 — what .set stores is a key, and a key is plain text, so operator syntax is refused.
  const operator = explicit.find(isOperatorTerm);
  if (operator !== undefined) {
    return thitherError('invalid_dimension', `${operator} is search syntax, not a dimension`);
  }

  // §4.1 — exact key lookup, no search, no focus. A missing key inserts; an existing key gains
  // or replaces the variant of the destination's arity, keeping its position and other variants.
  const { targets, focus, alias } = state[1];
  const key = keyOf(explicit);
  const existing = targets[key];
  const variants = existing === undefined ? [dest] : upsertVariant(existing, dest);

  return ['S', { targets: { ...targets, [key]: variants }, focus, alias }];
};

// §4.1 — a variant is addressed by arity: replace the same-arity variant when present, otherwise
// add it, keeping the list in arity-ascending order.
const upsertVariant = (variants: readonly Template[], dest: Template): Template[] => {
  const arity = arityOf(dest);
  return [...variants.filter((variant) => arityOf(variant) !== arity), dest].sort(
    (a, b) => arityOf(a) - arityOf(b),
  );
};

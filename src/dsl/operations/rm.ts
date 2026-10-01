// dsl.md §4.2 — .rm: remove a target by exact key, or one of its variants by arity

import {
  type LiteralArray,
  type OpFn,
  SEP,
  type State,
  type Template,
  type ThitherError,
} from '../types.ts';
import {
  arityOf,
  isOperatorTerm,
  keyOf,
  push,
  resolveEscape,
  splitAtSeparator,
  takeOperands,
  thitherError,
} from '../utils.ts';

const unexpectedStackError = thitherError('missing_operand', '.rm expects [.., S, L] or [.., S]');

export const rm: OpFn = (_interp, stack) => {
  const [matched, operands] = takeOperands(stack, ['S', 'L']);
  if (matched === 'matched') {
    // §6 — a failed .rm leaves its input state in place under the error.
    const [state, ls] = operands;
    const next = removeTarget(state, ls);
    return next[0] === 'E' ? push(push(stack, state), next) : push(stack, next);
  }

  // [.., S] .rm removes nothing.
  const [bareMatched, bare] = takeOperands(stack, ['S']);
  return push(stack, bareMatched === 'matched' ? bare[0] : unexpectedStackError);
};

const removeTarget = (state: State, ls: LiteralArray): State | ThitherError => {
  const [matching, suffix] = splitAtSeparator(ls[1]);
  const explicit = matching.map(resolveEscape);
  // §4.2 — an empty matching portion never authorizes removal, regardless of focus.
  if (explicit.length === 0) {
    return state;
  }

  // §4.2 — like .set, .rm names a key, so operator syntax is refused rather than searched.
  const operator = explicit.find(isOperatorTerm);
  if (operator !== undefined) {
    return thitherError('invalid_dimension', `${operator} is search syntax, not a dimension`);
  }

  // §4.2 — exact key lookup, no search, no focus. A missing key is a successful no-op.
  const { targets, focus, alias } = state[1];
  const key = keyOf(explicit);
  const variants = targets[key];
  if (variants === undefined) {
    return state;
  }

  const hasSeparator = ls[1].includes(SEP);

  // §4.2 — no separator removes the whole target, but only when it is unambiguous: a target with
  // more than one variant must be disambiguated by naming the arity with the `. x x x` suffix.
  if (!hasSeparator && variants.length > 1) {
    return thitherError(
      'missing_operand',
      `${key} has ${variants.length} variants; name the arity to remove with a separator`,
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

  return ['S', { targets: nextTargets, focus, alias }];
};

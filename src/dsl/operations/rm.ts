// dsl.md §4.2 — .rm: remove matching targets, or a single variant by arity

import { searchTargets } from '../selector.ts';
import { type OpFn, SEP, type State, type Template } from '../types.ts';
import { arityOf, push, resolveEscape, splitAtSeparator, thitherError } from '../utils.ts';

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

  const { targets, focus } = state[1];
  // §3 — the query is fzf's: typed order, operators live (`!git .rm` removes the non-git targets).
  const query = [...focus, ...explicit];
  const matchedKeys = new Set(
    searchTargets(targets, query).map((selection) => selection.target[0]),
  );

  // §4.2 — no separator removes whole targets; a separator's suffix *length* is the arity to
  // remove from every matched target, and a target with no variant left is dropped.
  const hasSeparator = ls[1].includes(SEP);
  const arity = suffix.length;

  const nextTargets: Record<string, readonly Template[]> = {};
  for (const [key, variants] of Object.entries(targets)) {
    if (!matchedKeys.has(key)) {
      nextTargets[key] = variants;
      continue;
    }
    if (!hasSeparator) {
      continue;
    }
    const remaining = variants.filter((variant) => arityOf(variant) !== arity);
    if (remaining.length > 0) {
      nextTargets[key] = remaining;
    }
  }

  stack.pop();
  const nextState: State = ['S', { targets: nextTargets, focus }];
  return push(stack, nextState);
};

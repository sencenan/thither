// dsl.md §4.6 — .merge: combine two states into one

import type { OpFn, State, Template } from '../types.ts';
import { push, takeOperands, thitherError, upsertVariant } from '../utils.ts';

const unexpectedStackError = thitherError('missing_operand', '.merge expects [.., S, S]');

export const merge: OpFn = (_interp, stack) => {
  const taken = takeOperands(stack, ['S', 'S']);
  if (taken[0] === 'unmatched') {
    // §6 — a state taken off the stack goes back beneath the error; nothing else does.
    for (const value of taken[2]) {
      if (value[0] === 'S') {
        push(stack, value);
      }
    }
    return push(stack, unexpectedStackError);
  }

  const [below, above] = taken[1];
  return push(stack, mergeStates(below, above));
};

// §4.6 — the lower state's targets keep their order and the top state's new keys follow; a key in
// both gains the top state's variants as .set would. Alias definitions unite, the top state
// winning a short form both define, and focus is the top state's.
const mergeStates = (below: State, above: State): State => {
  const targets: Record<string, readonly Template[]> = { ...below[1].targets };
  for (const [key, variants] of Object.entries(above[1].targets)) {
    const existing = targets[key];
    targets[key] = existing === undefined ? variants : variants.reduce(upsertVariant, existing);
  }

  return [
    'S',
    {
      targets,
      focus: above[1].focus,
      alias: { ...below[1].alias, ...above[1].alias },
    },
  ];
};

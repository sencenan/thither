// dsl.md §4.5 — .alias: store an alias in the state

import { type OpFn, SEP } from '../types.ts';
import { push, takeOperands, thitherError } from '../utils.ts';

const unexpectedStackError = thitherError('missing_operand', '.alias expects [.., S, L]');

export const alias: OpFn = (_interp, stack) => {
  const [matched, operands] = takeOperands(stack, ['S', 'L']);
  if (matched === 'unmatched') {
    return push(stack, unexpectedStackError);
  }

  // §6 — on every failure the input state stays in place under the error.
  const [state, ls] = operands;

  // §4.5 — a separator fails before anything is consumed, so the literal array goes back too.
  if (ls[1].includes(SEP)) {
    push(push(stack, state), ls);
    return push(stack, thitherError('missing_operand', '.alias takes no argument separator'));
  }

  // §4.5 — the last two literals are the pair; a lone literal is consumed and still fails.
  const rest = ls[1].slice(0, -2);
  const [short, literal] = ls[1].slice(-2);
  if (short === undefined || literal === undefined) {
    push(stack, state);
    return push(stack, thitherError('missing_operand', '.alias needs a short form and a literal'));
  }

  // §4.5 — the short form is lowercased, otherwise both are kept exactly as accumulated.
  const aliases = { ...state[1].alias, [short.toLowerCase()]: literal };
  push(stack, ['S', { ...state[1], alias: aliases }]);
  return rest.length > 0 ? push(stack, ['L', rest]) : stack;
};

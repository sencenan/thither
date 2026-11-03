// dsl.md §4.8 — .done: remove a todo item

import type { OpFn } from '../types.ts';
import { push, takeOperands, thitherError, todoItemOf, todoListOf, withTodo } from '../utils.ts';

const missingOperand = thitherError('missing_operand', '.done expects [.., S, L]');

// [K, S, L] -> [K, S', D]. Without L the state is never taken, so it stays beneath the error.
export const done: OpFn = (_interp, stack) => {
  const [matched, operands] = takeOperands(stack, ['S', 'L']);
  if (matched === 'unmatched') {
    return push(stack, missingOperand);
  }

  const [state, ls] = operands;
  const item = todoItemOf('.done', ls);
  if (typeof item !== 'string') {
    return push(push(stack, state), item);
  }
  const next = withTodo(
    state,
    state[1].todo.filter((held) => held !== item),
  );
  return push(push(stack, next), todoListOf(next));
};

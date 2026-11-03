// dsl.md §4.7 — .todo: add a todo item, or show the todo list

import type { OpFn } from '../types.ts';
import { push, takeOperands, thitherError, todoItemOf, todoListOf, withTodo } from '../utils.ts';

const missingOperand = thitherError('missing_operand', '.todo expects [.., S, L] or [.., S]');

// The state stays under the todo list: [K, S, L] -> [K, S', D] and [K, S] -> [K, S, D].
export const todo: OpFn = (_interp, stack) => {
  const [matched, operands] = takeOperands(stack, ['S', 'L']);
  if (matched === 'matched') {
    const [state, ls] = operands;
    const item = todoItemOf('.todo', ls);
    if (typeof item !== 'string') {
      return push(push(stack, state), item);
    }
    const items = state[1].todo;
    const next = items.includes(item) ? state : withTodo(state, [...items, item]);
    return push(push(stack, next), todoListOf(next));
  }

  const [bareMatched, bare] = takeOperands(stack, ['S']);
  if (bareMatched === 'unmatched') {
    return push(stack, missingOperand);
  }
  const [state] = bare;
  return push(push(stack, state), todoListOf(state));
};

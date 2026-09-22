import { invariant } from '../lib/invariant.ts';
import type { Interpreter, InterpreterEnv, Op, OpFn, Stack, State } from './types.ts';

export type {
  Interpreter,
  InterpreterEnv,
  Program,
  Stack,
} from './types.ts';

const unimplemented =
  (op: Op): OpFn =>
  (_stack) => {
    invariant(false, `operation ${op} is not implemented yet`);
  };

/** An environment preloaded with dsl.md's four operations and the seed stack. */
export function defaultEnv(): InterpreterEnv {
  const seed: State = ['S', { targets: [], focus: [] }];
  const initialStack: Stack = [seed];
  return {
    symbols: new Map<string, OpFn>([
      ['.set', unimplemented('.set')],
      ['.rm', unimplemented('.rm')],
      ['.@', unimplemented('.@')],
      ['.$', unimplemented('.$')],
    ]),
    initialStack,
  };
}

/** Bind an environment, producing an interpreter that speaks its symbol set. */
export function createInterpreter(_env: InterpreterEnv): Interpreter {
  invariant(false, 'createInterpreter is not implemented yet (ticket 09)');
}

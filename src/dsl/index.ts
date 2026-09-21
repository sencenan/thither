// browser-client.md "Core interface" — the core's entire public surface.
//
// Adding an export here is a specification change: browser-client.md names this
// surface. Behaviour is implemented from ticket 09 onward; the placeholders
// below are deliberately inert so no caller depends on an unimplemented shape.

import { invariant } from "../lib/invariant.ts";
import type {
  BuiltinOperation,
  Interpreter,
  InterpreterEnv,
  OperationFn,
  Stack,
  State,
} from "./types.ts";

export type {
  Interpreter,
  InterpreterEnv,
  Operation,
  OperationFn,
  Program,
  Stack,
} from "./types.ts";

const unimplemented =
  (op: BuiltinOperation): OperationFn =>
  (_stack) => {
    invariant(false, `operation ${op} is not implemented yet`);
  };

/** An environment preloaded with dsl.md's four operations and the seed stack. */
export function defaultEnv(): InterpreterEnv {
  const seed: State = ["S", { targets: [], focus: [] }];
  const initialStack: Stack = [seed];
  return {
    symbols: new Map<string, OperationFn>([
      [".set", unimplemented(".set")],
      [".rm", unimplemented(".rm")],
      [".@", unimplemented(".@")],
      [".$", unimplemented(".$")],
    ]),
    initialStack,
  };
}

/** Bind an environment, producing an interpreter that speaks its symbol set. */
export function createInterpreter(_env: InterpreterEnv): Interpreter {
  invariant(false, "createInterpreter is not implemented yet (ticket 09)");
}

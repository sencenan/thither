// browser-client.md "Host operations" — the browser interpreter environment: `defaultEnv()`'s
// four language operations plus the three host operations (`.load`, `.out`, `.save`) that are
// the whole of the client's persistence (ADR 0005, ADR 0007). Mirrors the core's `defaultEnv`;
// the caller builds an interpreter from it and reads the env's output register fields
// (`terminal`/`loaded`/`state`) after each run. It also carries the program input the run was opened
// with, since the URL it came from is stripped once the fallback page is shown. The stored
// records themselves live in `persistence.ts`.

import type {
  InterpreterEnv,
  OpFn,
  Program,
  Result,
  Stack,
  State,
  ThitherError,
} from '../dsl/index.ts';
import { defaultEnv } from '../dsl/index.ts';
import { readHistory, type StorageArea, writeCurrentStack } from './persistence.ts';

// The client-held slot the host operations write and the client reads after execution.
// Cleared at the start of each run by `.load`.
export interface OutputRegister {
  terminal?: Result | ThitherError | undefined;
  loaded: boolean;
  // The world as the run left it: the `S` on top after `.out`, so a mutation the user's tokens
  // made is already in it. Absent when nothing is left, as after a failed `.load`.
  state?: State | undefined;
}

// An interpreter environment (ADR 0005) that is *also* the client's output register: the fields
// of OutputRegister are splatted onto the env, so the browser world is one value. Build an
// interpreter from it, then read `terminal`/`loaded`/`state` off the same object after each run.
// `input` is the initial program input, read from the URL before the client strips it.
export interface BrowserEnv extends InterpreterEnv, OutputRegister {
  readonly input: readonly string[];
}

const parseError = (description: string): ThitherError => [
  'E',
  { type: 'parse_error', description },
];

// A stored value is always an array from JSON; parse resolves it to S/R/E (or a parse_error E).
const isStackValue = (token: Program[number] | undefined): token is State | Result | ThitherError =>
  token !== undefined && (token[0] === 'S' || token[0] === 'R' || token[0] === 'E');

export const createBrowserEnv = (
  storage: StorageArea,
  input: readonly string[] = [],
): BrowserEnv => {
  // The env is also the output register (its fields are splatted in), so the host operations
  // mutate it directly and the client reads terminal/loaded/state off the same object.
  const { symbols } = defaultEnv();
  const env: BrowserEnv = { symbols, input, loaded: true };

  // browser-client.md "Host operations" — open a run: clear the register and push the stored
  // current stack. A malformed record or a value that fails validation seals the stack with the
  // `parse_error` and flags the run. The interpreter is handed in by the evaluator (ADR 0005),
  // so validation reuses pushToken.
  const load: OpFn = (interp, stack) => {
    env.terminal = undefined;
    env.loaded = true;
    env.state = undefined;

    const current = readHistory(storage)?.at(-1);
    if (current === undefined) {
      env.loaded = false;
      stack.push(parseError('the stored stack record is unreadable'));
      return stack;
    }

    // Validate every value through the interpreter; parse normalizes as it validates, so the
    // pushed values are canonical. Any value that parses to an E fails the whole load.
    const validated: Stack = [];
    for (const value of current) {
      const token = interp.pushToken([], value)[0];
      if (!isStackValue(token) || token[0] === 'E') {
        env.loaded = false;
        stack.push(isStackValue(token) ? token : parseError('malformed stored value'));
        return stack;
      }
      validated.push(token);
    }

    for (const value of validated) {
      stack.push(value);
    }
    return stack;
  };

  // browser-client.md "Host operations" — pop the run's terminal (R or E) into the register,
  // then record the S left on top. Not a general pop: any other top value is left in place.
  const out: OpFn = (_interp, stack) => {
    const top = stack[stack.length - 1];
    if (top !== undefined && (top[0] === 'R' || top[0] === 'E')) {
      stack.pop();
      env.terminal = top;
    }
    const remaining = stack[stack.length - 1];
    if (remaining !== undefined && remaining[0] === 'S') {
      env.state = remaining;
    }
    return stack;
  };

  // browser-client.md "Host operations" — persist the stack as it stands, but only for a run that
  // reached its search: the `R` in the register proves `.$` consumed the literals, so what is
  // stored is always a stack `.load` can read. A run that ended in an `E`, or has not searched
  // yet, persists nothing. The record is re-read by the write rather than carried from `.load`:
  // the run is synchronous, so nothing intervenes, and `persistence.ts`'s settings actions write
  // without any `.load` at all. A failed write leaves its `E` on the stack; it becomes the run's
  // terminal in place of the `R`, so the client never treats the execution as persisted.
  const save: OpFn = (_interp, stack) => {
    if (env.terminal?.[0] === 'R') {
      writeCurrentStack(storage, stack);
      const top = stack[stack.length - 1];
      if (top !== undefined && top[0] === 'E') {
        env.terminal = top;
      }
    }
    return stack;
  };

  symbols.set('.load', load);
  symbols.set('.out', out);
  symbols.set('.save', save);

  return env;
};

// primitive values

export type Dim = string;
export type Template = string;

export const SEP = '.' as const;
export const SEP_ESCAPE = '..';
export type Separator = typeof SEP;

export type Op = string;

// composite values

export type Literal = Dim | Separator;

// dsl.md §1 — a target is its key paired with its variants: destination templates of pairwise
// distinct arity, kept in arity-ascending order. A `TargetSet` is keyed by that key, so
// equivalent dimension sets collapse to one entry, and iteration order is target-set order.
export type Target = readonly [key: string, variants: readonly Template[]];
export type TargetSet = { readonly [key: string]: readonly Template[] };

export interface Hint {
  readonly argDelta: number;
  readonly positions: readonly number[];
  readonly score: number;
}

export type Match = readonly [destination: Template, key: string, args: readonly Dim[], hint: Hint];

export const ErrorTypes = [
  'parse_error',
  'invalid_destination',
  'invalid_dimension',
  'missing_operand',
  'missing_operation',
  'unknown_error',
] as const;
export type ErrorType = (typeof ErrorTypes)[number];

// top level parsed types

export type LiteralArray = ['L', Literal[]];
export type State = readonly ['S', { readonly targets: TargetSet; readonly focus: readonly Dim[] }];

export type Result = readonly [
  'R',
  {
    readonly matches: Match[];
    readonly inputs: readonly Dim[];
  },
];
export type ThitherError = readonly [
  'E',
  {
    readonly type: ErrorType;
    readonly description: string;
    readonly [field: string]: unknown;
  },
];

export type LiteralToken = ['l', Literal];
export type OpToken = ['o', Op];

// program types, what can be part of a program

export type Token = State | Result | ThitherError | LiteralToken | OpToken;
export type Program = Token[];

// stack types, what can be in the data stack

export type StackValue = State | Result | ThitherError | LiteralArray;
export type Stack = StackValue[];

// evaluation types

// The evaluator hands an operation the interpreter it is bound to (first argument), so a host
// operation can reuse the core's own parsing/evaluation (e.g. `.load` validating persisted
// values through pushToken) without the circular wiring of being handed the interpreter before
// it exists (ADR 0005). Core operations ignore it.
export type OpFn = (interp: Interpreter, stack: Stack) => Stack;

export interface InterpreterEnv {
  readonly symbols: Map<Op, OpFn>;
}

export interface Interpreter {
  pushToken(program: Program, token: unknown): Program;
  execute(program: Program, stack?: Stack): Stack;
}

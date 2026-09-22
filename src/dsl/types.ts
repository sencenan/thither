// primitive values

export type Dim = string;
export type Template = string;
export type Op = string;
export type Separator = '.';

// composite values

export type Literal = Dim | Separator;
export type Target = readonly [dims: readonly Dim[], destination: Template];

export interface Hint {
  readonly argDelta: number;
  readonly positions: readonly number[];
  readonly score: number;
}

export type Match = readonly [
  destination: Template,
  dims: readonly Dim[],
  args: readonly Dim[],
  hint: Hint,
];

export const ErrorTypes = [
  'parse_error',
  'invalid_destination',
  'missing_operand',
  'missing_operation',
  'ambiguous_set',
  'unknown_error',
] as const;
export type ErrorType = (typeof ErrorTypes)[number];

// top level parsed types

export type LiteralArray = ['L', Literal[]];
export type State = readonly ['S', { readonly targets: Target[]; readonly focus: readonly Dim[] }];

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

export type OpFn = (stack: Stack) => Stack;

export interface InterpreterEnv {
  readonly symbols: Map<Op, OpFn>;
}

export interface Interpreter {
  pushToken(program: Program, token: unknown): Program;
  execute(program: Program): Stack;
}

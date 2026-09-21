// dsl.md §1 — the core value model. The whole type algebra of the language
// lives here; read this file to learn the vocabulary. Types only: the functions
// that mint branded values (validation, normalization) live in tickets 06–07.

// Brands are nominal tags carried at the type level only; a branded string is a
// plain string at runtime. The `declare const` symbols are unforgeable keys, so
// the only way to obtain a branded value is through its validation seam.
declare const DimBrand: unique symbol;
declare const NormDimBrand: unique symbol;
declare const TemplateBrand: unique symbol;
declare const UrlBrand: unique symbol;

// Normalization is a property of position, not of a value in flight: `Dim` is
// what sits on the stack (spelling preserved), `NormDim` is what sits inside
// `S`. Branding both makes the stack→state crossing impossible without the
// normalization seam.
export type Dim = string & { readonly [DimBrand]: true };
export type NormDim = string & { readonly [NormDimBrand]: true };

// A `Url` is a `Template` with no placeholders, so it is a subtype: usable
// wherever a `Template` is wanted, never the reverse (dsl.md §1).
export type Template = string & { readonly [TemplateBrand]: true };
export type Url = Template & { readonly [UrlBrand]: true };

export type Literal = Dim | Template;
export type LiteralArray = readonly Literal[];

// dsl.md §1: an error's payload may carry diagnostic fields beyond the required
// two. Intersecting with this allows them, typed `unknown`, so nothing acts on
// them by accident.
type Extra = { readonly [field: string]: unknown };

// A target `t` = [[d], p]; its dimensions are state-side, hence normalized.
export type Target = readonly [dims: readonly NormDim[], destination: Template];
export type TargetSet = readonly Target[];

// State `S` = ["S", { targets, focus }]. The in-memory shape is the wire/JSON
// shape (ADR-0003: the client treats these values as opaque JSON), so there is no
// serialization seam. `Target`/`TargetSet` appear only here, never in the
// program- or stack-value union, which is how dsl.md §1's "t and T cannot appear
// as standalone values" holds in the type system.
export type State = readonly [
  "S",
  { readonly targets: TargetSet; readonly focus: readonly NormDim[] },
];

// Match evidence (dsl.md §5): argument balance and the fuzzy-match spans, so a
// presentation layer can rank and highlight without re-running the matcher.
export interface Hint {
  readonly argDelta: number;
  readonly positions: readonly number[];
  readonly score: number;
}

// A match `m` = [u_or_p, [d], [args], hint]. The destination may still hold `{}`
// when arguments are missing, so it is a `Template`, not necessarily a `Url`.
// `dims` are the selected target's (normalized); `args` are the applied
// arguments in original spelling.
export type Match = readonly [
  destination: Template,
  dims: readonly NormDim[],
  args: LiteralArray,
  hint: Hint,
];
export type MatchSet = readonly Match[];

// Result `R` = ["R", { matches, inputs }]. `inputs` are the user's matching
// literals in original spelling (raw), excluding focus, separator, and args.
export type Result = readonly [
  "R",
  { readonly matches: MatchSet; readonly inputs: readonly Dim[] },
];

// The closed vocabulary of generated-error types (dsl.md §6), discriminated by
// phase: every failure raised while *parsing* one item is `parse_error` whatever
// its cause, and the rest name failures raised while *evaluating* an operation.
// Adding one is a specification change. `ThitherError.type` below stays `string`,
// not this union, because a supplied `E` may carry any type the core displays
// without interpreting; only errors the core *generates* draw from this set.
export type ErrorType = "parse_error" | "invalid_destination" | "missing_operand" | "ambiguous_set";

// Error `E` = ["E", { type, description, ...diagnostics }]. Named `ThitherError`
// to stay clear of the platform `Error`; the core answers with these values
// rather than throwing (see docs/code-standards.md "Failure").
export type ThitherError = readonly [
  "E",
  { readonly type: string; readonly description: string } & Extra,
];

// An operation's name: the key a program item and the environment share. Open by
// design: the built-in operations are dsl.md's four, a client may register more
// (ADR-0005). ("Sigil" is reserved for a program item's position-0 tag, e.g.
// "op"; an Operation is what the "op" tag carries.)
export type Operation = string;

// The operations the default environment binds; the closed default subset of Operation.
export type BuiltinOperation = ".set" | ".rm" | ".@" | ".$";

// Every program item is a ["sigil", body] tuple, the shape the wire S/R/E values
// already take, so they flatten straight into the union. A literal is
// tagged rather than left bare because escaping collides its text with an
// operation's: `..set` parses to the literal `.set`, whose string equals the
// operation `.set`, so the sigil must be carried, not read from the text. The
// operation's name rides in position 1 so position 0 stays a closed set of
// sigils even though the operation set is open.
export type ProgramItem =
  | State
  | Result
  | ThitherError
  | readonly ["lit", Literal]
  | readonly ["."]
  | readonly ["op", Operation];

export type Program = readonly ProgramItem[];

// The working data stack is mutable evaluator scratch: an OperationFn edits it in
// place and returns it for convenience. The values it holds stay readonly, so the
// snapshots a client persists cannot be mutated (docs/code-standards.md "Types").
// A single literal is never bare on it; it starts a one-element literal array
// (dsl.md "[K], top is not L | x -> [K, [x]]"), so an element is an S/R/E value or L.
export type StackValue = State | Result | ThitherError | LiteralArray;
export type Stack = StackValue[];

// An operation's behaviour: take the whole stack, mutate it (unwinding included),
// return it.
export type OperationFn = (stack: Stack) => Stack;

// The interpreter's environment: the dispatch map from sigil to behaviour, plus
// the seed stack a client persists before its first execution. `initialStack`
// holds one empty state rather than an empty stack, because `.set` needs a state
// on the stack to append the first target to. Start from defaultEnv() and
// register further symbols on `symbols` (ADR-0005).
export interface InterpreterEnv {
  readonly symbols: Map<Operation, OperationFn>;
  readonly initialStack: Stack;
}

// An env-bound interpreter. `append` validates each item against the
// environment, so an unknown dot-token becomes `E` at parse; `execute` evaluates
// against a fresh empty working stack it creates itself.
export interface Interpreter {
  readonly emptyProgram: Program;
  readonly initialStack: Stack;
  append(program: Program, item: unknown): Program;
  execute(program: Program): Stack;
}

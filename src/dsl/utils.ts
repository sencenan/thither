import {
  ALIAS,
  ALIAS_ESCAPE,
  type Dim,
  type ErrorType,
  type Literal,
  SEP,
  SEP_ESCAPE,
  type Stack,
  type StackValue,
  type State,
  type Template,
  type ThitherError,
} from './types.ts';

export const emptyState = (): State => ['S', { targets: {}, focus: [], alias: {} }];

export const thitherError = (
  type: ErrorType,
  description: string,
  fields?: Record<string, unknown>,
): ThitherError => ['E', { type, description, ...fields }];

// dsl.md §1 — the terminal seal: nothing lands on top of R or E; literals merge into L
export const push = (stack: Stack, value: StackValue): Stack => {
  const top = stack[stack.length - 1];

  if (!top) {
    stack.push(value);
    return stack;
  }

  const [topSigil, topToken] = top;
  const [sigil, token] = value;

  switch (topSigil) {
    case 'R':
    case 'E':
      return stack;

    default:
      if (topSigil === 'L' && sigil === topSigil) {
        stack[stack.length - 1] = ['L', [...topToken, ...token]];
      } else {
        stack.push(value);
      }

      return stack;
  }
};

type Sigil = StackValue[0];
type ValueOf<K extends Sigil> = Extract<StackValue, readonly [K, unknown]>;

// Written bottom to top, the way dsl.md notates a stack: ['S', 'L'] is [.., S, L].
export type Operands<P extends readonly Sigil[]> = {
  readonly [I in keyof P]: P[I] extends Sigil ? ValueOf<P[I]> : never;
};

// The match is tagged rather than told apart from the error by shape, so a pattern may itself
// expect an E operand.
export type Taken<P extends readonly Sigil[]> =
  | readonly ['matched', Operands<P>]
  | readonly ['unmatched', ThitherError];

// dsl.md §6 — take an operation's operands off the top of the stack, matching `pattern` from the
// top down. Every value that fits is consumed; the first that does not is put back and the match
// fails with `missing_operand`, the values already taken staying consumed. Pushing the error is
// left to the caller, which may try another pattern first: try longer patterns first, since a
// pattern that is the top of another would otherwise always win. On a sealed stack the R or E
// is put back, so the caller's push of the error is absorbed by `push`.
export function takeOperands<const P extends readonly Sigil[]>(stack: Stack, pattern: P): Taken<P>;
export function takeOperands(stack: Stack, pattern: readonly Sigil[]): Taken<readonly Sigil[]> {
  const taken: StackValue[] = [];
  for (let index = pattern.length - 1; index >= 0; index--) {
    const value = stack.pop();
    if (value === undefined) {
      return ['unmatched', missingOperands(pattern)];
    }
    if (value[0] !== pattern[index]) {
      stack.push(value);
      return ['unmatched', missingOperands(pattern)];
    }
    taken.unshift(value);
  }
  return ['matched', taken];
}

const missingOperands = (pattern: readonly Sigil[]): ThitherError =>
  thitherError('missing_operand', `expected [.., ${pattern.join(', ')}]`);

// The core omits the DOM lib, which drops `URL`'s type with it; see
// docs/code-standards.md "Layout" on universal platform globals.
declare const URL: { parse(url: string): unknown | null };

// dsl.md §2 — render every {} to a probe, then require the WHATWG parser to accept it. No
// single probe is valid in every position (a port is digits-only, a scheme is letter-first),
// so try a word and a digit probe and accept the template if either rendering parses.
const PROBES = ['thither', '1'];
export const isTemplate = (value: string): value is Template =>
  PROBES.some((probe) => {
    try {
      return URL.parse(value.split('{}').join(probe)) !== null;
    } catch (_ex) {
      return false;
    }
  });

// dsl.md §3 — stored dimensions: trimmed, lowercase, deduplicated, UTF-16 sorted
export const normalizeDimensions = (dims: readonly Dim[]): Dim[] => {
  return [...new Set(dims.map((it) => it.trim().toLowerCase()))].sort();
};

// dsl.md §3 — a target's key is its normalized dimensions joined with single spaces.
export const keyOf = (dims: readonly Dim[]): string => normalizeDimensions(dims).join(' ');

// dsl.md §1 — a variant's arity is its count of anonymous `{}` placeholders.
export const arityOf = (template: Template): number => template.split('{}').length - 1;

// dsl.md §2 — the first standalone separator divides the matching portion from the suffix
export const splitAtSeparator = (
  literals: readonly Literal[],
): [matching: Literal[], suffix: Literal[]] => {
  const separator = literals.indexOf(SEP);
  return separator === -1
    ? [[...literals], []]
    : [literals.slice(0, separator), literals.slice(separator + 1)];
};

// dsl.md §3 — fzf's extended-search operators, mirrored from the library's `parseTerms`: a
// standalone `|` is OR; a leading `!`, `'` or `^` and a trailing `$` (on anything but a bare `$`)
// decorate a term. Stripping them the way fzf does leaves the text the term matches on.
const OR_TERM = '|';

const stripOperators = (term: string): string => {
  let text = term.startsWith('!') ? term.slice(1) : term;
  if (text !== '$' && text.endsWith('$')) {
    text = text.slice(0, -1);
  }
  if (text.startsWith("'") || text.startsWith('^')) {
    text = text.slice(1);
  }
  return text;
};

// A term fzf would read as an operator or an operator-decorated term, rather than plain text.
export const isOperatorTerm = (term: string): boolean =>
  term === OR_TERM || stripOperators(term) !== term;

// A token that is nothing but operator syntax: fzf drops it silently, so §2 rejects it at parse.
export const isOperatorOnly = (term: string): boolean =>
  term !== OR_TERM && stripOperators(term).length === 0;

// dsl.md §2 — one leading dot is removed when an escaped literal is used
export const resolveEscape = (literal: Literal): Dim =>
  literal.startsWith(SEP_ESCAPE) || literal.startsWith(ALIAS_ESCAPE) ? literal.slice(1) : literal;

// dsl.md §2 — an alias is `~` followed by a short form; a bare `~` has none and is plain text.
export const isAlias = (literal: Literal): boolean =>
  literal.startsWith(ALIAS) && literal.length > ALIAS.length;

// dsl.md §2 — replace each alias that has a definition with the definition's literal, once: that
// literal is not itself resolved again. An alias with no definition stays as typed. Own keys only,
// so `~constructor` cannot reach Object.prototype.
export const resolveAliases = (state: State, literals: readonly Literal[]): Literal[] => {
  const { alias } = state[1];
  return literals.map((literal) => {
    if (!isAlias(literal)) {
      return literal;
    }
    const short = literal.slice(ALIAS.length).toLowerCase();
    return Object.hasOwn(alias, short) ? (alias[short] ?? literal) : literal;
  });
};

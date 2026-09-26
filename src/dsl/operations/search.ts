// dsl.md §4.4, §5 — .$: search with boundary inference, render arguments, order matches

import { type Selection, searchTargets } from '../selector.ts';
import {
  type Dim,
  type Hint,
  type Literal,
  type Match,
  type OpFn,
  type Result,
  SEP,
  type State,
  type TargetSet,
  type Template,
} from '../types.ts';
import { arityOf, push, resolveEscape, splitAtSeparator, thitherError } from '../utils.ts';

const missingOperand = thitherError('missing_operand', '.$ expects [.., S, L] or [.., S]');

export const search: OpFn = (_interp, stack) => {
  const top = stack.pop();

  if (!top) {
    return push(stack, missingOperand);
  }

  // [K, S] | .$ -> [K, S, R]: search on focus alone.
  if (top[0] === 'S') {
    push(stack, top);
    return push(stack, resultFor(top, []));
  }

  // Not a shape .$ consumes: put it back untouched and fail.
  if (top[0] !== 'L') {
    push(stack, top);
    return push(stack, missingOperand);
  }

  // [K, S, L] | .$ -> [K, S, R]: the state stays, the literal array is consumed.
  const state = stack[stack.length - 1];
  if (state?.[0] !== 'S') {
    return push(stack, missingOperand);
  }

  return push(stack, resultFor(state, top[1]));
};

// dsl.md §4.4 — resolve L into matching inputs and arguments, then §5 render and order.
const resultFor = (state: State, literals: readonly Literal[]): Result => {
  const { targets, focus } = state[1];
  const { matching, args } = inferBoundary(literals, targets, focus);

  // §3 — focus then the explicit terms, in typed order: the query is fzf's, operators and all.
  const query = [...focus, ...matching.map(resolveEscape)];

  // §5 — each selected target becomes a contiguous group of variant rows; groups are ordered by
  // score descending, ties falling to target-set order (a stable sort over the selection order).
  const groups = searchTargets(targets, query).map((selection) => ({
    score: selection.score,
    rows: orderVariants(matchesFor(selection, args)),
  }));
  const matches = [...groups].sort((a, b) => b.score - a.score).flatMap((group) => group.rows);

  return ['R', { matches, inputs: matching }];
};

interface Boundary {
  // Verbatim matching literals; original spelling doubles as R.inputs.
  readonly matching: readonly Literal[];
  // Arguments in accumulated form; escapes are resolved at rendering, spelling and case kept.
  readonly args: readonly Literal[];
}

// dsl.md §4.4 — split L into matching inputs and arguments.
const inferBoundary = (
  literals: readonly Literal[],
  targets: TargetSet,
  focus: readonly Dim[],
): Boundary => {
  // With a separator: the matching portion is matched in full, the suffix is arguments.
  if (literals.includes(SEP)) {
    const [matching, args] = splitAtSeparator(literals);
    return { matching, args };
  }

  // Without a separator: start from the longest nonempty prefix yielding at least one match, then
  // give back trailing literals that added no matching evidence. The first literal is never given
  // back, so the matching portion stays nonempty.
  const selectionAt = (length: number): Selection[] =>
    searchTargets(targets, [...focus, ...literals.slice(0, length).map(resolveEscape)]);

  let length = literals.length;
  while (length > 0 && selectionAt(length).length === 0) {
    length--;
  }

  // No prefix matched anything: report the whole attempt as inputs, with no arguments.
  if (length === 0) {
    return { matching: literals, args: [] };
  }

  while (length > 1 && !addsEvidence(selectionAt(length - 1), selectionAt(length))) {
    length--;
  }

  return { matching: literals.slice(0, length), args: literals.slice(length) };
};

// dsl.md §4.4 — a literal is matching input when it changes which targets are selected, or
// matches a character of a selected key that no earlier term matched. A literal that only
// re-hits already-matched characters (`a` after `api`) is an argument that happened to fuzzy-match.
const addsEvidence = (before: readonly Selection[], after: readonly Selection[]): boolean => {
  if (before.length !== after.length) {
    return true;
  }
  const priorPositions = new Map(before.map((s) => [s.target[0], new Set(s.positions)]));
  return after.some((s) => {
    const prior = priorPositions.get(s.target[0]);
    return prior === undefined || s.positions.some((p) => !prior.has(p));
  });
};

// dsl.md §4.4 (ADR 0011) — for one selected target, every variant yields a row. The best fit (a
// variant whose arity equals the argument count) is not singled out here: it is simply the
// argDelta === 0 row, which orderVariants leads with and the client navigates to.
const matchesFor = (selection: Selection, args: readonly Literal[]): Match[] => {
  const [key, variants] = selection.target;
  return variants.map((template) => toMatch(selection, key, template, args));
};

// dsl.md §5 — render the template and record the argument balance for one variant.
// §2 — an escaped argument is *used* here, so one leading dot is removed before substitution;
// `m.args` reports the same resolved spelling, while `R.inputs` keeps the accumulated form.
const toMatch = (
  selection: Selection,
  key: string,
  template: Template,
  args: readonly Literal[],
): Match => {
  const placeholders = arityOf(template);
  const applied = args.slice(0, Math.min(args.length, placeholders)).map(resolveEscape);

  const hint: Hint = {
    argDelta: args.length - placeholders,
    positions: selection.positions,
    score: selection.score,
  };

  return [render(template, applied), template, key, applied, hint];
};

// dsl.md §5 — fill {} left-to-right with literal argument text, never re-parsed as template: the
// scan resumes after the inserted argument, so an argument containing `{}` is not a new slot.
const render = (template: string, applied: readonly Literal[]): string => {
  let out = '';
  let rest = template;
  for (const arg of applied) {
    const at = rest.indexOf('{}');
    out += rest.slice(0, at) + arg;
    rest = rest.slice(at + 2);
  }
  return out + rest;
};

// dsl.md §5 — within one target, order variant rows by argument balance: zero first (the best
// fit is the only row), then positive ascending, then negative by magnitude ascending.
const orderVariants = (rows: readonly Match[]): Match[] =>
  [...rows].sort((a, b) => {
    const da = a[4].argDelta;
    const db = b[4].argDelta;
    const ba = bucket(da);
    const bb = bucket(db);
    if (ba !== bb) {
      return ba - bb;
    }
    return Math.abs(da) - Math.abs(db);
  });

const bucket = (argDelta: number): number => (argDelta === 0 ? 0 : argDelta > 0 ? 1 : 2);

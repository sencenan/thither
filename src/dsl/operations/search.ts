// dsl.md §4.4, §5 — .$: search with boundary inference, render arguments, order matches

import { type Selection, searchDestinations, searchTargets } from '../selector.ts';
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
import {
  arityOf,
  push,
  resolveEscape,
  splitAtSeparator,
  takeOperands,
  thitherError,
} from '../utils.ts';

const missingOperand = thitherError('missing_operand', '.$ expects [.., S, L] or [.., S]');

// The state stays under the result: [K, S, L] -> [K, S, R] and [K, S] -> [K, S, R].
export const search: OpFn = (_interp, stack) => {
  const [matched, operands] = takeOperands(stack, ['S', 'L']);
  if (matched === 'matched') {
    const [state, ls] = operands;
    return push(push(stack, state), resultFor(state, ls[1]));
  }

  // Searching on focus alone.
  const [bareMatched, bare] = takeOperands(stack, ['S']);
  if (bareMatched === 'unmatched') {
    return push(stack, missingOperand);
  }
  const [state] = bare;
  return push(push(stack, state), resultFor(state, []));
};

// dsl.md §4.4 — resolve L into matching inputs and arguments, then §5 render and order. When no
// key matches, destination search runs the same query against each variant's template instead.
const resultFor = (state: State, literals: readonly Literal[]): Result => {
  const { targets, focus } = state[1];
  const { matching, args } = inferBoundary(literals, targets, focus);

  // §3 — focus then the explicit terms, in typed order: the query is fzf's, operators and all.
  const query = [...focus, ...matching.map(resolveEscape)];

  const byKey = keyGroups(targets, query, args);
  const groups = byKey.length > 0 ? byKey : destinationGroups(targets, query, args);

  return ['R', { matches: order(groups), inputs: matching }];
};

// One selected target's rows, before ordering, and the score it ranks by.
interface Group {
  readonly key: string;
  readonly score: number;
  readonly rows: readonly Match[];
}

// §4.4 (ADR 0011) — a key-selected target yields one row per variant, all sharing its evidence.
const keyGroups = (targets: TargetSet, query: readonly Dim[], args: readonly Literal[]): Group[] =>
  searchTargets(targets, query).map(({ target: [key, variants], score, positions }) => ({
    key,
    score,
    rows: variants.map((template) => toMatch(key, template, args, { on: 'key', positions, score })),
  }));

// §4.4 (ADR 0014) — destination search yields a row only for each variant whose template matched,
// grouped by target in target-set order; the target ranks by its best variant's score.
const destinationGroups = (
  targets: TargetSet,
  query: readonly Dim[],
  args: readonly Literal[],
): Group[] => {
  const rowsByKey = new Map<string, Match[]>();
  for (const { key, template, score, positions } of searchDestinations(targets, query)) {
    const row = toMatch(key, template, args, { on: 'destination', positions, score });
    rowsByKey.set(key, [...(rowsByKey.get(key) ?? []), row]);
  }
  return [...rowsByKey].map(([key, rows]) => ({
    key,
    score: Math.max(...rows.map((row) => row[4].score)),
    rows,
  }));
};

// §5 (ADR 0013) — each target becomes a contiguous run of variant rows; targets are ordered by
// score descending, then by key length ascending (the shortest/exact key leads, since fzf's score
// ignores a key's unmatched tail), then by representative-destination length, and finally by
// target-set order (a stable sort over the selection order).
const order = (groups: readonly Group[]): Match[] =>
  groups
    .map((group) => {
      const rows = orderVariants(group.rows);
      return {
        score: group.score,
        keyLength: group.key.length,
        destLength: representativeDest(rows).length,
        rows,
      };
    })
    .sort((a, b) => b.score - a.score || a.keyLength - b.keyLength || a.destLength - b.destLength)
    .flatMap((group) => group.rows);

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

  // No prefix matched anything: every literal is matching input, for destination search too.
  // `R.inputs` then reports the whole attempt, with no arguments.
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

// dsl.md §5 — render the template and record the argument balance for one variant. The best fit
// (a variant whose arity equals the argument count) is not singled out here: it is simply the
// argDelta === 0 row, which orderVariants leads with and the client navigates to.
// §2 — an escaped argument is *used* here, so one leading dot is removed before substitution;
// `m.args` reports the same resolved spelling, while `R.inputs` keeps the accumulated form.
const toMatch = (
  key: string,
  template: Template,
  args: readonly Literal[],
  evidence: Omit<Hint, 'argDelta'>,
): Match => {
  const placeholders = arityOf(template);
  const applied = args.slice(0, Math.min(args.length, placeholders)).map(resolveEscape);
  const hint: Hint = { argDelta: args.length - placeholders, ...evidence };
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

// dsl.md §5 (ADR 0013) — the rendered destination that represents a target in the cross-target
// length tiebreak: the row a client would navigate to (the best fit, or the sole row of a
// single-variant target), or, when no row is navigable, the shortest of its rendered destinations.
// The rows arrive in orderVariants order, so the best fit, when present, is first.
const representativeDest = (rows: readonly Match[]): string => {
  const bestFit = rows.find((row) => row[4].argDelta === 0);
  if (bestFit !== undefined) {
    return bestFit[0];
  }
  const [first, ...rest] = rows;
  if (first !== undefined && rest.length === 0 && first[4].argDelta > 0) {
    return first[0];
  }
  // No navigable row: the shortest rendering. A selected target always has at least one variant.
  return rows.reduce(
    (shortest, row) => (row[0].length < shortest.length ? row[0] : shortest),
    first?.[0] ?? '',
  );
};

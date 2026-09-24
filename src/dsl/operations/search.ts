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
  type Target,
} from '../types.ts';
import { push, resolveEscape, splitAtSeparator, thitherError } from '../utils.ts';

const missingOperand = thitherError('missing_operand', '.$ expects [.., S, L] or [.., S]');

export const search: OpFn = (stack) => {
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
  const matches = orderMatches(
    searchTargets(targets, query).map((selection) => toMatch(selection, args)),
  );

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
  targets: readonly Target[],
  focus: readonly Dim[],
): Boundary => {
  // With a separator: the matching portion is matched in full, the suffix is arguments.
  if (literals.includes(SEP)) {
    const [matching, args] = splitAtSeparator(literals);
    return { matching, args };
  }

  // Without a separator: the longest nonempty prefix yielding at least one match wins.
  for (let length = literals.length; length > 0; length--) {
    const prefix = literals.slice(0, length);
    const query = [...focus, ...prefix.map(resolveEscape)];
    if (searchTargets(targets, query).length > 0) {
      return { matching: prefix, args: literals.slice(length) };
    }
  }

  // No prefix matched anything: report the whole attempt as inputs, with no arguments.
  return { matching: literals, args: [] };
};

// dsl.md §5 — render the template and record the argument balance for one selected target.
// §2 — an escaped argument is *used* here, so one leading dot is removed before substitution;
// `m.args` reports the same resolved spelling, while `R.inputs` keeps the accumulated form.
const toMatch = (selection: Selection, args: readonly Literal[]): Match => {
  const [dims, template] = selection.target;
  const placeholders = template.split('{}').length - 1;
  const applied = args.slice(0, Math.min(args.length, placeholders)).map(resolveEscape);

  const hint: Hint = {
    argDelta: args.length - placeholders,
    positions: selection.positions,
    score: selection.score,
  };

  return [render(template, applied), dims, applied, hint];
};

// dsl.md §5 — fill {} left-to-right with literal argument text, never re-parsed as template.
const render = (template: string, applied: readonly Literal[]): string => {
  let out = template;
  for (const arg of applied) {
    const at = out.indexOf('{}');
    out = out.slice(0, at) + arg + out.slice(at + 2);
  }
  return out;
};

// dsl.md §5 — the one total order clients render top-to-bottom without sorting. The
// input arrives in target-set order and Array.prototype.sort is stable, so ties on
// every key below fall to target-set order without tracking indices.
const orderMatches = (matches: readonly Match[]): Match[] =>
  [...matches].sort((a, b) => {
    const ah = a[3];
    const bh = b[3];

    const aNonneg = ah.argDelta >= 0 ? 0 : 1;
    const bNonneg = bh.argDelta >= 0 ? 0 : 1;
    if (aNonneg !== bNonneg) {
      return aNonneg - bNonneg;
    }

    const aAbs = Math.abs(ah.argDelta);
    const bAbs = Math.abs(bh.argDelta);
    if (aAbs !== bAbs) {
      return aAbs - bAbs;
    }

    return bh.score - ah.score;
  });

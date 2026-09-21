// dsl.md §2 "Supplied structured values" and §6 — validate and normalize a
// structured (object) value supplied to `append`. This is the structured-value
// half of the parse step; the string-token half is token-parsing. It reuses the
// destination seam (ticket 06) and the normalization seam (07's own file) and
// knows nothing of the stack, evaluation, or matching.
//
// Phase rule (dsl.md §6): every rejection here happens at *parse* time, so it is
// always `parse_error`, whatever the cause. The evaluation-phase types
// (`invalid_destination`, `missing_operand`, `ambiguous_set`) never originate here
// — the same malformed destination is `parse_error` inside a supplied `S` and
// `invalid_destination` only as a `.set` operand.
//
// The per-sigil validators answer with a concrete value or `undefined` (the same
// verdict shape as ticket 06's `validateDestination`); `validateStructured` turns
// an `undefined` into the `parse_error` and returns a `ProgramItem` — the thing
// `append` puts into a program.

import type {
  Dim,
  Match,
  MatchSet,
  ProgramItem,
  Result,
  State,
  Target,
  ThitherError,
} from "../types.ts";
import { validateDestination } from "./destination.ts";
import { normalizeDimensions } from "./normalization.ts";

function parseError(description: string): ThitherError {
  return ["E", { type: "parse_error", description }];
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((member) => typeof member === "string");
}

// Validate a supplied structured value into the program item it becomes: a
// normalized `S`/`R`, the supplied `E` itself, or a generated `parse_error` `E`.
export function validateStructured(value: unknown): ProgramItem {
  // Only ["S"|"R"|"E", body] is a top-level value. A standalone `t`, `T`, `m`,
  // `M`, or a literal array fails this shape (`t`/`m`/`M` are arrays whose head is
  // not a sigil string; `T` and `L` have the wrong arity or head), so they all
  // land on the same parse_error path dsl.md §1 requires.
  if (!Array.isArray(value) || value.length !== 2 || typeof value[0] !== "string") {
    return parseError("a structured value must be an [sigil, body] pair");
  }
  const [sigil, body] = value;
  switch (sigil) {
    case "S":
      return validateState(body) ?? parseError("malformed state (S) value");
    case "R":
      return validateResult(body) ?? parseError("malformed result (R) value");
    case "E":
      return validateSuppliedError(body) ?? parseError("malformed error (E) value");
    default:
      return parseError(`unsupported top-level value with sigil ${JSON.stringify(sigil)}`);
  }
}

function validateState(body: unknown): State | undefined {
  if (!isObject(body)) {
    return undefined;
  }
  const { targets, focus } = body;
  if (!Array.isArray(targets) || !isStringArray(focus)) {
    return undefined;
  }
  const normalizedFocus = normalizeDimensions(focus);
  if (normalizedFocus === undefined) {
    return undefined;
  }

  const normalizedTargets: Target[] = [];
  // Detect duplicate normalized dimension sets *after* normalization; the sorted,
  // deduped NormDim list is already canonical, so its JSON is a sound identity key
  // (dsl.md §2). Duplicates are invalid whether or not destinations differ; do not
  // merge or pick.
  const seenDimensionSets = new Set<string>();
  for (const target of targets) {
    if (!Array.isArray(target) || target.length !== 2) {
      return undefined;
    }
    const [dimensions, destination] = target;
    if (!isStringArray(dimensions) || typeof destination !== "string") {
      return undefined;
    }
    const normalizedDimensions = normalizeDimensions(dimensions);
    if (normalizedDimensions === undefined) {
      return undefined;
    }
    const validatedDestination = validateDestination(destination);
    if (validatedDestination === undefined) {
      return undefined;
    }
    const identity = JSON.stringify(normalizedDimensions);
    if (seenDimensionSets.has(identity)) {
      return undefined;
    }
    seenDimensionSets.add(identity);
    normalizedTargets.push([normalizedDimensions, validatedDestination]);
  }

  // Rebuilding from only targets/focus drops any unknown fields (dsl.md §2), and
  // preserves target order — normalization reorders dimensions *within* a target,
  // never the targets themselves.
  return ["S", { targets: normalizedTargets, focus: normalizedFocus }];
}

// dsl.md §2 keeps R.inputs and match contents verbatim, and §5 lets a produced
// match hold a partially-rendered (post-substitution, possibly invalid) URL, so
// this validates the *shape* only — never re-normalizing or re-validating a
// destination — and passes match contents through untouched. Required fields are
// checked; unknown fields on R are dropped.
function validateResult(body: unknown): Result | undefined {
  if (!isObject(body)) {
    return undefined;
  }
  const { matches, inputs } = body;
  if (!Array.isArray(matches) || !isStringArray(inputs)) {
    return undefined;
  }
  const validatedMatches: Match[] = [];
  for (const match of matches) {
    if (
      !Array.isArray(match) ||
      match.length !== 4 ||
      typeof match[0] !== "string" ||
      !isStringArray(match[1]) ||
      !isStringArray(match[2]) ||
      !isObject(match[3])
    ) {
      return undefined;
    }
    validatedMatches.push(match as unknown as Match);
  }
  return ["R", { matches: validatedMatches as MatchSet, inputs: inputs as readonly Dim[] }];
}

// dsl.md §6 holds a supplied `E` to a weaker rule than a generated one: it needs
// only a string `type` and string `description`, its `type` is *not* checked
// against the vocabulary (so another version's error round-trips), and its extra
// diagnostic fields are preserved uninterpreted. A shallow copy detaches it from
// the caller's object while keeping every field.
function validateSuppliedError(body: unknown): ThitherError | undefined {
  if (!isObject(body)) {
    return undefined;
  }
  if (typeof body.type !== "string" || typeof body.description !== "string") {
    return undefined;
  }
  return ["E", { ...body } as ThitherError[1]];
}

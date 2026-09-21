// dsl.md §2 "Supplied structured values" and §6 — validate and normalize a
// structured (object) value supplied to `append`.
//
// Phase rule (dsl.md §6): every rejection here happens at parse time, so it is
// always `parse_error` whatever the cause. The same malformed destination is
// `parse_error` inside a supplied `S` but `invalid_destination` as a `.set`
// operand, so the evaluation-phase types never originate here.

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
import { isValidDimension, normalizeDimensions } from "./dimension.ts";

function parseError(description: string): ThitherError {
  return ["E", { type: "parse_error", description }];
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((member) => typeof member === "string");
}

export function validateStructured(value: unknown): ProgramItem {
  // A standalone `t`, `T`, `m`, `M`, or literal array fails this shape, which is
  // how dsl.md §1's "cannot appear as standalone values" is enforced.
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
  if (!focus.every(isValidDimension)) {
    return undefined;
  }
  const normalizedFocus = normalizeDimensions(focus);

  const normalizedTargets: Target[] = [];
  // A normalized dimension list is sorted and deduped, so its JSON is a sound
  // identity key. Duplicates invalidate the value rather than merging (dsl.md §2).
  const seenDimensionSets = new Set<string>();
  for (const target of targets) {
    if (!Array.isArray(target) || target.length !== 2) {
      return undefined;
    }
    const [dimensions, destination] = target;
    if (!isStringArray(dimensions) || typeof destination !== "string") {
      return undefined;
    }
    if (!dimensions.every(isValidDimension)) {
      return undefined;
    }
    const normalizedDimensions = normalizeDimensions(dimensions);
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

  // Rebuilding from targets/focus alone is what drops unknown fields (dsl.md §2).
  return ["S", { targets: normalizedTargets, focus: normalizedFocus }];
}

// Shape-checked only: §5 lets a produced match hold a partially-rendered,
// post-substitution destination, and §2 keeps `inputs` in original spelling, so
// re-validating or re-normalizing here would reject valid results.
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

// dsl.md §6 holds a supplied `E` to a weaker rule than a generated one: its
// `type` is not checked against the vocabulary, so another version's error
// round-trips, and its extra diagnostic fields are preserved uninterpreted.
function validateSuppliedError(body: unknown): ThitherError | undefined {
  if (!isObject(body)) {
    return undefined;
  }
  if (typeof body.type !== "string" || typeof body.description !== "string") {
    return undefined;
  }
  return ["E", { ...body } as ThitherError[1]];
}

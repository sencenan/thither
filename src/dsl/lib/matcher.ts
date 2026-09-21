// dsl.md §3 (matching) and §5 (matching evidence) — fuzzy matching over the
// pinned npm `fzf` port.

import { basicMatch, Fzf } from "fzf";
import type { Dim, Target, TargetSet } from "../types.ts";
import { normalizeDimensions } from "./dimension.ts";

export interface TargetMatch {
  readonly target: Target;
  // Ascending indices into the target's searchable string, unioned across query
  // dimensions (dsl.md §5).
  readonly positions: readonly number[];
  readonly score: number;
}

function searchable(target: Target): string {
  return target[0].join(" ");
}

export function match(targets: TargetSet, queryDimensions: readonly Dim[]): readonly TargetMatch[] {
  const query = normalizeDimensions(queryDimensions);

  // An empty query selects everything, scoring 0: a sum over zero dimensions
  // (dsl.md §3, §5).
  if (query.length === 0) {
    return targets.map((target) => ({ target, positions: [], score: 0 }));
  }

  // Matched through a selector over objects, not raw strings, so two targets
  // sharing a searchable string stay distinct. fzf hands back the very object it
  // was given, so each carries its own accumulators.
  const candidates = targets.map((target) => ({
    target,
    text: searchable(target),
    hits: 0,
    score: 0,
    positions: new Set<number>(),
  }));

  // Every option is set explicitly because the port's defaults are wrong here and
  // the settings look redundant without that: `casing` defaults to smart-case and
  // `normalize` to true, which would fold diacritics (`cafe` must not match
  // `café`). `basicMatch` keeps each dimension a literal pattern — `extendedMatch`
  // would import fzf's query operators, which dsl.md §3 forbids.
  for (const dimension of query) {
    const fzf = new Fzf(candidates, {
      selector: (candidate) => candidate.text,
      fuzzy: "v2",
      casing: "case-insensitive",
      normalize: false,
      match: basicMatch,
      sort: false,
    });
    for (const result of fzf.find(dimension)) {
      const candidate = result.item;
      candidate.hits += 1;
      candidate.score += result.score;
      for (const position of result.positions) {
        candidate.positions.add(position);
      }
    }
  }

  // AND selection (dsl.md §3), in target-set order — the final ranking tiebreak.
  return candidates
    .filter((candidate) => candidate.hits === query.length)
    .map((candidate) => ({
      target: candidate.target,
      positions: [...candidate.positions].sort((a, b) => a - b),
      score: candidate.score,
    }));
}

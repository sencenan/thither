// dsl.md §3 (matching) and §5 (matching evidence) — the fuzzy matcher over the
// pinned npm `fzf` port. Given the targets and a flat list of query dimensions,
// it selects every target that matches *all* query dimensions and reports each
// selection's summed score and unioned match positions.
//
// The matcher normalizes the query dimensions itself (dsl.md §3: lowercase copies
// for matching), so it does not care whether a caller passes raw stack literals
// or already-normalized dimensions — normalization is idempotent. Matching treats
// every query dimension alike (order-independent, AND-selected), so the matcher
// has no notion of "focus": combining focus with the explicit matching literals,
// and the focus-vs-explicit distinction, live above this seam in the operations.
// It knows nothing of `.$`'s boundary inference, rendering, or argument balance.

import { basicMatch, Fzf } from "fzf";
import type { Dim, Target, TargetSet } from "../types.ts";
import { normalizeDimensions } from "./dimension.ts";

// A selected target and its matching evidence. `argDelta` and the final ordering
// (dsl.md §5) belong to rendering (ticket 12), so this carries only what the
// matcher can know: the union of matched positions and the summed score.
export interface TargetMatch {
  readonly target: Target;
  // Ascending, deduplicated union of matched character indices across all query
  // dimensions, as indices into the searchable string (dsl.md §5).
  readonly positions: readonly number[];
  // Sum of the per-query-dimension scores (dsl.md §5).
  readonly score: number;
}

// dsl.md §3: a target's canonically sorted dimensions joined with single spaces
// into one searchable string. Stored dimensions are already canonical
// (normalization sorts and dedups them), so a plain join is that canonical form.
function searchable(target: Target): string {
  return target[0].join(" ");
}

export function match(targets: TargetSet, queryDimensions: readonly Dim[]): readonly TargetMatch[] {
  // dsl.md §3: normalized copies for matching, deduplicated. Normalization is total and
  // idempotent, so a caller may pass raw stack literals or already-normalized
  // focus dimensions freely; the matcher never validates or rejects a query
  // dimension.
  const query = normalizeDimensions(queryDimensions);

  // An empty query selects every target with empty evidence (dsl.md §3, §5): a
  // sum over zero dimensions is 0 and no character is matched.
  if (query.length === 0) {
    return targets.map((target) => ({ target, positions: [], score: 0 }));
  }

  // Match target objects through a selector, not raw strings, so two targets that
  // happen to share a searchable string are still tracked separately. Each
  // candidate carries its own accumulators (fzf returns the very object it was
  // given), which avoids indexed lookups into parallel arrays.
  const candidates = targets.map((target) => ({
    target,
    text: searchable(target),
    hits: 0,
    score: 0,
    positions: new Set<number>(),
  }));

  // dsl.md §3/§5. Every fzf finder is configured explicitly rather than by
  // default, so behaviour is Thither's, not the port's: `fuzzy: "v2"` and
  // `casing: "case-insensitive"` give the case-insensitive fuzzy match;
  // `normalize: false` disables diacritic folding (`cafe` must not match `café`);
  // `match: basicMatch` sends each dimension as one literal fuzzy pattern and
  // never imports fzf's extended-query operators (the fzf-research integration
  // trap); and `sort: false` leaves ranking to dsl.md §5 (ticket 12). One finder
  // per query dimension realises "match each dimension independently against the
  // whole string".
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

  // AND selection (dsl.md §3): keep a target only when every query dimension
  // matched it. Returned in target-set order, which ticket 12 uses as the final
  // ranking tiebreak.
  return candidates
    .filter((candidate) => candidate.hits === query.length)
    .map((candidate) => ({
      target: candidate.target,
      positions: [...candidate.positions].sort((a, b) => a - b),
      score: candidate.score,
    }));
}

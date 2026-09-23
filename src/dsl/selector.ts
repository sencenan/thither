import { Fzf } from 'fzf';
import type { Dim, Target } from './types';

// dsl.md §5 — the matcher's evidence for one selected target: its score and the
// ascending, deduplicated character indices matched within its searchable string.
export interface Selection {
  readonly target: Target;
  readonly score: number;
  readonly positions: readonly number[];
}

// dsl.md §3 — selections come back in target-set order (`sort: false`), so a caller's
// stable sort on its own keys falls to target-set order on ties without tracking indices.
const createFzfForTargets = (targets: readonly Target[]): Fzf<Target[]> =>
  new Fzf(targets, {
    selector: (target: Target) => target[0].join(' '),
    sort: false,
  });

// dsl.md §3 — match the query as one space-joined pattern against each target's
// space-joined searchable string; §5 — carry each selection's score and positions.
export const searchTargets = (targets: readonly Target[], query: readonly Dim[]): Selection[] =>
  createFzfForTargets(targets)
    .find(query.join(' '))
    .map((result) => ({
      target: result.item,
      score: result.score,
      positions: [...result.positions].sort((a, b) => a - b),
    }));

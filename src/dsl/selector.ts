import { extendedMatch, Fzf } from 'fzf';
import type { Dim, Target, TargetSet, Template } from './types.ts';

// dsl.md §5 — the matcher's evidence for one selected target: its score and the
// ascending, deduplicated character indices matched within its key.
export interface Selection {
  readonly target: Target;
  readonly score: number;
  readonly positions: readonly number[];
}

// dsl.md §3 — selections come back in target-set order (`sort: false`), which is the object's
// iteration order, so a caller's stable sort on its own keys falls to target-set order on ties.
// `extendedMatch` is fzf's extended-search mode: the query is a space-separated list of terms,
// every term must match, and fzf's operators (`|`, `!`, `'`, `^`, `$`) are live. Casing is fzf's
// smart-case default: a term with an uppercase letter is case-sensitive. The matcher runs against
// each target's key (dsl.md §3), so the fzf selector is the key.
const createFzfForTargets = (entries: readonly Target[]): Fzf<Target[]> =>
  new Fzf([...entries], {
    selector: (entry: Target) => entry[0],
    match: extendedMatch,
    sort: false,
  });

// dsl.md §3 — the query terms, in the order given, become one fzf query against each target's
// key; §5 — carry each selection's score and positions. Target-set order is the object's own
// iteration order, so `Object.entries` yields the selections in target-set order.
export const searchTargets = (targets: TargetSet, query: readonly Dim[]): Selection[] =>
  createFzfForTargets(Object.entries(targets))
    .find(query.join(' '))
    .map((result) => ({
      target: result.item,
      score: result.score,
      positions: ascending(result.positions),
    }));

// dsl.md §5 — the matcher's evidence for one variant whose raw template matched.
export interface DestinationSelection {
  readonly key: string;
  readonly template: Template;
  readonly score: number;
  readonly positions: readonly number[];
}

// dsl.md §4.4 destination search — the same query, matched against each variant's raw template
// on its own. Selections come back in target-set order, then variant order within a target.
export const searchDestinations = (
  targets: TargetSet,
  query: readonly Dim[],
): DestinationSelection[] =>
  new Fzf(
    Object.entries(targets).flatMap(([key, variants]) =>
      variants.map((template) => [key, template] as const),
    ),
    { selector: ([, template]) => template, match: extendedMatch, sort: false },
  )
    .find(query.join(' '))
    .map(({ item: [key, template], score, positions }) => ({
      key,
      template,
      score,
      positions: ascending(positions),
    }));

const ascending = (positions: Iterable<number>): number[] => [...positions].sort((a, b) => a - b);

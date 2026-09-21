import { describe, expect, it } from "vitest";
import type { Dim, NormDim, Target, TargetSet, Template } from "../../types.ts";
import { match } from "../matcher.ts";

// Branded fixtures: NormDim/Dim/Template are plain strings at runtime. Target
// dimensions are written already-normalized (sorted, lowercase), as stored.
const dim = (d: string): NormDim => d as NormDim;
const target = (ds: readonly string[], destination: string): Target => [
  ds.map(dim),
  destination as Template,
];
// A query dimension is a raw stack literal (original spelling); the matcher
// normalizes it internally.
const q = (...ds: string[]): readonly Dim[] => ds.map((d) => d as Dim);

// The core is compiled with noUncheckedIndexedAccess, so an indexed selection is
// `T | undefined`. This narrows and fails loudly when a test expected a match.
function first<T>(items: readonly T[]): T {
  const [item] = items;
  if (item === undefined) {
    throw new Error("expected at least one match");
  }
  return item;
}

const destinationsOf = (matches: readonly { target: Target }[]): string[] =>
  matches.map((m) => m.target[1]);

describe("match — AND over query dimensions (dsl.md §3)", () => {
  const targets: TargetSet = [target(["company", "git"], "https://github.com/company/{}")];

  it("selects a target only when every query dimension matches", () => {
    expect(destinationsOf(match(targets, q("company", "git")))).toEqual([
      "https://github.com/company/{}",
    ]);
  });

  it("rejects the target when any query dimension fails to match", () => {
    expect(match(targets, q("company", "nonexistent"))).toEqual([]);
  });
});

describe("match — query-dimension order is irrelevant (dsl.md §3)", () => {
  const targets: TargetSet = [target(["company", "git"], "https://x.example/{}")];

  it("gives identical selection and score for reversed query order", () => {
    const forward = first(match(targets, q("git", "company")));
    const reversed = first(match(targets, q("company", "git")));
    expect(forward.score).toBe(reversed.score);
    expect(forward.positions).toEqual(reversed.positions);
  });
});

describe("match — normalizes the query internally (dsl.md §3)", () => {
  const targets: TargetSet = [target(["company"], "https://x.example/{}")];

  it("matches regardless of case (lowercased internally)", () => {
    expect(match(targets, q("Company"))).toHaveLength(1);
    expect(match(targets, q("COMPANY"))).toHaveLength(1);
  });

  it("deduplicates query dimensions that normalize to the same value", () => {
    const deduped = match(targets, q("company", "Company"));
    const single = match(targets, q("company"));
    expect(deduped).toHaveLength(1);
    // Deduped to one dimension, so the score is not double-counted.
    expect(first(deduped).score).toBe(first(single).score);
  });

  it("does not fold diacritics: cafe does not match café", () => {
    const cafe: TargetSet = [target(["café"], "https://x.example/{}")];
    expect(match(cafe, q("cafe"))).toEqual([]);
    expect(match(cafe, q("café"))).toHaveLength(1);
  });
});

describe("match — positions are indices into the searchable string (dsl.md §5)", () => {
  const targets: TargetSet = [target(["company", "git"], "https://x.example/{}")];

  it("reports the matched character indices of a contiguous token", () => {
    // Searchable string "company git": g/i/t are at indices 8, 9, 10.
    expect(first(match(targets, q("git"))).positions).toEqual([8, 9, 10]);
  });

  it("a fuzzy token may span the dimension boundary", () => {
    // "yg" matches y (index 6, end of "company") then g (index 8, start of "git").
    expect(first(match(targets, q("yg"))).positions).toEqual([6, 8]);
  });

  it("unions overlapping matches into an ascending, deduplicated list", () => {
    const m = first(match(targets, q("comp", "company")));
    expect(m.positions).toEqual([...m.positions].sort((a, b) => a - b));
    expect(new Set(m.positions).size).toBe(m.positions.length);
    expect(m.positions).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });
});

describe("match — score is the sum of per-dimension scores (dsl.md §5)", () => {
  const targets: TargetSet = [target(["company", "git"], "https://x.example/{}")];

  it("a two-dimension match scores higher than either dimension alone", () => {
    const one = first(match(targets, q("company")));
    const both = first(match(targets, q("company", "git")));
    expect(both.score).toBeGreaterThan(one.score);
  });
});

describe("match — cardinality and empty query (dsl.md §3, §5)", () => {
  const targets: TargetSet = [
    target(["company", "git"], "https://a.example/{}"),
    target(["git", "personal"], "https://b.example/{}"),
    target(["docs"], "https://c.example/{}"),
  ];

  it("returns every selected target, never truncating to a top result", () => {
    // Both git-bearing targets match; no winner-margin rule collapses them.
    expect(destinationsOf(match(targets, q("git")))).toEqual([
      "https://a.example/{}",
      "https://b.example/{}",
    ]);
  });

  it("selects every target with empty evidence when the query is empty", () => {
    const matches = match(targets, q());
    expect(destinationsOf(matches)).toEqual([
      "https://a.example/{}",
      "https://b.example/{}",
      "https://c.example/{}",
    ]);
    expect(matches.every((m) => m.score === 0 && m.positions.length === 0)).toBe(true);
  });

  it("preserves target-set order in the returned selections", () => {
    expect(destinationsOf(match(targets, q("git")))).toEqual([
      "https://a.example/{}",
      "https://b.example/{}",
    ]);
  });
});

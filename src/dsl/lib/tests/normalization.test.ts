import { describe, expect, it } from "vitest";
import { normalizeDimension, normalizeDimensions } from "../normalization.ts";

describe("normalizeDimension (dsl.md §3)", () => {
  it.each([
    ["trims surrounding whitespace", " company ", "company"],
    ["lowercases, locale-independent", "Git", "git"],
    ["lowercases uppercase runs", "COMPANY", "company"],
    ["preserves diacritics (no NFC/NFD folding)", "Café", "café"],
    ["leaves an already-normalized dimension unchanged", "git", "git"],
    ["a whitespace-only string trims to empty", "   ", ""],
  ])("%s", (_name, raw, expected) => {
    expect(normalizeDimension(raw)).toBe(expected);
  });

  it.each([["a b"], [" a\tb "], ["one two three"], ["trailing\n internal"]])(
    "rejects internal whitespace (invalid, not a split): %j",
    (raw) => {
      expect(normalizeDimension(raw)).toBeUndefined();
    },
  );
});

describe("normalizeDimensions (dsl.md §3)", () => {
  it("normalizes, deduplicates after normalization, and sorts (the §2 example)", () => {
    // ["Git", " company ", "git"] -> ["company", "git"].
    expect(normalizeDimensions(["Git", " company ", "git"])).toEqual(["company", "git"]);
  });

  it("is order-independent: input order never changes the sorted result", () => {
    expect(normalizeDimensions(["git", "company"])).toEqual(["company", "git"]);
    expect(normalizeDimensions(["company", "git"])).toEqual(["company", "git"]);
  });

  it("sorts by UTF-16 code-unit order after lowercasing", () => {
    // Uppercase letters would sort before lowercase by code unit; normalization
    // lowercases first, so the ordering is over the lowercased forms.
    expect(normalizeDimensions(["B", "a", "A"])).toEqual(["a", "b"]);
  });

  it("returns undefined when any member has internal whitespace", () => {
    expect(normalizeDimensions(["ok", "not ok"])).toBeUndefined();
  });

  it("normalizes an empty list to an empty list", () => {
    expect(normalizeDimensions([])).toEqual([]);
  });
});

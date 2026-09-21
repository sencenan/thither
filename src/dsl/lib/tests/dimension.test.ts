import { describe, expect, it } from "vitest";
import { isValidDimension, normalizeDimension, normalizeDimensions } from "../dimension.ts";

describe("isValidDimension — the parser's validity gate (dsl.md §3)", () => {
  it.each([
    ["an ordinary dimension", "company"],
    ["mixed case", "Git"],
    ["surrounding whitespace only (trimmed away)", " company "],
    ["a diacritic", "café"],
    ["whitespace-only, which trims to empty", "   "],
  ])("accepts %s", (_name, raw) => {
    expect(isValidDimension(raw)).toBe(true);
  });

  it.each([["a b"], [" a\tb "], ["one two three"], ["trailing\n internal"]])(
    "rejects internal whitespace (invalid, not a split): %j",
    (raw) => {
      expect(isValidDimension(raw)).toBe(false);
    },
  );
});

describe("normalizeDimension — total transform, never fails (dsl.md §3)", () => {
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

  it("does not validate: it lowercases an internal-whitespace string rather than rejecting it", () => {
    // Validation is isValidDimension's job; normalization only transforms, so it
    // has no failure mode to return.
    expect(normalizeDimension(" A B ")).toBe("a b");
  });
});

describe("normalizeDimensions — canonical stored form, total (dsl.md §3)", () => {
  it("normalizes, deduplicates after normalization, and sorts (the §2 example)", () => {
    // ["Git", " company ", "git"] -> ["company", "git"].
    expect(normalizeDimensions(["Git", " company ", "git"])).toEqual(["company", "git"]);
  });

  it("is order-independent: input order never changes the sorted result", () => {
    expect(normalizeDimensions(["git", "company"])).toEqual(["company", "git"]);
    expect(normalizeDimensions(["company", "git"])).toEqual(["company", "git"]);
  });

  it("sorts by UTF-16 code-unit order after lowercasing", () => {
    expect(normalizeDimensions(["B", "a", "A"])).toEqual(["a", "b"]);
  });

  it("normalizes an empty list to an empty list", () => {
    expect(normalizeDimensions([])).toEqual([]);
  });
});

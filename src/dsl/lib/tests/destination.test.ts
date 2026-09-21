import { describe, expect, it } from "vitest";
import type { Template } from "../../types.ts";
import { countPlaceholders, validateDestination } from "../destination.ts";

// The accepted and rejected examples are lifted verbatim from dsl.md §2 "URL and
// template validation"; case names cite that section (docs/code-standards.md).
const accepted: readonly string[] = [
  "https://example.com/{}",
  "https://{}.example.com/{}",
  "file:///tmp/{}",
  "mailto:{}",
  "data:text/plain,{}",
  "myapp:open/{}",
  // Placeholder in the scheme: renders as thither://example.com.
  "{}://example.com",
  // A plain URL is a valid destination with zero placeholders (dsl.md §4.1).
  "https://example.com/path",
  "mailto:user@example.com",
];

const rejected: readonly string[] = [
  "example.com/path",
  "/path/{}",
  "//example.com/{}",
  "https://exa mple.com/{}",
  "example.com/{}",
  // A relative reference with no scheme is never inferred nor resolved.
  "/just/a/path",
  // Merely containing a colon is not sufficient (dsl.md §2).
  "not a url : with spaces",
  "",
];

describe("validateDestination — accepts dsl.md §2 destinations", () => {
  it.each(accepted)("accepts %j", (raw) => {
    expect(validateDestination(raw)).toBeDefined();
  });
});

describe("validateDestination — rejects dsl.md §2 non-destinations", () => {
  it.each(rejected)("rejects %j", (raw) => {
    expect(validateDestination(raw)).toBeUndefined();
  });
});

describe("validateDestination — placeholder in the scheme (dsl.md §2)", () => {
  it("accepts {}://example.com, which renders as thither://example.com", () => {
    expect(validateDestination("{}://example.com")).toBeDefined();
  });
});

describe("validateDestination — stores the original text byte-for-byte (dsl.md §2)", () => {
  it.each([
    "https://example.com/{}",
    "https://{}.example.com/{}",
    "{}://example.com",
    "data:text/plain,{}",
    "mailto:user@example.com",
  ])("returns %j unchanged, never the parser's normalized probe output", (raw) => {
    const stored = validateDestination(raw);
    expect(stored).toBe(raw);
  });
});

describe("countPlaceholders — the count P (dsl.md §2, §5 argDelta)", () => {
  it.each([
    ["https://example.com/path", 0],
    ["https://example.com/{}", 1],
    ["https://{}.example.com/{}", 2],
    ["{}://{}/{}", 3],
    // A lone brace is ordinary content, not a placeholder.
    ["https://example.com/{", 0],
    ["https://example.com/}", 0],
    // Adjacent placeholders do not overlap.
    ["https://example.com/{}{}", 2],
  ] as const)("counts %j as %i", (raw, expected) => {
    expect(countPlaceholders(raw as Template)).toBe(expected);
  });
});

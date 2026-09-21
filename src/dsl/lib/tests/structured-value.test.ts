import { describe, expect, it } from "vitest";
import { validateStructured } from "../structured-value.ts";

// Deep-freeze inputs so an accidental in-place mutation by the validator fails
// loudly here rather than silently corrupting a caller's persisted snapshot
// (docs/code-standards.md "Types").
function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object") {
    for (const member of Object.values(value)) {
      deepFreeze(member);
    }
    Object.freeze(value);
  }
  return value;
}

const isError = (result: unknown): boolean => Array.isArray(result) && result[0] === "E";
const isParseError = (result: unknown): boolean =>
  Array.isArray(result) &&
  result[0] === "E" &&
  (result[1] as { type?: unknown }).type === "parse_error";

describe("validateStructured — supplied S normalization (dsl.md §2, §3)", () => {
  it("normalizes dimensions and focus while preserving destination text and target order", () => {
    const input = deepFreeze([
      "S",
      {
        targets: [
          [["Git", " company "], "https://github.com/company/{}"],
          [["Docs"], "https://docs.example.com/"],
        ],
        focus: ["Personal", "personal"],
      },
    ]);
    expect(validateStructured(input)).toEqual([
      "S",
      {
        targets: [
          [["company", "git"], "https://github.com/company/{}"],
          [["docs"], "https://docs.example.com/"],
        ],
        focus: ["personal"],
      },
    ]);
  });

  it("drops unknown fields on S", () => {
    const input = deepFreeze(["S", { targets: [], focus: [], note: "ignore me" }]);
    expect(validateStructured(input)).toEqual(["S", { targets: [], focus: [] }]);
  });

  it("accepts the §7 empty state unchanged", () => {
    const input = deepFreeze(["S", { targets: [], focus: [] }]);
    expect(validateStructured(input)).toEqual(["S", { targets: [], focus: [] }]);
  });
});

describe("validateStructured — supplied S rejections all carry parse_error (dsl.md §6)", () => {
  it("rejects a duplicate normalized dimension set, even with differing destinations", () => {
    const input = deepFreeze([
      "S",
      {
        targets: [
          [["Git", " company ", "git"], "https://a.example.com/{}"],
          [["git", "company"], "https://b.example.com/{}"],
        ],
        focus: [],
      },
    ]);
    expect(isParseError(validateStructured(input))).toBe(true);
  });

  it("rejects a dimension with internal whitespace rather than splitting it", () => {
    const input = deepFreeze([
      "S",
      { targets: [[["com pany"], "https://x.example/{}"]], focus: [] },
    ]);
    expect(isParseError(validateStructured(input))).toBe(true);
  });

  it("rejects an invalid destination inside a supplied S (parse_error, not invalid_destination)", () => {
    const input = deepFreeze(["S", { targets: [[["ok"], "example.com/no-scheme"]], focus: [] }]);
    expect(isParseError(validateStructured(input))).toBe(true);
  });

  it.each([
    ["missing focus", ["S", { targets: [] }]],
    ["non-array targets", ["S", { targets: {}, focus: [] }]],
    ["a target that is not a pair", ["S", { targets: [["only-one-element"]], focus: [] }]],
    ["a non-string focus member", ["S", { targets: [], focus: [1] }]],
    ["a non-string destination", ["S", { targets: [[["ok"], 42]], focus: [] }]],
  ])("rejects %s", (_name, input) => {
    expect(isParseError(validateStructured(deepFreeze(input)))).toBe(true);
  });
});

describe("validateStructured — top-level shape (dsl.md §1)", () => {
  it.each([
    ["a standalone target t", [["company"], "https://x.example/{}"]],
    ["a standalone target set T", [[[["company"], "https://x.example/{}"]]]],
    ["a standalone match m", ["https://x.example/", ["d"], [], { argDelta: 0 }]],
    ["a bare literal array L", ["company", "git"]],
    ["a plain object, not an [sigil, body] value", { targets: [], focus: [] }],
    ["an unknown sigil", ["X", {}]],
    ["a null", null],
    ["a wrong-arity value", ["S", { targets: [], focus: [] }, "extra"]],
  ])("rejects %s to parse_error", (_name, input) => {
    expect(isParseError(validateStructured(input as unknown))).toBe(true);
  });
});

describe("validateStructured — supplied E (dsl.md §6 weaker rule)", () => {
  it("accepts any string type/description and preserves extra diagnostic fields", () => {
    const input = deepFreeze([
      "E",
      { type: "from_another_version", description: "boom", detail: { at: 3 }, code: 7 },
    ]);
    expect(validateStructured(input)).toEqual([
      "E",
      { type: "from_another_version", description: "boom", detail: { at: 3 }, code: 7 },
    ]);
  });

  it("does not check the supplied type against the generated vocabulary", () => {
    const input = deepFreeze(["E", { type: "totally-made-up", description: "ok" }]);
    expect(isError(validateStructured(input))).toBe(true);
    expect(isParseError(validateStructured(input))).toBe(false);
  });

  it.each([
    ["missing description", ["E", { type: "parse_error" }]],
    ["non-string type", ["E", { type: 1, description: "x" }]],
    ["non-object body", ["E", "boom"]],
  ])("rejects %s to parse_error", (_name, input) => {
    expect(isParseError(validateStructured(deepFreeze(input)))).toBe(true);
  });
});

describe("validateStructured — supplied R is shape-checked, not re-normalized (dsl.md §2, §5)", () => {
  it("keeps inputs verbatim (original spelling, never normalized) and passes matches through", () => {
    const input = deepFreeze([
      "R",
      {
        matches: [
          [
            "https://github.com/company/{}",
            ["company", "git"],
            [],
            { argDelta: -1, positions: [], score: 0 },
          ],
        ],
        inputs: ["Company", "Git"],
      },
    ]);
    expect(validateStructured(input)).toEqual([
      "R",
      {
        matches: [
          [
            "https://github.com/company/{}",
            ["company", "git"],
            [],
            { argDelta: -1, positions: [], score: 0 },
          ],
        ],
        inputs: ["Company", "Git"],
      },
    ]);
  });

  it("accepts a partially-rendered (post-substitution) destination without re-validating it", () => {
    const input = deepFreeze([
      "R",
      {
        matches: [["https://example.com/{}/tree/{}", ["d"], ["arg"], { argDelta: -1 }]],
        inputs: [],
      },
    ]);
    expect(isError(validateStructured(input))).toBe(false);
  });

  it("drops unknown fields on R", () => {
    const input = deepFreeze(["R", { matches: [], inputs: [], extra: true }]);
    expect(validateStructured(input)).toEqual(["R", { matches: [], inputs: [] }]);
  });

  it.each([
    ["non-array matches", ["R", { matches: {}, inputs: [] }]],
    ["a malformed match tuple", ["R", { matches: [["only", "two"]], inputs: [] }]],
    ["non-string inputs", ["R", { matches: [], inputs: [3] }]],
  ])("rejects %s to parse_error", (_name, input) => {
    expect(isParseError(validateStructured(deepFreeze(input)))).toBe(true);
  });
});

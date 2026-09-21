import { describe, expect, it } from "vitest";
import type { Dim, Operation, ProgramItem } from "../../types.ts";
import { parseToken } from "../token-parsing.ts";

// The default environment's operation set (dsl.md §2). Recognition is relative
// to whatever set is passed, so custom sets are exercised further down.
const DEFAULT_OPERATIONS: ReadonlySet<Operation> = new Set([".set", ".rm", ".@", ".$"]);

// Fixture constructors keep the branding cast in one place so the table reads as
// plain data. Branded values are ordinary strings at runtime.
const lit = (text: string): ProgramItem => ["lit", text as Dim];
const op = (name: string): ProgramItem => ["op", name];
const sep: ProgramItem = ["."];

interface Case {
  // Case names cite the dsl.md §2 rule they enforce (docs/code-standards.md).
  readonly name: string;
  readonly token: string;
  readonly expected: ProgramItem;
}

const cases: readonly Case[] = [
  {
    name: "§2 ordinary literal: retains exact spelling",
    token: "company",
    expected: lit("company"),
  },
  {
    name: "§2 ordinary literal: mixed case preserved during evaluation",
    token: "Git",
    expected: lit("Git"),
  },
  {
    name: "§2 separator: a dot inside a literal is ordinary content (node.js)",
    token: "node.js",
    expected: lit("node.js"),
  },
  {
    name: "§2 separator: a dot inside a host is ordinary content (example.com)",
    token: "example.com",
    expected: lit("example.com"),
  },
  {
    name: "§2 ordinary literal: a URL accumulates exactly like a dimension, no escaping",
    token: "https://example.com/{}",
    expected: lit("https://example.com/{}"),
  },
  {
    name: "§2 ordinary literal: a template placeholder in the scheme is content",
    token: "{}://example.com",
    expected: lit("{}://example.com"),
  },
  {
    name: "§2 separator: the standalone dot is the argument separator",
    token: ".",
    expected: sep,
  },
  {
    name: "§2 operation: .set recognized against the environment",
    token: ".set",
    expected: op(".set"),
  },
  {
    name: "§2 operation: .rm recognized against the environment",
    token: ".rm",
    expected: op(".rm"),
  },
  {
    name: "§2 operation: .@ recognized against the environment",
    token: ".@",
    expected: op(".@"),
  },
  {
    name: "§2 operation: .$ recognized against the environment",
    token: ".$",
    expected: op(".$"),
  },
  {
    name: "§2 escaping: ..rm -> literal .rm",
    token: "..rm",
    expected: lit(".rm"),
  },
  {
    name: "§2 escaping: ..set -> literal .set",
    token: "..set",
    expected: lit(".set"),
  },
  {
    name: "§2 escaping: ..@ -> literal .@",
    token: "..@",
    expected: lit(".@"),
  },
  {
    name: "§2 escaping: .. -> literal .",
    token: "..",
    expected: lit("."),
  },
  {
    name: "§2 escaping: strips exactly one dot and never re-interprets (... -> literal ..)",
    token: "...",
    expected: lit(".."),
  },
];

describe("parseToken — token forms (dsl.md §2)", () => {
  it.each(cases)("$name", ({ token, expected }) => {
    expect(parseToken(token, DEFAULT_OPERATIONS)).toEqual(expected);
  });
});

describe("parseToken — escaped .$ is a literal, not the terminating operation (dsl.md §2, lifecycle)", () => {
  it("parses ..$ to a ['lit', ...] whose sigil differs from the operation ['op', '.$']", () => {
    const item = parseToken("..$", DEFAULT_OPERATIONS);
    expect(item[0]).toBe("lit");
    expect(item).toEqual(lit(".$"));
    // The distinction the lifecycle's "last item is already the operation .$"
    // test (ticket 09) relies on: an escaped ..$ carries a different sigil.
    expect(item[0]).not.toBe("op");
  });
});

describe("parseToken — operation recognition is environment-relative (dsl.md §2, ADR-0005)", () => {
  it("parses an unbound dot-token to a parse_error E under the default environment", () => {
    const item = parseToken(".foo", DEFAULT_OPERATIONS);
    expect(item[0]).toBe("E");
    expect(item).toMatchObject(["E", { type: "parse_error" }]);
  });

  it("parses .set to a parse_error when the environment binds no operations", () => {
    const item = parseToken(".set", new Set<Operation>());
    expect(item[0]).toBe("E");
    expect(item).toMatchObject(["E", { type: "parse_error" }]);
  });

  it("recognizes a client-registered operation the default set lacks", () => {
    const extended: ReadonlySet<Operation> = new Set([...DEFAULT_OPERATIONS, ".goto"]);
    expect(parseToken(".goto", extended)).toEqual(op(".goto"));
  });
});

describe("parseToken — negative dot-prefixed forms (dsl.md §2)", () => {
  it.each([".x", ".SET", ".Set", ".@focus", ".$$", ".123"])(
    "parses the unrecognized dot-token %s to a parse_error E",
    (token) => {
      const item = parseToken(token, DEFAULT_OPERATIONS);
      expect(item[0]).toBe("E");
      expect(item).toMatchObject(["E", { type: "parse_error" }]);
    },
  );
});

describe("parseToken — parsing is total (dsl.md §2 'parse failures are values')", () => {
  const arbitrary = [
    "",
    " ",
    "a",
    "a.b.c",
    "https://exa mple.com/{}",
    "…",
    "..",
    "...",
    ".",
    ".set",
    "..set",
    ".unknown",
    "🚀",
    "{}",
  ];

  it.each(arbitrary)("never throws on %j", (token) => {
    expect(() => parseToken(token, DEFAULT_OPERATIONS)).not.toThrow();
  });

  it("maps a non-dot token with internal spaces to an ordinary literal, verbatim", () => {
    // The host splits on \s so this token should not arise, but parsing must
    // still be total: an odd input becomes a literal, never a throw.
    expect(parseToken("https://exa mple.com/{}", DEFAULT_OPERATIONS)).toEqual(
      lit("https://exa mple.com/{}"),
    );
  });
});

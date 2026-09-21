# Parse string tokens into values

Type: task
Status: resolved
Blocked by: 04

## Question

Implement and test the string-token half of `append(program, item)` per `dsl.md` §2. (`parse` was renamed `append` and the interpreter is env-bound — see ticket 04's answer and [ADR 0005](../../../docs/adr/0005-extensible-interpreter-environment.md).)

Rules in scope:

- One item per call; the core never tokenizes a multi-item string.
- Operations are recognized by name against the interpreter **environment**, not a hardcoded set. The default env binds `.set`, `.rm`, `.@`, `.$`; a recognized operation becomes `["op", name]`.
- The standalone `.` separator, and only standalone: a dot inside `node.js` or `example.com` is ordinary content.
- Double-dot escaping: `..rm` → literal `.rm`, `..set`, `..$`, and `..` → literal `.`. Escaped tokens are not re-interpreted as operations.
- An unescaped dot-prefixed token the environment does not bind parses to `E` (`parse_error`).
- Everything else is an ordinary literal retaining exact spelling.
- Parsing is total: never throw, never reject the whole program.

Note that `..$` must not satisfy the lifecycle's "last item is already the operation `.$`" test — that check belongs to the evaluator (ticket 09), but the value it inspects is produced here, so make the distinction representable.

Tests are table-driven fixtures citing `dsl.md` §2 subsections, per the map's test convention.

**Done when** every token form above has fixtures, including the negative cases, and `parse` is proven total over arbitrary strings.

## Answer

Implemented `parseToken(token, operations)` in `src/dsl/lib/token-parsing.ts` — the string-token half of `append`. Pure and total; it takes the token and the environment's recognized operation names (`ReadonlySet<Operation>`, i.e. `env.symbols`' keys) and returns a `ProgramItem`. It imports only `../types.ts` (type-only), so it stays a DOM-free leaf and the `token-parsing` seam collides with nothing in tickets 06/08.

**Decision order** (first match wins), which is what makes the rules total and unambiguous:

1. `token === "."` → `["."]` — the separator is *only* the standalone dot.
2. `token.startsWith("..")` → `["lit", token.slice(1)]` — strip exactly one leading dot; the remainder is a literal and is **never** re-interpreted. So `..rm`→`.rm`, `..set`→`.set`, `..@`→`.@`, `..`→`.`, and `...`→`..`.
3. `token.startsWith(".")` (single leading dot) → `["op", token]` iff `operations.has(token)`, else a `parse_error` `E`.
4. otherwise → `["lit", token]`, so `node.js`, `example.com`, `{}://example.com`, and any URL/template accumulate verbatim like a dimension.

**The `..$` / `.$` distinction is representable and enforced by sigil.** An escaped `..$` parses to `["lit", ".$"]`, a *different position-0 sigil* from the operation `["op", ".$"]`. The evaluator's lifecycle check (ticket 09) inspects the sigil, so the literal never satisfies "last item is already the operation `.$`". A test asserts `item[0] === "lit"` for `..$`.

**Env-relative recognition (ADR-0005).** `.set` under an empty operation set parses to `E`; a client-registered `.goto` parses to `["op", ".goto"]`. Recognition is nothing but membership in the passed set.

**Two seam notes for downstream tickets:**

- *Literals are minted as `Dim` here* (`token as Dim`), the raw stack-side brand — spelling preserved, space-free by construction since the host splits on `\s`. This module deliberately does **not** run destination validation; classifying a literal as a `Url`/`Template` is ticket 06's job, reached only when an operation consumes `L`. A `Dim` is a `Literal`, so this typechecks and matches the §1 rule that URLs accumulate exactly like dimensions.
- *Parse errors are constructed locally* as `["E", { type: "parse_error", description }]`, not via ticket 09's error/unwind primitives. Parse errors are a parse-time value; 09's `errors` module owns *evaluation-time* construction and unwind. No dependency on the unbuilt 09.

Tests: `src/dsl/lib/tests/token-parsing.test.ts` — a table of every token form citing `dsl.md §2`, the `..$`-vs-`.$` sigil case, env-relative recognition (default / empty / extended), negative dot-tokens (`.x`, `.SET`, `.@focus`, …), and a totality suite proving `parseToken` never throws over arbitrary strings (empty, whitespace, emoji, spaced URL). Full `pnpm run verify` green (44 tests, boundaries clean, single-file build). No new tickets surfaced; 05 unblocks 09 jointly with 07.

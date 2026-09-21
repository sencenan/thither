# Validate URLs and destination templates

Type: task
Status: resolved
Blocked by: 04

## Question

Implement and test destination validation per `dsl.md` §2 "URL and template validation".

Rules in scope:

- Render-then-parse: replace every `{}` with the probe token `thither`, validate the rendered string with the WHATWG `URL` parser, and accept when it parses and has an explicit scheme.
- Store and later substitute into the **original** template text, never the parser's normalized output of the probe.
- No scheme allowlist; a scheme does not require `//` (`mailto:user@example.com`, `myapp:open/{}` are valid). Never infer a scheme or resolve against a base URL.
- Placeholders allowed in any position, including the scheme: `{}://example.com` renders as `thither://example.com` and is accepted.
- Rejected: `https://exa mple.com/{}`, `example.com/{}`, `/path/{}`, `//example.com/{}`.
- Placeholder counting for `P` in `argDelta`, if this module owns it per ticket 04's seam map.

This validator is used in two places with different error paths — `.set`'s operand (an evaluation error, `invalid_destination`) and destinations inside a supplied `S` (a parse-time `E`) — so it must be callable without deciding which.

**Done when** the accepted and rejected examples in `dsl.md` are fixtures, plus placeholder-in-scheme and the round-trip guarantee that the stored text is byte-identical to the input.

## Answer

Implemented `src/dsl/lib/destination.ts`, the `destination` seam from ticket 04. Two pure exports, importing only `../types.ts` (a DOM-free leaf; boundaries clean):

- `validateDestination(raw: string): Template | undefined` - render-then-parse per dsl.md §2: replace every `{}` with the probe `thither`, then `new URL(rendered)`. On success it returns the **byte-identical original** branded `Template`; on `URL` throwing it returns `undefined`. It constructs **no** `E`, so the two call sites pick their own error path (`.set` operand -> evaluation `invalid_destination`; supplied `S` destination -> parse-time `E`).
- `countPlaceholders(template: Template): number` - the count `P` for argument balance (dsl.md §5 `argDelta`, ticket 12), a split-count exact because the two-char token cannot overlap.

**Why `new URL` alone is the whole check.** The single-argument WHATWG constructor accepts only an absolute URL with an explicit scheme and rejects a relative reference, so a successful parse *is* dsl.md §2's "parses and has an explicit scheme" - no separate scheme test, no base URL, no scheme inference. Verified against every dsl.md accept/reject example (including `{}://example.com` -> `thither://example.com` accepted, and the space/`//`/no-scheme rejects).

**Decision to review - how the core gets the `URL` type.** The core's tsconfig omits the DOM lib (ADR-0001, code-standards) so `localStorage`/`document`/`window` are type errors; that also drops `URL`, which isn't in `lib.es2022`. But the WHATWG `URL` is a *universal* platform global (browser, Node, workers), not a client-only API, and dsl.md §2 mandates it by name - so using it does not breach the client-agnostic core. Rather than widen the core's lib (which would also re-admit the client-only globals), I added a **module-scoped** `declare const URL: { new (url: string): unknown }` in `destination.ts`. Being module-local it shadows nothing and does not collide with the repo-wide DOM pass, and the DOM-free guarantee is untouched (`document`/`window`/`localStorage` still error in the core). Recorded this as a standing rule in `docs/code-standards.md` (the DOM-free-core paragraph): the core may use universal platform globals, re-supplied via a module-scoped `declare const`, never by widening the core's `lib`; `destination.ts`'s `declare const URL` is the reference example.

Tests: `src/dsl/lib/tests/destination.test.ts` - the dsl.md §2 accept/reject tables verbatim, placeholder-in-scheme, the byte-identical round-trip (`toBe(raw)`, not just `toEqual`), and a `countPlaceholders` table (0/1/2/3, lone braces, adjacent placeholders). Full `pnpm run verify` green (74 tests). Unblocks 07 (with 04) and feeds 10/12.

# S1 checkpoint: the core is correct

Type: grilling
Status: resolved
Blocked by: 14

## Question

Human review of the complete language core before any client code exists. This is the most load-bearing checkpoint in the map: everything downstream assumes the core is right, and `browser-client.md` deliberately leaves the client with no validation of its own.

Walk the human through:

- the public API as built, against `browser-client.md`'s four symbols;
- the type model as it actually ended up, against ticket 04's design, naming any drift and why;
- the `fzf` configuration chosen, and what it means for ranking in practice;
- the conformance suite read against `dsl.md` section by section, naming any normative rule with no fixture behind it.

Then exercise the core live against realistic programs the human supplies — their own dimensions and destinations, not spec examples — and have them judge whether match ordering and prefix inference feel right in use. Disagreement here is a specification question, not a bug: surface it as a doc amendment or a new ADR rather than patching the code around it.

**Done when** the human signs off the core, or the corrections are ticketed and resolved first.

## Answer

**Signed off.** The human reviewed the public API, the type model, the matcher configuration, and the conformance suite against `dsl.md`, then exercised the core live in a terminal REPL built for the purpose (`pnpm repl`, `scripts/repl.ts`). Every disagreement surfaced was settled as a specification decision, and each decision landed as code + fixture + doc text in the same change. Merged to `main` as `55be66b` (squash) plus the follow-up commit that closes this ticket. Tests 123 → 217.

### Walkthrough findings and their resolutions

| # | Finding | Decision | Landed as |
|---|---|---|---|
| 1 | `.$` rendered `..git` as `..git`; §2 says `.git`. No fixture covered escape resolution in `.$` at all. | Resolve on render; `m.args` reports `.git`, `R.inputs` keeps `..git`. | `search.ts` `toMatch`; 3 fixtures; `dsl.md` §5 sentence |
| 2 | `.set` fuzzy-matches supersets: `company https://… .set` rewrites `[company, git]` or is `ambiguous_set` with two supersets; a subset dimension set can never be inserted. | Keep §4.1 as written. | 2 pinning fixtures in `set.test.ts` |
| 3 | `.rm` removes every fuzzy match (`c .rm` is broad). | Keep; history is recovery. | — |
| 4 | `execute` mutated the caller's program by appending `.$`. | Copy internally. | `interpreter.ts`; unit fixture + barrel golden; `browser-client.md` |
| 5 | String tokens with whitespace / empty text parsed as literals. | `parse_error`. | `parser.ts` `isDim` gate; 3 unit fixtures + barrel golden; `dsl.md` §2 |
| 6 | `isTemplate` uses `URL.parse()` (2024 API). | Keep; record floor. | `browser-client.md`: **Baseline 2024** |
| 7 | One-joined-pattern matching (ticket 12) meant `m ppl` could not select `[apple, mango]`, and `pple m` silently took `m` as an argument. The human wants fzf-CLI behaviour. | **Adopt fzf extended search** and make its operators part of the language. | see below |

### Matching redesign (supersedes ticket 12's "one-pattern matching")

- `selector.ts` binds `match: extendedMatch`. The query is `[...focus, ...explicit]` in typed order, original case, no dedupe — an fzf query, joined with spaces. Every term must match; score is the sum, positions the union (joining spaces never appear). `m ppl`, `pple m`, and `am` all select `[apple, mango]`.
- **Operators are language**: `|` OR, `!` NOT, `'` exact, `^`/`$` anchors (`dsl.md` §2 "Search operators", `CONTEXT.md` **Search operator**). They are legal in `.$` and `.rm` queries only.
- **Stored dimensions are plain text.** `.set` and `.@` refuse an operator term with the new **`invalid_dimension`** error (§6). A supplied `S` carrying one as a target or focus dimension is `parse_error`. Rationale: a NOT/anchored term never matches its own stored text, so `.set` would insert duplicate dimension sets and corrupt the persisted `S`.
- **Operator-only tokens** (`!`, `'`, `^`, `^$`) are `parse_error` at parse: fzf drops them silently, which would have made `! .rm` remove every target.
- **Casing is fzf smart-case**, by explicit choice: an uppercase letter is a deliberate request for case-sensitive matching, and stored dimensions are lowercase, so `Git` matches nothing. Under §4.4 prefix inference, `company Git MyRepo` therefore stops at `company` and takes `Git` as the argument — seen live and accepted. §7's golden becomes `company git MyRepo`.
- **`.set` still matches on the normalized combined dimensions** — the exact set it would store — so smart-case cannot produce a duplicate.
- Why not compose AND over `basicMatch` (ticket 08's shape)? Tried and reverted: the human preferred using the library's own mode and adopting its syntax over neutralising it. The library offers no escape for operator characters (`parseTerms` handles only `\ `), so "operators as language" and "operators inert" were the only two coherent options.
- `src/dsl/tests/operators.test.ts`: a 60-case matrix through the public barrel — every operator × `.$` (selects), `.rm` (removes exactly those), `.set`/`.@` (`invalid_dimension`), supplied `S` target/focus (`parse_error`), plus operator-only tokens and the bare-`$`-is-text case.

### Tooling that came out of the review

- **`pnpm repl`** (`scripts/repl.ts`): runs the real `src/dsl/index.ts` under Node 24 with no build, mimics the client loop in memory (`:seed`, `:state`, `:stack`, `:load`, `:undo`, `:reset`), highlights `hint.positions` in the searchable string, and tags a lone complete match `← navigate`. It marks `⤷ .$` on the input and on the `inputs` line whenever the result came from the interpreter's appended terminal, because `execute` is specified over complete programs (§1 lifecycle step 2) and a REPL line is often a fragment.
- `scripts/tsconfig.json` (`types: ["node"]`, no DOM) and a third `typecheck` pass; `@types/node 24.13.6` pinned. It caught a real type error in the REPL that Node's type stripping had let through.
- Every relative import in `src/dsl` and `src/lib` now carries its `.ts` extension, as `code-standards.md` already required — Node's ESM loader needs it, and Vite/Vitest/tsc were already fine with it (verified by a throwaway build importing the core: single 20.6 kB `index.html`, nothing external).
- `pnpm install --force` relinked `node_modules` from the repo-local store (the ticket-03 decision, now actually applied); `pnpm-workspace.yaml` gains `esbuild: false` under `allowBuilds` (its binary is an optional dep, the script was already skipped).

### Handed to ticket 16 (client design)

- **Mutations that end in a lone complete match auto-navigate.** `.set`/`.rm`/`.@` get the implicit `.$` appended; with empty focus that lists every target, and when exactly one complete target remains the client's rule (one match, `argDelta ≥ 0`) fires — `home https://example.com/ .set` on an empty state would set *and navigate*. Recommended: the client never auto-navigates when the persisted stack changed (it already computes that for history). Core and `dsl.md` unchanged.
- Corrupted-record detection (from ticket 14) still stands.

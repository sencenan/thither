# Map: Thither v1 implementation

Label: `wayfinder:map`
Tickets: `.scratch/thither-v1/issues/`

## Destination

A deployed, self-contained `index.html` on GitHub Pages that implements everything specified in [docs/dsl.md](../../docs/dsl.md) and [docs/browser-client.md](../../docs/browser-client.md), backed by a spec-derived Vitest conformance suite, and driven from a real browser search shortcut.

Done when: the language core passes conformance tests traceable to every normative rule in `dsl.md`; the client implements the full execution flow, versioned persistence, bounded history, and fallback UI of `browser-client.md`; the build emits only `index.html`; the page is live on Pages; and the shortcut has been hand-verified against the checklist.

## Notes

**This map carries execution.** Wayfinder's plan-only default is overridden: build tickets here produce working code, not just decisions. The specs are already `Status: agreed`, so the remaining unknowns are implementation-shaped.

**Domain and sources.** [CONTEXT.md](../../CONTEXT.md) is the glossary — use its terms (dimension, target, destination template, focus, match, argument balance) in ticket titles, test names, and identifiers, and avoid the terms it lists under `_Avoid_`. `docs/dsl.md` and `docs/browser-client.md` are normative. ADR-0001 (localStorage only), ADR-0002 (single-file on Pages), and ADR-0003 (resume from last stack value) bind implementation choices. If a ticket's outcome contradicts a spec or ADR, say so explicitly and amend the doc or write a new ADR — never let the code silently drift from the spec.

**Skills each session should consult.** `grilling` + `domain-modeling` for any decision ticket; `codebase-design` for the interface-design tickets (04, 16); `tdd` for every build ticket; `prototype` for UI shape questions.

**Standing decisions from charting** (these are settled; don't reopen them as tickets):

- **Stage spine.** S0 Scaffold → S1 Core → S2 Walking skeleton → S3 Single-file bundle and live on Pages → S4 Full persistence → S5 Full UI → S6 Cross-browser verification and release. Deployment lands early, at S3, because ADR-0002's single-file constraint and the `%s` shortcut contract are only truly testable on a deployed page.
- **Every stage ends with a HITL checkpoint ticket** that blocks the next stage. Checkpoints exist especially where a new interface was designed.
- **Test convention.** Table-driven fixture suites whose cases name the `dsl.md` section they enforce (e.g. `§4.4 inferred separator: longest matching prefix`), plus the worked programs of `dsl.md` §7 as golden end-to-end cases. No separate traceability matrix — it would rot.
- **Types before tests.** The core's TypeScript value model is designed and written down (ticket 04) before the first core test is written.
- **Scheme policy is closed.** No client-side scheme allowlist and no scheme-based confirmation, exactly as `browser-client.md` documents. Thither is a power-user tool whose users author their own targets; `javascript:` destinations are accepted. Not revisited at S3.

**Ticket protocol.** One ticket per session. Set `Status: claimed` before any work. Resolve by appending an `## Answer` section, setting `Status: resolved`, and adding a one-line gist to Decisions so far below.

## Decisions so far

<!-- one line per resolved ticket: gist + link -->

- [Code principles and style rules](issues/01-code-principles-and-style-rules.md): Biome (2 spaces, width 100) for format and lint, strict tsc without `erasableSyntaxOnly` so enums stay, `type`/`interface` over classes, `src/dsl` + `src/lib` + `src/client` with a DOM-free tsconfig for the core and dependency-cruiser holding the import direction, values-not-exceptions in the core behind one `invariant()`, `readonly` plus test-only deep freeze, tests in `tests/` subfolders citing spec sections, `ticket/NN-slug` branches merged `--no-ff`. Written to [docs/code-standards.md](../../docs/code-standards.md).

## Not yet specified

These are in scope and documented in `browser-client.md`, but not yet sharp enough to ticket: each depends on interfaces designed by an earlier stage's design ticket. They graduate into tickets when the preceding checkpoint resolves.

- **S4 — Full persistence.** Graduates after **S2 checkpoint: the skeleton is usable**. Covers the `thither.stacks.v1` and `thither.settings.v1` records, bounded history with the structural-difference rule and eviction, Web Locks serialization of read→execute→save, quota-exceeded fallback, and the malformed-data / localStorage-unavailable error states. Ticket boundaries depend on the storage interfaces drawn in **Design the client architecture and its seams**.
- **S5 — Full fallback UI and settings.** Graduates after the S4 checkpoint. Covers the 200 ms debounced live execution, highlight rendering from `hint.positions`, the `1`–`9`/`0` shortcuts, empty-target-set setup instructions, and the settings modal (history browse and restore, manual reset through `parse`, history-limit config). Expected to open with a `prototype` ticket on layout and highlight presentation.
- **S6 — Cross-browser verification and release.** Graduates after the S5 checkpoint. Covers authoring `docs/search-shortcut-checklist.md` (referenced by `browser-client.md`, currently a dangling link) and running it across browsers to verify `%s` substitution of `#`, `&`, and `+`.

## Out of scope

Ruled beyond this destination. These return only if the destination is redrawn, as a fresh effort.

- **Any client other than the browser page** — CLI, local-file adapter (ADR-0001, `browser-client.md` scope).
- **Remote or shared state, authentication, synchronization, server-side interpreter** (ADR-0001, ADR-0002); see [the state-storage research](../../docs/research/online-state-storage.md).
- **An OpenSearch description document** — conflicts with the single-file artifact and still ends in a browser prompt (`browser-client.md`).
- **Score parity with current upstream fzf** — the npm port is a pinned ordinary dependency; Thither tests its own expected behaviour (`browser-client.md`, [fzf research](../../docs/research/fzf-libraries.md)).
- **Scheme allowlisting or confirmation gates** for navigation or for `.set`/`.rm`/`.@` arriving by URL — deliberate policy, closed during charting.

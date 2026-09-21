# Design the core type model and its seams

Type: grilling
Status: resolved
Blocked by: 02

## Question

Define the TypeScript types for every value in `dsl.md` §1, and the module decomposition of the core, **before the first core test is written**.

Types to pin down: `u` URL, `p` destination template, `d` dimension, `L` accumulated literal array, `t` target, `T` target set, `S` state, `m` match, `M` match set, `R` result, `E` error, plus `Program` and the data `Stack`. Key questions:

- How is the wire format (`["S", {...}]`, `["R", {...}]`, `["E", {...}]`, `[[d], p]`, `[u, [d], [args], hint]`) related to the in-memory representation: same shape, or parsed into something friendlier with a serialization boundary? `browser-client.md` persists these as JSON and ADR-0003 has the client treat them as opaque, so the wire shape is fixed regardless.
- Which distinctions are enforced in the type system (branded `Dimension` for normalized-lowercase-trimmed? `NormalizedDimension` vs raw literal? URL vs template?) and which are runtime-validated only. `dsl.md` repeatedly distinguishes *original spelling* from *lowercase matching copies*; losing that distinction in the types is how those rules get violated.
- How `t`, `T`, `m`, and `M` are prevented from appearing as standalone program values, given `dsl.md` §1 says such input parses to `E`.
- How unknown object fields are preserved (`dsl.md` §2) without acquiring semantics.
- Readonly/immutability representation, per the stance taken in ticket 01.

The layout is already fixed by [docs/code-standards.md](../../../docs/code-standards.md) — `src/dsl/index.ts` is the single entry point exporting the four specified symbols, `lib/` is implementation, `tests/` holds tests, and the DOM is unavailable in this area. This ticket decides which modules exist behind that entry point, not where the directories go.

Module seams to draw, with the public surface being exactly `emptyProgram`, `parse`, `execute`, `initialStack`: token parsing, structured-value validation and normalization, destination validation, the fzf adapter, query construction and matching, the evaluator loop, the operations, template rendering, match ordering, error construction and unwinding. For each, name its responsibility and what it does **not** know. Consult `codebase-design`; aim for deep modules with narrow interfaces, and note explicitly which seams let tickets 05–13 proceed in parallel sessions without colliding.

**Done when** the types are committed as real TypeScript (not prose), the module map is recorded on this ticket, and the ownership of each `dsl.md` rule area is unambiguous.

## Answer

Committed as real TypeScript in `src/dsl/types.ts` (the single home of the type algebra) with the public surface wired in `src/dsl/index.ts`.

### Type model

- **Dimensions are positional, not tracked per-value.** `Dim` (raw, stack-side, spelling preserved) and `NormDim` (normalized, state-side) are both branded via `unique symbol`, so the stack→state crossing cannot be made without the normalization seam.
- **Destinations:** `Template` (`p`) and `Url` (`u`) branded, with `Url` a **subtype** of `Template` so "a `u` is accepted wherever a `p` is required" is a compiler fact.
- **`t`/`T` can't stand alone** structurally: `Target`/`TargetSet` appear only inside `State`, never in the program- or stack-value union.
- **Envelopes are wire-shaped** (`["S"|"R"|"E", body]`): in-memory === persisted JSON, no serialization seam. `State`/`Result` payloads inlined.
- **Unknown-field preservation narrowed to `E` only** (`Extra` helper); `dsl.md` §2 amended so supplied `S`/`R` drop unknown fields — the types now mean what the spec says.
- **`Program` is one flat union of `["sigil", body]` tuples**, discriminated on element 0 (`"S"|"R"|"E"|"lit"|"."|"op"`). A literal is tagged (`["lit", Literal]`) because escaping (`..set` → literal `.set`) collides its text with an operation.
- **`ErrorType`** closed vocabulary added; `ThitherError.type` stays `string` (supplied `E`s may carry any type).

### Interface redesign — [ADR 0005](../../../docs/adr/0005-extensible-interpreter-environment.md)

The operation set is a **client-extensible environment**, not four hardcoded operations. `defaultEnv()` → `createInterpreter(env)` → an interpreter exposing `emptyProgram`, `initialStack`, `append`, `execute`. Consequences pinned down through grilling:

- Operations are `OperationFn = (stack: Stack) => Stack`, **mutating the stack in place** (code-standards carve-out: container mutable, values `readonly`); no injected deps — fzf is imported, not faked.
- The evaluator **dispatches operations by name via `env.symbols`**, so it never imports an operation module — this is the extensibility seam and the parallelism seam at once.
- `append` is env-aware, so "unrecognized operation → `E`" is now relative to the env (`dsl.md` §2 amended). Free `initialStack()` dropped; the seed empty state moved onto the interpreter.
- Operation sigil rides in slot 1 (`["op", Operation]`) so slot 0 stays a closed literal set despite the open operation set. `Sigil` is prose-only for slot-0 tags; the operation-identifier type is `Operation` (open) with `BuiltinOperation` its closed default subset.

Amended `browser-client.md` (Core interface + flow), `dsl.md` §2, and `code-standards.md` (entry-point surface, mutable-`Stack` carve-out, sigil-tuple discrimination rule).

### Module / seam map

All internal modules under `src/dsl/lib/`; `types.ts` is the shared vocabulary; `index.ts` is the only barrel.

| Module | Owner | Responsibility | Does not know |
| --- | --- | --- | --- |
| `token-parsing` | 05 | string token → `ProgramItem`; operation recognition via env | stack, evaluation, objects, matching |
| `destination` | 06 | render-then-parse a URL/template; owns placeholder count `P` | caller, error path, stack |
| `normalization` | 07 (own file) | raw strings → sorted/deduped `NormDim[]`; `NormDim` minting | envelopes, matching, stack |
| `structured-value` | 07 | supplied `S`/`R`/`E` object → `Envelope` or `E`; uses `destination` + `normalization` | tokens, evaluation, matching |
| `matcher` | 08 | query+focus+targets → selected targets with `{score, positions}` | operations, boundary inference, rendering |
| `rendering`+`ordering` | 12 | fill `{}` / `argDelta`, emit `M` in one total order | matching, stack, navigation eligibility |
| `errors` primitives | 09 | `E` constructor + `unwind(stack)` | specific operation logic |
| ops `mutating` | 10 | `.set`/`.rm`/`.@` `OperationFn`s | parsing, lifecycle, dispatch |
| ops `search` | 11 | `.$` boundary inference, `R.inputs` | parsing, lifecycle, `.set`/`.rm` |
| `evaluator` | 09 | `execute` loop: accumulation, push/terminal, `.$` lifecycle, dispatch by name | what any operation does |
| `index.ts` | 14 | `defaultEnv`, `createInterpreter` assembly | rule details |

**Parallel waves:** after 04 → `05`/`06`/`08` concurrent (disjoint leaves); then `07`→`09`; after 09 → `10`/`11` concurrent; then `12`/`13` concurrent.

### Re-wires this session made

- **Error/unwind primitives moved to ticket 09** (were mis-scheduled after 10/11 in ticket 13, but the operations fail *through* them). Ticket 13 reframed as the verification ticket.
- **Tickets 05, 09, 13, 14 updated** for `append`/env-aware recognition/mutable stack/`createInterpreter` surface.
- `ErrorType` added to `types.ts`; `normalization` pinned as its own file so 10/11 import it without the rest of 07.

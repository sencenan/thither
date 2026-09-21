# Design the core type model and its seams

Type: grilling
Status: open
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

# Code principles and style rules

Type: grilling
Status: resolved
Blocked by: —

## Question

What coding principles, style, and formatting rules bind every subsequent ticket in this map, and where are they written down so an agent session reads them without being told?

Settle at least:

- **Formatting**: Prettier or not; config values (semicolons, quotes, width, trailing commas); whether formatting is enforced at commit time (the repo has a `setup-pre-commit` skill available) or only in CI.
- **Linting and type strictness**: ESLint or `tsc` alone; `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `erasableSyntaxOnly`; whether `any` and type assertions are banned outright (note the `migrate-to-shoehorn` skill exists for test data).
- **Module and file conventions**: named vs default exports, one-concept-per-file, file naming, import ordering, barrel files, where types live relative to the code that uses them.
- **Error handling stance in the core**: `dsl.md` says parsing is total and failures are `E` values — decide whether throwing is banned outright in core code, and what happens on a genuine invariant violation.
- **Immutability**: the program is specified as an immutable ordered list and persisted snapshots must never be mutated. Decide whether this is enforced by convention, by `readonly` types, or by structural copying.
- **Comments and naming**: when a comment earns its place; the rule that identifiers use `CONTEXT.md` vocabulary.
- **Commit and branch policy** for this effort: branch per ticket or straight to main, commit message shape, whether a ticket's resolution and its code land in the same commit.

Consult `codebase-design` for the module-shape vocabulary and `writing-for-agents` for the document itself: it is read by agents, so it must be prescriptive and short, not an essay.

**Done when** the rules are captured in a committed document (proposed: `docs/code-standards.md`, linked from `AGENTS.md` so every session picks it up), and every rule that a tool can enforce is marked as such for the scaffold ticket to wire up.

## Answer

The rules live in [docs/code-standards.md](../../../docs/code-standards.md), pointed at from `AGENTS.md` under "Writing code". Decisions taken:

**Tooling.** Biome for both formatting and linting, at `indentWidth: 2` and `lineWidth: 100`, with `recommended: true` plus `noExplicitAny`, `noNonNullAssertion`, and `noDefaultExport` promoted to errors, and organize-imports folded into `biome check`. No Prettier and no ESLint. Enforced at commit (Husky + lint-staged, via the `setup-pre-commit` skill) and in CI. Latest Biome at decision time was 2.5.14.

**Types.** `strict` plus `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noUnusedLocals`, `noUnusedParameters`, `verbatimModuleSyntax`, `isolatedModules`, `module: "preserve"`, `target: "ES2022"`. `noUncheckedIndexedAccess` is kept despite its friction precisely because `dsl.md` is written in terms of "the last literal" and "the longest prefix". `erasableSyntaxOnly` is **rejected**: enums stay available, `const enum` included. Only the ambient `declare const enum` is excluded, which is the form `isolatedModules` genuinely errors on. (An earlier draft of this answer banned `const enum` outright on the claim that `isolatedModules` breaks it; that was wrong. esbuild supports the syntax, and the real consequences are the ambient-declaration error plus the loss of cross-file inlining.) Data is modelled with `type` and `interface`; classes are not used. `unknown`-and-narrow at every input edge; `as` avoided outside `as const` and shoehorn.

**Layout and seams.** `src/dsl` (language core), `src/lib` (client-agnostic utilities), `src/client` (browser client). Imports flow `client → dsl`, `client → lib`, `dsl → lib`. Root files are the public surface, `lib/` is implementation, `tests/` holds tests. **`src/dsl` has exactly one entry point, `index.ts`**, exporting exactly the four symbols `browser-client.md` names, so the code's surface and the spec's "core interface" stay the same list and adding an export is a spec change. It is the repo's only barrel. File names kebab-case. Two enforcement layers: dependency-cruiser for direction and entry-point-only imports, and a `src/dsl` tsconfig that **omits the `DOM` lib**, so ADR-0001's client-agnostic core is a compile error to violate rather than a convention to remember. `src/lib` keeps DOM types available.

**Failure.** `src/dsl` answers with values, never exceptions: spec failures are `E` per `dsl.md` §6. The single sanctioned throw site is an `invariant()` helper for unreachable states, so the totality guarantee stays greppable and ticket 14's property test means what it says.

**Immutability.** `readonly` and `ReadonlyArray` in core types, new values rather than mutated arguments, and deep-frozen fixtures in tests. No runtime freezing in production — it would permanently freeze every stored stack value for no gain the spec asks for.

**Tests.** Vitest in each module's `tests/` subfolder, importing through root files. Table-driven fixtures whose case names cite the `dsl.md` section they enforce; `dsl.md` §7's worked programs as golden end-to-end cases.

**Comments and naming.** Each `src/dsl` module heads with the spec section it implements; comments carry the why. Identifiers use `CONTEXT.md` vocabulary and avoid its `_Avoid_` synonyms.

**Commits.** Branch `ticket/NN-slug` per ticket, merged with `--no-ff`. A ticket's code, its `## Answer`, and its Decisions-so-far line land in one commit.

**Terminology note.** The specs call `src/dsl` "the language core" and `CONTEXT.md` defines no term for it. The prose term is unchanged; `docs/code-standards.md` states the folder mapping instead, so three specs did not need rewording.

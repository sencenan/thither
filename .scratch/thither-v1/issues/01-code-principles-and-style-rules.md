# Code principles and style rules

Type: grilling
Status: open
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

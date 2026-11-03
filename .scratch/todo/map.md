# Map: Todo list

Label: `wayfinder:map`
Tickets: `.scratch/todo/issues/`

## Destination

The state of the world holds a **todo list** of bare URLs. `.todo` adds to it or shows it, `.done` removes from it, and both end the run in a new terminal value `D` that the browser client shows as a todo view.

Done when: `dsl.md`, `browser-client.md`, `CONTEXT.md`, and ADR 0017 specify the design below; the core and the client implement it with tests; and the human has driven it on the dev server.

## Notes

**Settled in a grilling session; don't reopen these as tickets.**

- **Todo item = a bare URL.** It is a valid URL with an explicit scheme and **no `{}` placeholder**, stored verbatim. There is no note and no query. An item is compared to another by string equality, with no WHATWG normalization.
- **Todo list = a fourth field of `S`**: `["S", {targets, focus, alias, todo: [u]}]`. It is ordered, with no duplicates. An omitted `todo` defaults to `[]`. A duplicate or invalid URL in a supplied `S` is a `parse_error`. The client base state holds `[]`.
- **New terminal envelope `D`**: `["D", {"todo": [u]}]`. It is legal as a top-level value, as `R` and `E` are, is validated like `S.todo`, and seals the stack. dsl.md's §1 notation must not imply that `D` pairs with `d` (dimension literal).
- **Operations** (they ignore focus):
  ```text
  [K, S, L] | .todo -> [K, S', D]   append the URL to the end; already present → no-op
  [K, S]    | .todo -> [K, S, D]    show the list unchanged
  [K, S, L] | .done -> [K, S', D]   remove the identical URL; absent → no-op
  [K, S]    | .done -> missing_operand
  ```
  `L` must be exactly one literal, so more than one (the separator included) is `missing_operand`. That literal must be a placeholder-free URL; anything else is `invalid_destination`. This also refuses aliases (`~rfc` is not a URL), so no alias-specific rule is needed.
- **`.merge`**: `S1.todo ++ S2.todo`, keeping each URL's first occurrence.
- **Finishing deletes.** There is no done flag or archive; the bounded history is the undo.
- **Host interaction.** The host's trailing `.$` meets a stack already sealed by `D`, and its `missing_operand` is absorbed. `.out` pops `D` into the register just as it pops `R`. **`.save` writes when the terminal is `R` or `D`** (today it writes only on `R`). Everywhere that recognises `R` as a stack value or terminal must recognise `D` as well: `push`, the evaluator, `isStackValue`, and `OutputRegister.terminal`. `decideNavigation` never navigates on a `D`.
- **Running.** `.todo` and `.done` make a program nontrivial, so it waits for Enter, including from `?q=` ([ADR 0015](../../docs/adr/0015-nontrivial-programs-run-on-enter.md) unchanged). A blank open still lists targets. Only a `D` in the register shows the todo view.
- **Todo view.** Rows appear in stored order (oldest first), and the client never sorts them. Selection works with ↑/↓, Enter or a click opens a row, and Ctrl+1–0 open by row. **Right puts the row's URL into the field** so `.done` can be typed after it; there is no remove button. After Right, the field runs live as a plain search, as it already does. The summary bar reads `N todos`. An empty list shows "No todos" with an example `https://example.com .todo`. Help documents `.todo`/`.done`. The REPL prints a `D`.
- **Accepted incompatibility.** An older deployed page rejects an `S` carrying `todo` with `parse_error`, for example on an import across versions or after rolling back a release. This is recorded in the ADR; there is no migration.
- **Deferred.** A key that puts a match row's **rendered URL** into the field, so a search result can be saved as a todo. It goes in `IDEAS.md`.
- **Glossary.** **Todo item** and **Todo list**, both under _Avoid_: task, bookmark, reading list.

**Ticket protocol.** Same as [thither-v1](../thither-v1/map.md): one ticket per session; claim before work; resolve with an `## Answer`, `Status: resolved`, and a line under Decisions so far, landing in the same commit as the work. Branch `ticket/NN-slug`, merged `--no-ff`; stop before each commit for human review ([code-standards.md](../../docs/code-standards.md)).

## Decisions so far

<!-- one line per resolved ticket: gist + link -->

- [Specify the todo list](issues/01-spec-adr-glossary.md): [ADR 0017](../../docs/adr/0017-todo-list-in-the-state-and-a-d-terminal.md), `dsl.md` §1/§2/§4.6–§4.8/§6/§7, `browser-client.md`, `CONTEXT.md` (Todo item, Todo list), and `IDEAS.md` now specify the design above. Settled while writing: a `D` run empties the field, the selection defaults to no row, and the setup instructions are hidden in the todo view.
- [Implement the todo list in the core](issues/02-core.md): `State.todo` is required and repaired to `[]` on parse; `D` is a terminal value; `.todo` and `.done` are in `defaultEnv`; `.merge` deduplicates. Fixed `.set`/`.rm` dropping the todo list when they rebuild `S`. Client and REPL changed only where needed to compile.
- [Show the todo list in the client and the REPL](issues/03-client-and-repl.md): `.out` pops and `.save` persists a `D`; a new `todo-list.ts` renders the view with match-row-shaped rows, so selection and shortcuts are reused; Right puts a todo URL into the field; a `D` run empties the field; Help and the REPL know `.todo`/`.done`.

## Fog

- Whether the todo view needs visual distinction beyond the summary bar text (a heading, an icon), to be settled when the view is driven in ticket 04.

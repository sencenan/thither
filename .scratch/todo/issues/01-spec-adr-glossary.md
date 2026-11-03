# Specify the todo list: ADR, `dsl.md`, `browser-client.md`, glossary

Type: task
Status: resolved

## Question

Write the agreed design in [the map](../map.md) into the normative docs. **This ticket is docs only, with no code.** Use the glossary's vocabulary.

- **ADR 0017**, `docs/adr/0017-todo-list-in-the-state-and-a-d-terminal.md`. Cover:
  - The todo list is a field of `S` rather than targets under a reserved dimension or a separate record. The reason: history, revert, import, and `.merge` come for free, and todos stay out of target search.
  - `D` is a new sigil rather than an optional field on `R`, so `R` keeps one meaning.
  - A todo item is a bare, placeholder-free URL.
  - Finishing deletes.
  - The accepted backward incompatibility: an older page rejects `S.todo`.
- **`docs/dsl.md`**:
  - §1: in the value types table, add a symbol for a todo item, `D` and its shape, and `todo` in `S`. Don't let `D` read as a collection of `d`. Add transition rows for `.todo` (with and without `L`) and `.done`, and say that `D` seals the stack like `R`. Update the lifecycle's stop rule to cover `R`, `D`, or `E`.
  - §2: add the operation list entries. A supplied `S`'s `todo` defaults to `[]`, and each entry must be a placeholder-free URL with no duplicates, otherwise `parse_error`. A supplied `D` is validated the same way, and unknown fields are dropped as on `R`.
  - §4.6: todo list merge (concatenate, first occurrence wins).
  - New §4.7 `.todo` and §4.8 `.done`, with examples covering append, duplicate no-op, absent-`.done` no-op, more than one literal → `missing_operand`, a template or alias → `invalid_destination`, and focus ignored.
  - §6: the `missing_operand` and `invalid_destination` "raised when" lists, the `parse_error` list, and the vocabulary of top-level values.
  - §7: a worked program (`S https://a .todo` then `S' https://a .done`, showing `D`).
- **`docs/browser-client.md`**:
  - The host operations: `.out` pops `R`, `D`, or `E`, and `.save` writes on `R` or `D`.
  - The register's terminal, and the client base state's empty todo list.
  - A `D` never auto-navigates.
  - The todo view: rows, selection and shortcuts, Right puts the URL in the field, the summary bar `N todos`, and the empty-list state.
  - Help's list of operations.
- **`CONTEXT.md`**: add **Todo item** and **Todo list** (a new subsection or under *State and focus*). Add the todo list to **State of the world** and **Merge**, and `.todo`/`.done` to the **Nontrivial program** prose if it enumerates operations.
- **`IDEAS.md`**: add the deferred "put a match row's rendered URL into the field" idea.

**Done when** every bullet in the map's Notes has a normative sentence in the docs, no `_Avoid_` term appears, and `pnpm run verify` is clean.

## Answer

Docs only; no code.

- **[ADR 0017](../../../docs/adr/0017-todo-list-in-the-state-and-a-d-terminal.md)**: the todo list in `S`, `D` as a third terminal, the bare-URL operand, deletion, and the rejected options (reserved dimension, separate record, field on `R`, notes or queries, done flag). Consequences cover older pages rejecting `S.todo`, `.save` on `D`, the absorbed `.$`, and the Enter gate.
- **`dsl.md`**:
  - §1: `S.todo`, a `D` row, a note that `D` is not a collection of `d`, `R`/`D`/`E` named terminal, transition rows for `.todo` and `.done`, and the lifecycle stop rule.
  - §2: the operation list (eight), `.todo`/`.done` take no separator, todo items are placeholder-free, and validation of a supplied `S.todo` and `D`.
  - §4 intro, §4.6 (todo merge), new §4.7 `.todo` and §4.8 `.done` with example tables.
  - §6: `parse_error`, `invalid_destination` (`{}` in an operand), `missing_operand`.
  - §7: a new worked program, "Keep and finish a todo item".
- **`browser-client.md`**: eight operations, `emptyState()`'s empty todo list, `.out` pops `D`, `.save` writes on `R` or `D`, a `D` never navigates, persistence and the malformed-record wording, and the Help operations list. Two new paragraphs: the field after a `D` run, and the todo view.
- **`CONTEXT.md`**: a *Todo list* section with **Todo item** and **Todo list**; **State of the world**, **Merge**, and **Output register** amended.
- **`IDEAS.md`**: the deferred rendered-URL key.

Three client details the grilling left open were settled while writing:

- A run ending in a `D` **empties the field**. Putting `.todo` back would make the field a nontrivial program again.
- The selection **defaults to no row** after a `D`.
- The **setup instructions are hidden** in the todo view, while the focus bar stays.

Ticket 03 was amended to match.

# Show the todo list in the client and the REPL

Type: task
Status: ready-for-agent
Blocked by: 02

## Question

Implement `browser-client.md`'s todo amendments from ticket 01.

- **`browser-env.ts`**:
  - `OutputRegister.terminal` becomes `Result | TodoList | ThitherError`.
  - `isStackValue` accepts `D`.
  - `.out` pops `D`.
  - **`.save` writes when the terminal is `R` or `D`.** Add a fixture showing that `https://a .todo` persists `S'`.
- **`base-state.ts`**: the base state holds `todo: []`. It already goes through `emptyState()`, so check that it does.
- **Navigation**: `decideNavigation` never navigates on a `D`. Pin this with a fixture.
- **Fallback page / match list**: when the register holds a `D`, render the todo view in place of the match list.
  - Rows are the URLs in stored order.
  - The summary bar reads `N todos`, with the row key hints.
  - An empty list shows "No todos" plus the example `https://example.com .todo`.
  - Selection with ↑/↓, Enter or a click opens a row, and Ctrl+1–0 open by row, all reusing the existing row behaviour.
  - **Right** puts the selected row's URL into the field, unescaped (a URL never starts with `.`), and runs it as Right does for keys.
  - Selection defaults to no row after a `D`, and the run that ends in a `D` empties the field.
  - The setup instructions are hidden in the todo view; the focus bar shows as usual.
- **`help.ts`**: document `.todo` and `.done`.
- **`scripts/repl.ts`**: print a `D` on top of the stack as its todo list.
- **Tests** (happy-dom): the todo view renders, the empty state, Right fills the URL, and a `D` doesn't navigate.

**Done when** `pnpm run verify` is green and the todo view works on the dev server.

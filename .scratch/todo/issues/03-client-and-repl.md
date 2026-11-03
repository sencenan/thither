# Show the todo list in the client and the REPL

Type: task
Status: resolved
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

## Answer

- **`browser-env.ts`:**
  - The register's `terminal` is `Result | TodoList | ThitherError`.
  - `isStackValue` accepts `D`, and `.out` pops a `D`.
  - **`.save` writes on `R` or `D`.** Fixtures: `.todo` persists `S'`, `.done` persists the removal, and a failed `.todo` persists nothing.
- **Navigation:** no code change; `resolveNavigationDestination` already rejects anything but an `R`. An end-to-end fixture pins that a single-URL `D` doesn't navigate.
- **New `todo-list.ts`** renders the todo view:
  - The summary bar reads `N todos`, with its own key hints (`→ edit URL`).
  - Rows are `li.match.todo` with `data-todo`. They reuse the match rows' shape, so `moveSelection`, `selectedLink`, and `shortcutLink` work unchanged.
  - The empty state is `.todo-empty` with the example.
  - `match-list.ts` now exports `SHORTCUT_DIGITS` for it.
- **`output.ts`:** a `D` renders the todo view and skips the setup instructions. The focus bar and reset hint are kept.
- **`fallback-page.ts`:**
  - Enter on a program ending in `D` empties the field.
  - Right reads `selectedFieldText`: a todo row's URL as stored, otherwise the key tokens as before.
- **`style.css`:** todo rows use a one-line `badge destination` grid.
- **`help.ts`:** a "Todo list" usage entry, `.todo`/`.done` rules, and both operations named in "Run".
- **`scripts/repl.ts`:** prints a `D` as a numbered list, pops it from the kept stack like `R`/`E`, and `:load` accepts it. Checked by hand with `.todo`/`.done`/an invalid template.
- **Tests:** 876 green. New cases cover:
  - the todo view in stored order and the `N todos` summary;
  - the empty state, with setup instructions hidden;
  - no default selection, then Down + Enter and Ctrl+1 open;
  - Right then `.done`;
  - `.todo` from the URL waiting for Enter and never navigating.

The visual check on the dev server is left to ticket 04.

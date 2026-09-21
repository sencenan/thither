# Wire the skeleton: execute, navigate, or list

Type: task
Status: open
Blocked by: 17, 18

## Question

Assemble the walking skeleton: a page that reads `?q=`, executes the program against persisted state, and either navigates or shows an unstyled result list. This is the first thing a human can actually use.

In scope, per `browser-client.md` "Execution flow":

- Build the program as `tokens.reduce(parse, parse(emptyProgram, lastStackValue))`, execute, pop the terminal `R` or `E`, persist, then act.
- On initial URL-driven execution with an `R`: navigate when exactly one target is selected with a nonnegative argument balance; otherwise show the fallback list. There is no special case forcing a bare URL to the fallback UI.
- With an `E`: display its `type` and `description` without interpreting the type value.
- Render `R.matches` in the order the core emits — the client does not sort.
- Execute the supplied program as-is: no confirmation gates for `.set`, `.rm`, or `.@`, including when input arrives by URL.
- No scheme allowlist on navigation.

Deliberately **not** in scope: the 200 ms debounced live execution, the editable input field's live re-execution, highlight rendering, keyboard shortcuts, setup instructions, the settings modal, and any styling. Rows may be plain links. These are S5.

**Done when** the human can run a `.set` program and then navigate by dimension, in a local dev server, with state surviving reload.

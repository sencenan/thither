# Wire the skeleton: execute, navigate, or list

Type: task
Status: open
Blocked by: 17, 18

## Question

Assemble the walking skeleton: a page that reads `?q=`, runs the program against persisted state, and either navigates or shows an unstyled result list. This is the first thing a human can actually use. The module map is [ticket 16](16-client-architecture-and-seams.md)'s; this ticket fills in `session.ts`, a minimal `view.ts`, and `main.ts`.

In scope, per `browser-client.md` "Execution flow":

- `session.ts`: `createSession({ interp, register, locks, navigate, render })` with `run(input, mode: 'initial' | 'live')`. Build the program `['.load', ...tokenize(input), '.$', '.out', '.save'].reduce(interp.pushToken, [])`, execute it inside `locks.request` (or without a lock when `navigator.locks` is absent), then read the **register only**. Holds the `navigationArmed` latch: true at page load, false once anything has been rendered.
- `decideNavigation(register, armed)`, pure: navigate when armed, the terminal is an `R` with exactly one match whose `argDelta >= 0`, and `saved.changed` is `false`; otherwise show. Table-tested.
- `view.ts`, minimal: an `R` renders `R.matches` as plain links in the order given (the client does not sort); an `E` renders its `type` and `description` verbatim, plus the Settings-reset hint when `register.loaded` is `false`. No styling.
- `main.ts`: composition root. Builds `defaultEnv()`, registers the persistence symbols, creates the interpreter, wires `localStorage`, `navigator.locks`, `location.replace`, and `document`. Wraps the initial run in the one `try`/`catch` the client has, rendering a bare error when `.load` throws (localStorage unavailable). Untested by design.
- Execute the supplied program as-is: no confirmation gates for `.set`, `.rm`, or `.@`, including when input arrives by URL. No scheme allowlist on navigation.

Deliberately **not** in scope: the 200 ms debounced live execution and the editable input field, highlight rendering, keyboard shortcuts, setup instructions, the settings modal, and any styling. These are S5; `mode: 'live'` exists in the signature so S5 adds a caller rather than a parameter.

**Done when** the human can run a `.set` program (which sets and then shows the fallback list, because the stack changed), then navigate by dimension on the next query, in a local dev server, with state surviving reload.

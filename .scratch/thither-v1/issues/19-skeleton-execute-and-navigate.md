# Wire the skeleton: execute, navigate, or list

Type: task
Status: resolved
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

## Answer

The walking skeleton is assembled across three new client modules plus a rewritten composition root; `pnpm verify` green, 262 tests (45 new across `session`/`view`).

- **`src/client/session.ts`** — `createSession({ interp, register, locks, navigate, render })` returning `run(input, mode)`. `run` composes `['.load', ...input, '.$', '.out', '.save']` via `pushToken`, executes it inside `locks.request('thither', …)` (or directly when `navigator.locks` is absent), then reads the **register only**. It holds the `navigationArmed` latch (true at load, false after the first render) and drives navigation off `decideNavigation`.
- **`decideNavigation(register, armed)`**, pure and table-tested: navigate when armed, `terminal` is an `R` with exactly one match whose `argDelta >= 0`, and `saved` is a success record with `changed === false`. A failed save (`E` in `saved`), an absent save, a changed stack, zero/multiple/negative matches, or a disarmed run all decline. **Narrowing note:** `saved` is `{ changed } | ThitherError | undefined`; `Array.isArray` does **not** narrow the readonly-tuple `ThitherError` out under TS7, so the discriminant is `'changed' in saved`.
- **`src/client/view.ts`** — `renderView(root, register)`: an `R` renders `matches` as plain `<a>` links **in emitted order** (the client never sorts), an empty match set shows a no-matches line, an `E` renders `type: description` verbatim, and `loaded === false` appends the Settings-reset hint. `replaceChildren` clears prior content each render. No styling/highlights/shortcuts (S5).
- **`src/client/main.ts`** — composition root (untested by design): `createBrowserEnv(localStorage)` → `createInterpreter` → `createSession` wired to `location.replace`, `navigator.locks` (feature-detected, wrapped as a `LockRunner`), and `renderView(#app, …)`. The client's one `try/catch` is `main().catch(...)`, rendering a bare error when `.load` throws (localStorage unavailable) — no execution, no navigation.

**Mode.** `run(input, mode)` gates navigation on `mode === 'initial' && navigationArmed`, so `mode: 'live'` never auto-navigates and exists purely so S5 adds a caller, not a parameter (per the ticket).

**Testing seam / new dependency.** `session.test.ts` wires the real `createBrowserEnv` + interpreter against a `Map`-backed storage fake in plain Node (empty-run render, single-match navigation, the `.set` changed-guard showing the list, latch disarm, live-mode, and lock usage). `view.test.ts` runs under **happy-dom** via a `// @vitest-environment happy-dom` pragma — **added `happy-dom` as a devDependency** (ticket 16 anticipated happy-dom tests for `view.ts`); `vitest.config.ts`'s default environment stays `node`, so only `view.test.ts` opts in.

**Empty input never auto-navigates** (found in the manual dev-server check): an empty program searches on focus alone and matches *every* target, so a one-target state redirected on a blank open and could never be reached to add targets or open Settings. `run` now gates navigation on `input.length > 0`; amended `browser-client.md` "Execution flow" step 4 to state the rule and its reason, with a regression test.

**Incomplete single match:** `decideNavigation` requires `argDelta >= 0`, so a match missing arguments is never auto-navigated to (nor, in S5, reachable by shortcut) — but `view.ts` still renders it as an ordinary clickable link. "Rows missing required arguments remain non-navigable" governs only the automatic/shortcut path, not the rendered anchor (confirmed with the human).

**Left for later stages, per scope:** 200 ms debounce + editable field, highlight rendering, `1`–`9`/`0` shortcuts, setup instructions, settings modal, styling (all S5); bounded history / eviction / quota retry / Web Lock deepening (S4).

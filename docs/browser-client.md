# Browser client

Status: agreed. Language semantics are defined in [dsl.md](dsl.md), and domain terminology in [../CONTEXT.md](../CONTEXT.md).

## Scope

Thither is a static web application containing a JavaScript browser client and a JavaScript-compatible language core. The supported entry point is the browser address or search bar through a configured search shortcut.

This browser client is one possible client, not the only intended one. Decisions here bind this client; the language core stays client-agnostic and performs no persistence, rendering, or navigation. Browser targeting is capability-based: any browser supporting shortcut-based search is a valid target, with no brand allowlist. The platform floor is **Baseline 2024**: the core validates destinations with the static `URL.parse()` (Chrome 126, Firefox 126, Safari 18), not polyfilled.

localStorage is the sole source of persisted state, per [ADR 0001](adr/0001-localstorage-only-browser-client.md). This version has no command-line application, local-file adapter, remote state storage, authentication, sharing, or synchronization, and no server-side interpreter.

## Search-shortcut contract

A user configures Thither by hand, as a custom search engine or bookmark keyword, using one of two URL templates. The browser substitutes `%s` with the typed input:

```text
https://<host>/<path>/?q=%s     default
https://<host>/<path>/#q=%s     keeps input out of the host's request logs
```

The query form is the documented default: it is the form a future server could receive. The fragment form is the privacy-preserving alternative, because under the query form every program a user types reaches the static host's access log, dimensions and arguments included. Both work with static hosting and both can appear in browser history.

Browsers differ in how they substitute `%s`, and an unencoded substitution breaks input containing `#`, `&`, or `+`. That behaviour is verified by hand with [the search-shortcut checklist](search-shortcut-checklist.md), not defended against in code: the client cannot distinguish a browser-split parameter from a user who typed the character.

Thither publishes no OpenSearch description document. Auto-discovery needs a second file at its own URL, which conflicts with the single-file artifact of [ADR 0002](adr/0002-single-file-static-page-on-github-pages.md), and it would still end in a browser prompt. Setup stays a one-time manual paste.

### Reading input

Input selection has explicit precedence:

1. If the query contains `q`, use its value.
2. Otherwise, read `q` from the fragment.
3. If neither contains `q`, the input is empty.

Presence, not truthiness, decides: an explicitly empty `?q=` takes priority over fragment input. Other query parameters do not prevent fragment fallback. When both sources contain input, execute only the query input; do not concatenate them.

Parse both the query and the fragment's parameter text with `URLSearchParams`, using its standard decoding exactly once: `+` represents a space and `%2B` a literal plus. If the selected source holds multiple `q` parameters, use the first. Do not apply an additional `decodeURIComponent` pass.

Once the fallback page is shown, remove the consumed input from the URL with `history.replaceState`: delete `q` from both the query and the fragment (both, so a reload cannot fall through to the fragment), and leave every other parameter, the path, and a `q`-less fragment as they were. A reload is then a blank open against the then-current state rather than a replay of a program that may have mutated it — `<u> home .set` sets once, not once per refresh. This is the only URL the client rewrites; automatic navigation leaves the page instead, and the bare error page (no execution happened) keeps its URL. The tokens read from the URL are recorded on the browser environment as `input` before the strip, so the fallback UI still has the program the user typed (its text field is seeded from `input`, not from the address bar).

## Core interface

The core exposes an **interpreter**, built from an environment (see [ADR 0005](adr/0005-extensible-interpreter-environment.md)):

- `defaultEnv()`: an environment preloaded with the language's four operations (`.set`, `.rm`, `.@`, `.$`). A client may register further symbols on `env.symbols` before building the interpreter.
- `createInterpreter(env)`: bind an environment, producing an interpreter.
- `emptyState()`: the state value with no targets and empty focus. `[emptyState()]` is the stack a client persists before its first execution.

The interpreter exposes a **program** as an ordered, mutable list of values; the empty program is `[]`:

- `interp.pushToken(program, item)`: append one string token or one structured value, validated against the environment, mutating and returning `program`.
- `interp.execute(program, stack?)`: evaluate exactly the program given, on a copy of `stack` (empty when omitted), producing a data stack. The interpreter appends nothing — not even `.$` — so a host closes its programs itself ([ADR 0007](adr/0007-hosts-compose-the-program.md)). Neither argument is mutated.

Parse failures are values, not exceptions: a failed `pushToken` yields an `E` value in the program, and executing `E` pushes it and stops. The client therefore needs no parse-error path and no validation of its own. The same entry point validates the persisted stack on load, and parses an imported stack's values.

### Host operations

The client registers three **host operations** on `defaultEnv()` before building the interpreter, and they are the whole of its persistence. They write to an **output register**, a client-held slot cleared at the start of each run, which is the only thing the client reads after execution.

- `.load`: clears the register; reads `thither.stacks.v1`; when the record is absent, pushes `[emptyState()]`; otherwise validates every value of the current stack through `interp.pushToken` and pushes the stack. A record that is not a non-empty array of arrays, or whose current stack holds a value that parses to `E`, makes `.load` push that `parse_error` and set `loaded: false` in the register. When `localStorage` itself is unavailable, `.load` throws.
- `.out`: if the top of the stack is an `R` or `E`, pops it into the register as the run's terminal; otherwise does nothing. It then records the `S` left on top, when there is one, as the register's `state`: the world as the run left it, after any mutation the user's tokens made, which is what the fallback UI reads for the target count, the focus, and the empty-target-set instructions. It extracts output for the client's next step and is not a general-purpose pop.
- `.save`: persists the stack as it stands under the bounded-history rules below, **but only when the register holds an `R`** — a run that reached its search. The `R` proves `.$` ran and consumed the literals, so what is stored is always a stack `.load` can read; a run that ended in an `E` persists nothing, and neither does a stray `.save` typed before the search. This is why a half-typed operation name (`home .r` on the way to `.rm`, or a `?q=home .rn` typo) leaves the record exactly as it was rather than writing the orphaned literal array into it. It also means a program that mutates and *then* errors (`<url> home .set git .set`) commits nothing: [dsl.md](dsl.md) §6's "not rolled back" holds for the stack the run returns, and the host simply declines to persist a run that ended in error. If the write fails, `.save` pushes `E(unknown_error)` and writes that `E` into the register as the run's terminal, replacing the `R` that `.out` captured, so the client renders the failure rather than treating the execution as persisted.

Host operations are ordinary environment symbols, so a user can type them mid-program. The epilogue always runs last, so a stray `.load`, `.out`, or `.save` cannot corrupt the final write; this is documented behaviour, not a defended-against attack.

## Execution flow

Every run is one program, **prologue + user tokens + epilogue**:

```text
.load  <tokens…>  .$  .out  .save
```

1. Split the user's input on whitespace. Search-bar users are not expected to type structured state, so input tokens are never treated as JSON.
2. Build the program: `['.load', ...tokens, '.$', '.out', '.save'].reduce(interp.pushToken, [])`.
3. Execute it. `.load` supplies the world, `.$` searches, `.out` captures the terminal, `.save` persists — so the save necessarily precedes anything the client does next.
4. Read the register. For an `R` on initial URL-driven execution, navigate when the result holds exactly one match with a nonnegative argument balance (one selected target with a best fit, or with a single variant) **and `R.inputs` is non-empty** — the user typed a query ([ADR 0009](adr/0009-auto-navigate-on-a-non-empty-query.md)); otherwise show the fallback UI. There is no special case forcing a bare URL to the fallback UI, and no check on whether the run mutated state. For an `E`, display its `type` and `description` without interpreting the type value; when `loaded` is `false`, add that recovery happens through the Settings reset.

`R.inputs` is the query the trailing `.$` consumed, so it decides every edge case without a second rule. `https://example.com/ a b .set a b` sets the target and navigates to it in one keystroke, because the program ends in a search. `https://example.com/ home .set` sets and then shows the fallback UI, because it does not. **An empty query never auto-navigates**: a blank open searches on focus alone and matches every target, so a one-target state would otherwise redirect and never be reachable — opening the launcher with no input always shows the page, keeping targets addable and Settings reachable. Focus is not part of `inputs`, so `home .@` and a blank open under stored focus show the page too. Automatic navigation uses `location.replace`, so the Thither page does not remain in history as a redirect loop behind the destination; links in the fallback UI are ordinary anchors.

The client does not inspect the persisted values' language types, extract `S`, or serialize anything into DSL source: operations act on the top of the stack, so values beneath it ride along unchanged, and an unusable top value is the interpreter's concern and surfaces as `E`, with no client-side repair. An unparsable token is likewise just an `E` in the program stream, so tokens before it still execute. Every outcome follows the same execute-then-read-the-register loop, and the client never reconstructs an error stack from the previous snapshot.

Recoverable failures are `E` values in the language's existing vocabulary; unrecoverable ones (`localStorage` unavailable) are exceptions, caught once in the client's composition root and rendered as a bare error page with no execution and no navigation.

Execute the supplied program as-is. Do not add confirmation gates for `.set`, `.rm`, or `.@`, including when input arrives through a URL. This deliberately accepts that an externally supplied link can change state; history provides recovery, not authorization.

A run is synchronous end to end: `.load` and `.save` run inside `execute`, and both `execute` and `localStorage` are synchronous, so within one page nothing can interleave with the read → execute → save sequence, and two runs in the same page can never overlap. Runs are **not serialized across tabs**: two tabs executing at the same instant could lose one update. That is accepted for a single-user tool whose runs take microseconds — the Web Locks API was considered and dropped as complexity out of proportion to the risk.

## Persistence

Persist the entire remaining stack, not only one `S`: `[S0, S1, R]` persists as `[S0, S1]`, and `[S, E]` persists as `[S]`. Terminal `R` and `E` values never enter a stored snapshot. Only the final value of the stored stack is copied into the next program, so after persisting `[S0, S1]` the next program begins with `S1`.

Two versioned localStorage records exist, so a later format can migrate rather than silently corrupt existing data.

`thither.stacks.v1` is a flat array of stacks, oldest first, whose **last element is the current stack**:

```jsonc
[ [/* oldest retained stack */], [/* ... */], [/* current stack */] ]
```

Eviction removes elements from the front. With history limit `N`, the array holds at most `N + 1` stacks. An empty array is not a valid record; absence of the key is how "no stored data" is represented.

`thither.settings.v1` holds configuration only, never language stack values:

```jsonc
{ "historyLimit": 10 }
```

When a save exceeds the storage quota, the write simply fails: the stored record is left as it was and the failure is reported explicitly rather than treating the execution as persisted. History is not evicted to make room — exceeding the quota is unlikely at these sizes, and the user can lower the history limit or reset through the settings if it ever happens.

Malformed stored data must not trigger an automatic reset or be replaced by guessed state. `.load` pushes an `E`, which seals the stack: the user's tokens are absorbed, `.out` captures the `E`, and `.save` writes nothing (the register holds no `R`). Render the error in place of the result list and state that recovery happens through the settings modal (revert, clear, or import), keeping the Settings control reachable. Only one of those explicit actions replaces the stored record. When localStorage is unavailable rather than merely empty, show that as an error too: do not fall back to an in-memory session, execute programs, or navigate, because without persistence the execution loop has no valid starting point.

## Fallback UI and settings

The fallback page has a text field at the top containing the current program input. Editing it updates the query and triggers live execution after a **60 ms keystroke debounce**, rather than waiting for Enter; each keystroke restarts the delay. Live execution uses the ordinary interpreter and persistence flow, including mutations and bounded history — it is not a separate read-only search. The field takes focus when the page is shown, and a printable key pressed while it is not focused returns focus to it and types there: the page has no other typing target.

Once the UI is shown, automatic navigation is disabled for the remainder of that page load, even when only one complete match exists. Users navigate by clicking a result or using its keyboard shortcut. Reloading is a new initial URL-driven execution, but the consumed input has left the URL ("Reading input"), so it opens blank rather than replaying the program.

An `E` is shown directly beneath the field, in place of the result list, as its `type` and `description`; when `loaded` is false it also points at Settings, which stays reachable.

Below the field, display results in the order `R.matches` already has; the core emits its final display order, so the client does not sort. Each row shows the target's key, its destination, its argument balance, and `hint.score`. Indicate which characters of the key matched from `hint.positions`, and which arguments were inserted by rendering the match's destination template ([dsl.md](dsl.md) §5) with its applied arguments slot by slot — a filled `{}` shows its argument, an unfilled one stays visible as a placeholder — rather than searching the rendered destination or re-running the matcher. A row missing arguments reads visibly different from a complete one.

Every match is listed. The first ten rows have navigation shortcuts `Ctrl+1` through `Ctrl+9`, then `Ctrl+0` for the tenth, active whether or not the text field has focus; display the digit beside each of those rows, and nothing beside the rest. **Enter opens the first row when the run searched a query** — `R.inputs` non-empty, the same test automatic navigation applies ([ADR 0009](adr/0009-auto-navigate-on-a-non-empty-query.md)) — so `https://example.com/ home .set` followed by Enter commits and lists rather than opening the first of every target; a pending debounce is run first, so Enter acts on what was typed. A shortcut, Enter, or a click opens the row's destination as rendered, an unfilled `{}` included — only automatic navigation demands a complete destination.

While the target set is empty (the register's `state` has no targets), the page shows setup instructions in place of the result list: both shortcut URL templates and one example `.set` program. They disappear once the target set is non-empty and are not reachable from a dedicated URL. They are not shown when `loaded` is false.

Provide a Settings control on the page, opening a modal dialog that lists the stack history **newest first, the current stack at the top**, and offers three actions on it plus history-limit configuration: **revert** to a listed stack, **clear** everything and start from scratch, and **import** a stack pasted from another machine. Each listed stack shows its target count; selecting one shows its JSON in a stack panel beside the list, which is also where a stack is pasted for import, so a stack can be read or copied from there, and an old one restored as a new entry by importing it. Do not reserve a settings URL or bypass normal execution with a parameter such as `view=settings`; users reach the page through a query with no matches or an ambiguous one, then open Settings.

The three actions act directly on the stored record and are not programs; none replays a program, searches, or navigates. After an action the modal closes and the page re-runs the field's current contents, so the list reflects the new current stack. **Revert** to a listed stack drops every entry newer than it, so the selected stack is the last — that is, current — one; values are not re-validated, since they were validated when saved. **Clear** removes the record outright; absence is first initialization, so the next run seeds `[emptyState()]`. Settings are kept. **Import** accepts a JSON stack array directly, such as `[["S", {"targets": {}, "focus": []}]]`, without an extra object wrapper: each value is pushed through the interpreter and whatever stack results is appended as the last entry under the ordinary difference and eviction rules. Import does not validate — a value that fails to parse lands in the stack as the `E` it parses to, and the next `.load` reports it; the user reverts or clears. When the stored record is unreadable there is no previous entry to retain, so import simply writes the new record.

Navigation applies no client-side scheme allowlist and no scheme-based confirmation: for an otherwise eligible destination, attempt navigation and let the browser enforce its own restrictions. This is an explicit user-controlled policy — destinations such as `javascript:` can execute code in the page's context, potentially reading or modifying localStorage, and some schemes may simply be refused.

## Bounded history

Retain the current persisted stack and at most **N previous persisted stacks**, with **N defaulting to 10**; the current stack is not counted against N. Snapshots hold the entire returned stack after its terminal `R` or `E` is popped, are never mutated by later executions, and change only by adding entries or evicting the oldest.

On first initialization the current stack is `[emptyState()]`. It becomes a historical entry after the first execution that changes the stack, so the first mutation can be undone. History is a plain list of previous stacks, with no input, timestamp, or origin metadata.

Push the previous current stack into history only when the new current stack differs from it, comparing by structural JSON equality. Ordinary searches therefore add no entry. This deduplication applies to executions and imports alike. Executing on the whole current stack leaves the values beneath the top state in place, so a previous stack `[A, B]` becomes `[A, B']`, which differs structurally and so does add an entry.

History is inspected and acted on from the settings modal, which lists stacks newest first without descriptive labels beyond a target count; there is no current stack apart from the last entry. The history-limit setting accepts nonnegative integers; `0` retains only the current stack, and lowering the limit evicts the oldest excess entries.

Reverting restores the entire selected stack without interpreting its values and does not re-execute the original program or replay navigation. It is not itself undoable: the entries it drops are gone.

## Source, build, and deployment

All application logic, including the language core and browser client, is authored in TypeScript. The release artifact is a single self-contained `index.html` with all JavaScript and CSS inlined, published on GitHub Pages. Runtime libraries must be bundled rather than loaded from a CDN, and any additional UI assets must be embedded or omitted.

Selected tooling: vanilla TypeScript without a UI framework, Vite with `vite-plugin-singlefile`, a separate `tsc --noEmit` type-check step, and a GitHub Actions workflow that builds and deploys the page. Checks run on every push and pull request, but publishing to Pages happens only on a pushed `v*` tag, per [ADR 0004](adr/0004-publish-by-tag.md): the live page is a configured search shortcut's target, so replacing it is a deliberate act. The build should verify that the deployable output contains only `index.html` and references no external application scripts or stylesheets; the single-file plugin does not automatically inline arbitrary files from Vite's `public` directory.

Use the browser-compatible npm `fzf` port (`ajitid/fzf-for-js`) for fuzzy matching and bundle it into the inline JavaScript. Treat it as an ordinary dependency under the project's normal versioning policy, configured to satisfy the matching rules in [dsl.md](dsl.md), and test Thither's expected behavior rather than claiming score parity with current upstream fzf. Remaining algorithm configuration is an implementation detail to settle with tests; see [the library research](research/fzf-libraries.md).

Implementation staging is not part of this specification; it lives in [the v1 implementation map](../.scratch/thither-v1/map.md).

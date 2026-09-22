# Browser client

Status: agreed. Language semantics are defined in [dsl.md](dsl.md), and domain terminology in [../CONTEXT.md](../CONTEXT.md).

## Scope

Thither is a static web application containing a JavaScript browser client and a JavaScript-compatible language core. The supported entry point is the browser address or search bar through a configured search shortcut.

This browser client is one possible client, not the only intended one. Decisions here bind this client; the language core stays client-agnostic and performs no persistence, rendering, or navigation. Browser targeting is capability-based: any browser supporting shortcut-based search is a valid target, with no brand allowlist.

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

Keep program input in the URL after execution. Reloading executes it again against the then-current state; the client does not suppress replay or remove consumed input with `history.replaceState`. This is an execution policy, not a claim that every program is idempotent.

## Core interface

The core exposes an **interpreter**, built from an environment (see [ADR 0005](adr/0005-extensible-interpreter-environment.md)):

- `defaultEnv()`: an environment preloaded with the language's four operations (`.set`, `.rm`, `.@`, `.$`) and the seed stack. A client may register further symbols on `env.symbols` before building the interpreter.
- `createInterpreter(env)`: bind an environment, producing an interpreter.

The interpreter exposes a **program** as an ordered list of values:

- `interp.emptyProgram`: the starting program.
- `interp.append(program, item)`: append one string token or one structured value, validated against the environment.
- `interp.execute(program)`: evaluate the whole program against a fresh empty stack, producing a data stack.
- `interp.initialStack`: the stack a client persists before its first execution, containing one state value with no targets and empty focus.

Parse failures are values, not exceptions: a failed `append` yields an `E` value in the program, and executing `E` pushes it and stops. The client therefore needs no parse-error path, no `try`/`catch`, and no validation of its own. The same entry point validates any data the client holds, including manually supplied reset JSON.

## Execution flow

The client builds each program as `tokens.reduce(interp.append, interp.append(interp.emptyProgram, lastStackValue))`, per [ADR 0003](adr/0003-clients-resume-from-last-stack-value.md), and treats persisted stack contents as opaque language data throughout.

1. Load the entire current persisted stack from localStorage. When the record is absent, take `interp.initialStack` as the current stack.
2. Copy the final value of that stack, without modifying the persisted snapshot, and append it to `interp.emptyProgram` as the program's first item. If the stack is empty, append no leading item and do not synthesize a state value. Earlier values in the stack are retained for debugging and possible future extensions, but never participate in the next execution.
3. Split the user's input on whitespace and append each token. Search-bar users are not expected to type structured state, so input tokens are never treated as JSON.
4. Execute, then pop the terminal `R` or `E`. Persist the entire remaining stack and update bounded history before navigating.
5. For an `R` on initial URL-driven execution, navigate when exactly one target is selected with a nonnegative argument balance; otherwise show the fallback UI. There is no special case forcing a bare URL to the fallback UI. For an `E`, display its `type` and `description` without interpreting the type value.

Evaluation always starts from an empty data stack, so this is not resumption of the persisted stack. The client does not inspect the copied value's language type, extract `S`, or serialize it into DSL source: an unsupported first item is the interpreter's concern and surfaces as `E`, with no client-side repair. An unparsable token is likewise just an `E` in the program stream, so tokens before it still execute. Every outcome follows the same pop, save, display loop, and the client never reconstructs an error stack from the previous snapshot.

Execute the supplied program as-is. Do not add confirmation gates for `.set`, `.rm`, or `.@`, including when input arrives through a URL. This deliberately accepts that an externally supplied link can change state; history provides recovery, not authorization.

Serialize the complete read → execute → save sequence across tabs using the Web Locks API, holding one named lock for the whole sequence, and read the latest persisted stack after acquiring it so concurrent commands do not overwrite one another. When the API is unavailable, execute without the lock rather than blocking, accepting a small lost-update risk for a single-user, short-running operation.

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

When a save exceeds the storage quota, drop the oldest history entries and retry, always preserving the current stack. If saving still fails, report the failure explicitly rather than treating the execution as persisted.

Malformed stored data must not trigger an automatic reset or be replaced by guessed state. Skip execution, render the error in place of the result list, and state that recovery happens through the settings reset, keeping the Settings control reachable. Only an explicit reset write replaces the stored record. When localStorage is unavailable rather than merely empty, show that as an error too: do not fall back to an in-memory session, execute programs, or navigate, because without persistence the execution loop has no valid starting point.

## Fallback UI and settings

The fallback page has a text field at the top containing the current program input. Editing it updates the query and triggers live execution after a **200 ms keystroke debounce**, rather than waiting for Enter; each keystroke restarts the delay. Live execution uses the ordinary interpreter and persistence flow, including mutations and bounded history — it is not a separate read-only search.

Once the UI is shown, automatic navigation is disabled for the remainder of that page load, even when only one complete match exists. Users navigate by clicking a complete result or using its keyboard shortcut. Reloading is a new initial URL-driven execution, so it can redirect automatically.

Below the field, display results in the order `R.matches` already has; the core emits its final display order, so the client does not sort. Indicate which dimensions matched and which arguments were inserted from each match's `hint.positions` and `hint.score`, rendering highlights from that evidence rather than re-running the matcher.

The first ten rows have navigation shortcuts `1` through `9`, then `0` for the tenth. Display shortcut labels beside those rows. Shortcuts are active only when focus is outside editable fields. Rows missing required arguments remain non-navigable, including through a shortcut.

While the target set is empty, the page shows setup instructions in place of the result list: both shortcut URL templates and one example `.set` program. They disappear once the target set is non-empty and are not reachable from a dedicated URL.

Provide a Settings control on the page, opening a modal containing stack history, manual state reset, and history-limit configuration. Do not reserve a settings URL or bypass normal execution with a parameter such as `view=settings`; users reach the page through a query with no matches or an ambiguous one, then open Settings.

The reset editor accepts a JSON stack array directly, such as `[["S", {"targets": [], "focus": []}]]`, without an extra object wrapper. Validate each supplied value through `interp.append`: an invalid value yields `E` and the reset is refused without touching the stored record. A successful reset makes the supplied stack current and pushes the previous current stack into history under the same difference rule; it neither clears history nor executes the supplied stack. When the stored record is unreadable there is no previous current stack to retain, so reset simply writes the new record.

Navigation applies no client-side scheme allowlist and no scheme-based confirmation: for an otherwise eligible destination, attempt navigation and let the browser enforce its own restrictions. This is an explicit user-controlled policy — destinations such as `javascript:` can execute code in the page's context, potentially reading or modifying localStorage, and some schemes may simply be refused.

## Bounded history

Retain the current persisted stack and at most **N previous persisted stacks**, with **N defaulting to 10**; the current stack is not counted against N. Snapshots hold the entire returned stack after its terminal `R` or `E` is popped, are never mutated by later executions, and change only by adding entries or evicting the oldest.

On first initialization the current stack is `interp.initialStack`. It becomes a historical entry after the first execution that changes the stack, so the first mutation can be undone. History is a plain list of previous stacks, with no input, timestamp, or origin metadata.

Push the previous current stack into history only when the new current stack differs from it, comparing by structural JSON equality. Ordinary searches therefore add no entry. This deduplication applies to executions, resets, and restorations alike. Note that resuming from only the last value means a previous stack `[A, B]` becomes a shorter stack such as `[B']`, which differs structurally and so does add an entry.

History is inspected and restored from the settings modal, which lists stacks without descriptive labels. The history-limit setting accepts nonnegative integers; `0` retains only the current stack, and lowering the limit evicts the oldest excess entries.

Restoration restores the entire historical stack without interpreting its values, does not re-execute the original program or replay navigation, and makes the restored stack current while pushing the prior current stack into history under the same difference rule — so restoration is itself reversible while that entry survives eviction.

## Source, build, and deployment

All application logic, including the language core and browser client, is authored in TypeScript. The release artifact is a single self-contained `index.html` with all JavaScript and CSS inlined, published on GitHub Pages. Runtime libraries must be bundled rather than loaded from a CDN, and any additional UI assets must be embedded or omitted.

Selected tooling: vanilla TypeScript without a UI framework, Vite with `vite-plugin-singlefile`, a separate `tsc --noEmit` type-check step, and a GitHub Actions workflow that builds and deploys the page. Checks run on every push and pull request, but publishing to Pages happens only on a pushed `v*` tag, per [ADR 0004](adr/0004-publish-by-tag.md): the live page is a configured search shortcut's target, so replacing it is a deliberate act. The build should verify that the deployable output contains only `index.html` and references no external application scripts or stylesheets; the single-file plugin does not automatically inline arbitrary files from Vite's `public` directory.

Use the browser-compatible npm `fzf` port (`ajitid/fzf-for-js`) for fuzzy matching and bundle it into the inline JavaScript. Treat it as an ordinary dependency under the project's normal versioning policy, configured to satisfy the matching rules in [dsl.md](dsl.md), and test Thither's expected behavior rather than claiming score parity with current upstream fzf. Remaining algorithm configuration is an implementation detail to settle with tests; see [the library research](research/fzf-libraries.md).

Implementation staging is not part of this specification; it lives in [the v1 implementation map](../.scratch/thither-v1/map.md).

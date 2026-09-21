# Browser client

Status: agreed scope and execution flow; integration details remain open. Language semantics are defined in [dsl.md](dsl.md), and domain terminology in [../CONTEXT.md](../CONTEXT.md).

## Scope

Axon is a static web application containing a JavaScript browser client and a JavaScript-compatible language core. The supported entry point is the browser address/search bar through a configured search shortcut.

This browser client is one possible client, not the only intended client. Decisions here bind this client, while the language core stays client-agnostic.

Browser targeting is capability-based: any browser supporting shortcut-based search is a valid target. There is no browser-brand allowlist. The search-shortcut URL contract should remain browser-independent.

The client accepts encoded user input through either the URL query (`?q=<encoded-input>`) or the fragment (`#q=<encoded-input>`). Input selection has explicit precedence:

1. If the query contains `q`, use its value.
2. Otherwise, read `q` from the fragment.

Presence, not truthiness, determines precedence: an explicitly empty `?q=` takes priority over fragment input. Other query parameters do not prevent fragment fallback. When both sources contain input, execute only the query input; do not concatenate the two.

Parse both the query and the fragment's parameter text with `URLSearchParams`. Use its standard decoding exactly once: `+` represents a space, and `%2B` represents a literal plus. If the selected source contains multiple `q` parameters, use the first one. Do not apply an additional `decodeURIComponent` pass.

This query-first contract leaves room for a future server to receive the same input. Both forms work with static hosting. Query parameters are sent to the host; fragments are read locally and are not sent in HTTP requests. Both can appear in browser history. A server is not part of the current scope.

When neither source contains `q`, use an empty source input. With an ordinary persisted `[S]` stack, the copied final value supplies `S` as the program's first item, and the implicit `.$` searches using focus alone; empty focus selects all targets. On initial URL-driven execution, navigate for exactly one selected target with nonnegative argument balance; otherwise show the fallback UI. There is no special case forcing a bare URL to display the fallback UI. Once the UI has been shown, subsequent live executions do not automatically navigate.

Keep program input in the URL after execution. Reloading executes it again against the then-current state; the client does not suppress replay or remove consumed input with `history.replaceState`. This is an execution policy, not a guarantee that every DSL program is idempotent.

localStorage is the sole source of persisted state. There is no command-line application, local-file adapter, remote state storage, authentication, sharing, or synchronization in this version. Online/shared state is a possible future improvement, not an implementation requirement.

The language core executes programs without performing persistence, rendering, or navigation. The browser client owns those effects.

The client treats persisted stack contents as opaque language data. It copies only the last value of the current persisted stack and appends it as the program's first item, followed by the user's input tokens. If the persisted stack is empty, the program contains only those tokens. Evaluation always starts with an empty data stack; this is not resumption of the persisted stack.

The client does not inspect the copied value's language type, extract `S`, or serialize it into DSL source. A non-state or unsupported first item is the interpreter's concern: normal language rules apply and failures surface as `E`, without client-side repair or special execution rules. After execution the client interprets only the terminal `R` or `E`. The core owns language-level validation, including validation of manually supplied reset data.

Earlier values in a persisted stack are retained for debugging and possible future extensions, but do not participate in the next execution. Copying the final value must not remove it or mutate it in the persisted current stack or any historical snapshot.

## Core interface

The core exposes a **program** as an immutable ordered list of values, built with one function and a constant:

- `emptyProgram`: the starting program.
- `parse(program, item)`: append one string token or one structured value.
- `execute(program)`: evaluate the whole program, producing a data stack.
- `initialStack()`: the stack a client persists before its first execution, containing one state value with no targets and empty focus.

The client builds each program as `tokens.reduce(parse, parse(emptyProgram, lastStackValue))`. Resuming from the last persisted stack value is a client decision; the core evaluates whatever program it is given.

Parse failures are values, not exceptions: a failed parse yields an `E` value in the program. Executing `E` pushes it and stops, per the explicit-error rule in [dsl.md](dsl.md). The client therefore needs no separate parse-error path, no `try`/`catch`, and no validation of its own; it copies the last persisted stack value, appends the user's text, executes, pops the terminal `R` or `E`, and saves the rest.

The same parse entry point validates manually supplied reset JSON: an invalid stack value parses to `E` instead of throwing.

## Build order

1. Scaffold: Vite, Vitest, `tsc --noEmit`, and the GitHub Pages workflow.
2. Core tests, written first from [dsl.md](dsl.md).
3. Core implementation.
4. Single-file bundling.
5. UI and localStorage persistence, which only run in a browser.

## Source, build, and initial deployment

All application logic, including the language core and browser client, is authored in TypeScript.

The release artifact is a single self-contained `index.html`, with all JavaScript and CSS inlined. Runtime libraries must be bundled rather than loaded from a CDN. Any additional UI assets must be embedded or omitted so they do not introduce separate runtime files.

The initial release is published on GitHub Pages. There is no server-side interpreter or application runtime.

Selected tooling: vanilla TypeScript without a UI framework, Vite with `vite-plugin-singlefile`, a separate `tsc --noEmit` type-check step, and a GitHub Actions workflow that builds and deploys the resulting page.

Use the browser-compatible npm `fzf` port (`ajitid/fzf-for-js`) for fuzzy matching and bundle it into the inline JavaScript. Its authors explicitly target browser use. Treat it as an ordinary dependency under the project's normal versioning policy, and test Axon's expected behavior rather than claiming score parity with current upstream fzf. Each target's sorted dimensions form one space-separated searchable string. Match each query dimension independently against that full string, require every dimension to match, and sum their scores, as specified in [dsl.md](dsl.md). Disable diacritic normalization, retain case-insensitive matching, and preserve target-set order when summed scores are equal. Remaining algorithm configuration is an implementation detail to settle with tests; see [the library research](research/fzf-libraries.md).

The build should verify that the deployable output contains only `index.html` and does not reference external application scripts or stylesheets. The single-file plugin does not automatically inline arbitrary files from Vite's `public` directory; avoid assuming that plugin installation alone guarantees a self-contained artifact.

## Execution flow

1. Load the entire current persisted stack from localStorage. When the record is absent, take the core's `initialStack()` as the current stack.
2. Copy the final value from that stack without modifying the persisted snapshot, and append it to `emptyProgram` as the program's first item. If the stack is empty, append no leading item and do not synthesize another state value.
3. Split only the user's input portion on whitespace and append each token to the program, then execute it. Search-bar users are not expected to type structured state, so the client does not treat input tokens as JSON.
4. Pop the terminal `R` or `E` from the returned stack. Persist the entire remaining stack and update bounded history before navigating.
5. On initial URL-driven execution, use the popped search result (`R`) to render the fallback UI or navigate according to the DSL's match-cardinality and argument-completeness rules. Once the UI is shown, subsequent results update the displayed list without automatic navigation, even when exactly one complete match remains. Navigation then requires a result click or its keyboard shortcut. For a popped error (`E`), display its `type` and `description` without interpreting the type value.
6. For the next execution, copy only the final value of the new persisted remaining stack as the program's first item.

Execute the supplied program as-is. Do not add confirmation gates for `.set`, `.rm`, or `.@`, including when input arrives through a URL. This deliberately accepts that an externally supplied link can cause state changes. History provides recovery, not authorization or protection against unwanted execution.

A successful ordinary program ends with `[S, R]`, but the client must also accommodate the DSL's preserved stack prefixes and terminal errors. After removing a terminal error, retain the remaining stack, including earlier successful state changes.

An unparsable token is just an `E` value in the program stream, so tokens before it still execute. The client follows the same pop/save/display loop for every outcome and never reconstructs an error stack from the previous snapshot.

Persist the entire remaining stack, not only one `S`. For example, `[S0, S1, R]` persists as `[S0, S1]`, and `[S, E]` persists as `[S]`. Terminal `R` and `E` values are handled by the client but are not included in persisted current or historical stack snapshots. Only the final value of that remaining stack is copied into the next program. For example, after persisting `[S0, S1]`, the next program begins with `S1`; `S0` is retained in the saved snapshot but not supplied to that execution.

Serialize the complete read → execute → save sequence across tabs using the Web Locks API, holding one named lock for the whole sequence. Each execution must read the latest persisted stack after acquiring the lock, so concurrent commands do not silently overwrite one another. When the API is unavailable, execute without the lock rather than blocking; this accepts a small lost-update risk for a single-user, short-running operation.

Persist two versioned localStorage records. Version suffixes exist so a later format can migrate rather than silently corrupt existing data.

`axon.stacks.v1` is a flat array of stacks, oldest first, whose **last element is the current stack**:

```jsonc
[ [/* oldest retained stack */], [/* ... */], [/* current stack */] ]
```

Eviction removes elements from the front. With history limit `N`, the array holds at most `N + 1` stacks. An empty array is not a valid record; absence of the key is how "no stored data" is represented.

`axon.settings.v1` holds configuration only:

```jsonc
{ "historyLimit": 10 }
```

When a save exceeds the storage quota, drop the oldest history entries and retry, always preserving the current stack. If saving still fails, report the failure explicitly rather than silently treating the execution as persisted.

Malformed stored data must not trigger an automatic reset and must not be replaced by guessed state. Skip execution, render the error in place of the result list, and state that recovery happens through the settings reset. The Settings control must remain reachable in that error state. Only an explicit reset write replaces the stored record.

When localStorage is unavailable rather than merely empty, show that as an error too. Do not fall back to an in-memory session, execute programs, or navigate; without persistence the execution loop has no valid starting point.

The settings modal provides an editor accepting a JSON stack array directly, such as `[["S", {"targets": [], "focus": []}]]`, without an extra object wrapper. Validate each supplied value through the core's `parse`: an invalid value yields `E`, and the reset is refused without touching the stored record. A successful reset makes the supplied stack current and pushes the previous current stack into bounded history under the same difference rule; it does not clear history or execute the supplied stack. When the stored record is unreadable, there is no previous current stack to retain, so reset simply writes the new record.

## Fallback UI and settings

The fallback page has a text field at the top containing the current program input. Editing it updates the query and triggers live program execution after a **200 ms keystroke debounce**, rather than waiting for Enter. Each new keystroke restarts that delay. Use the ordinary interpreter and persistence flow, including mutation execution and bounded history; this is not a separate read-only search implementation.

Once the UI is shown, disable automatic result navigation for the remainder of that page load. Live results update the list even when only one complete match exists. Users navigate by clicking a complete result or using its keyboard shortcut. Reloading remains a new initial URL-driven execution under the agreed replay policy, so it can redirect automatically.

Below the field, display matching results sorted by argument-balance groups and then the interpreter's existing fuzzy rank and stable tie order. Indicate which dimensions matched and which arguments were inserted, using each match's `hint.positions` (matched character indices in the target's searchable string) and `hint.scores`. The client renders highlights from that evidence and does not re-run the matcher.

The first ten displayed result rows have navigation shortcuts `1` through `9`, then `0` for the tenth row. Display shortcut labels beside those rows. Shortcuts are active only when focus is outside editable fields. Rows missing required arguments remain non-navigable, including through a shortcut.

Provide a Settings control on the fallback page, opening a modal containing stack history, manual state reset, and history-limit configuration. Persist configuration in localStorage separately from language stack values. Do not reserve a settings URL or bypass normal execution using a parameter such as `view=settings`. Users can reach the fallback page with a query that has no matches or is ambiguous, then open Settings.

Navigation does not apply a client-side scheme allowlist or require an extra confirmation based on the scheme. For an otherwise eligible destination, attempt navigation regardless of scheme and let the browser enforce its own restrictions. This is an explicit user-controlled policy: destinations such as `javascript:` can execute code in the page's context, potentially accessing or modifying localStorage, and some schemes may be refused by the browser. Language acceptance does not guarantee successful browser navigation.

## Bounded history

Retain the current persisted stack and at most **N previous persisted stacks**, with **N defaulting to 10**. The current stack is not counted against N. These snapshots contain the entire returned stack after popping its terminal `R` or `E`.

Retained snapshots are not mutated when preparing or executing later programs. History changes only through adding entries and evicting the oldest entries to enforce its bound, not by popping values from saved stacks.

On first initialization, the current stack is the core's `initialStack()`: one state value with no targets and empty focus. It becomes a historical entry after the first execution that changes the stack, so the first mutation can be undone.

History is a plain list of previous stacks, with no input, timestamp, or origin metadata.

Push the previous current stack into history only when the new current stack differs from it; compare by structural JSON equality. Executions that leave the stack unchanged, such as ordinary searches, therefore add no entry. This deduplication applies to executions, resets, and restorations alike.

Note that execution resumes from only the last value, so a previous stack `[A, B]` becomes a shorter stack such as `[B']`. That differs structurally, so it adds a history entry even when the program changed nothing else.

History is inspected and restored from the settings modal, which lists stacks without descriptive labels. The history-limit setting accepts nonnegative integers; `0` retains only the current stack. Lowering the limit evicts the oldest excess historical entries. Configuration changes do not become language stack values.

Restoration:

- Restores the entire historical persisted stack without extracting or interpreting its language values.
- Does not re-execute the original program or replay navigation.
- Makes the restored stack current and pushes the prior current stack into history under the same difference rule, so restoration is itself reversible while that entry survives eviction.

## Remaining client decisions

- Search-shortcut compatibility testing across browsers.


The language-level precision questions in [dsl.md](dsl.md#10-remaining-precision-questions) remain unresolved by this document.

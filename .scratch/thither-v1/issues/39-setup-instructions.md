# Empty-target-set setup instructions, and `.out` records the state

Type: task
Status: resolved
Blocked by: 36

## Question

Per `browser-client.md` "Fallback UI and settings": while the target set is empty, the page shows setup instructions in place of the result list — both shortcut URL templates (`?q=%s` and `#q=%s` against the page's own origin and path, so the deployed page and a dev server both read correctly) and one example `.set` program in the current `dsl.md` §4.1 form (destination first: `https://github.com/company/{} company git .set`), with a "Try it" that puts the example in the field. They disappear once the target set is non-empty and are not reachable from a dedicated URL, and they are not shown when `loaded` is false.

**How the view learns the target set is empty is decided (ticket 36, decision 2):** `.out`, after popping the terminal, records the `S` left on top as **`register.state`** (absent when nothing is left, e.g. a failed `.load`). Not `.load` — it sees the world *before* the user's tokens; `.out` sees it after a `.set` or `.@`, which is what the page must show. `OutputRegister` becomes `{ terminal, loaded, state }`. This ticket lands that in `browser-env.ts` (fixtures: state after a mutating run reflects the mutation; absent after a failed `.load`) and amends ADR 0007's `.out` bullet; `browser-client.md` and `CONTEXT.md` **Output register** are already amended. The same field supplies the focus chip and any target count the view shows.

TDD under `happy-dom`; fixtures for empty set, non-empty set with no matches, the corrupted-record case (`loaded: false`, no `state`), and the instructions vanishing after a `.set` in the same run.

**Done when** a fresh browser profile opening the page sees the instructions with correct URLs, and they vanish after the first `.set`; `pnpm verify` green.

## Answer

Landed on `ticket/39-setup-instructions`; `pnpm verify` green, 413 tests (+11).

**`.out` records the state** (`src/client/browser-env.ts`). `OutputRegister` is now `{ terminal, loaded, state }`: `.load` clears `state` with the rest of the register; `.out`, after popping an `R`/`E`, records the `S` left on top as `env.state`, or leaves it absent when nothing is (a failed `.load` drains to an empty stack). Fixtures through the interpreter: the state after `<url> company git .set` carries the new target (the run's world, not `.load`'s); after `home .@` it carries the focus; absent after a malformed record; a second run's `.load` clears the first run's state. ADR 0007's `.out` bullet amended (`browser-client.md` and `CONTEXT.md` already said it).

**Setup instructions** (`src/client/view.ts`). `renderView(root, register)` keeps its signature. The results region now reads as the spec does: an `E` strip first (if any), then *either* the instructions (`loaded && state.targets` empty) *or* the match list, then the reset hint when `loaded` is false. So an `E` on an empty set (`git .set` → `invalid_destination`) shows the error **and** the instructions beneath it, and a corrupted record shows the error and hint only. The section is a heading, both shortcut templates as `<dl>` (`?q=%s` "default", `#q=%s` "keeps the input out of request logs"), and the §4.1 example `https://github.com/company/{} company git .set` as `<pre>`; `.setup` styling added to `style.css`.

**"Try it" dropped** (human's call): the instructions are display only; no button, no callback into the field. That removed the only reason to grow `renderView`'s signature.

**Page URL** for the templates is `location.href` with its search and fragment cleared — read as the global, as `main.ts` reads `location`/`history`/`localStorage` — *not* `origin + pathname`, because a `file:` URL's `origin` is the string `"null"`. Tests move the URL with `history.replaceState` (what `main.ts` itself uses); happy-dom enforces same-origin on it, so the fixtures use `${location.origin}/thither/` and pin path preservation and query/fragment dropping.

**Verified live** in headless Chrome against `vite preview` of the built single file: a fresh profile at `/?x=1` renders `http://localhost:4173/?q=%s` and `#q=%s` (the `x=1` dropped); `?q=https://example.com/ home .set` lists the target with no instructions; a blank reload on the same profile stays instruction-free.

Unblocks nothing new (38 and 40 have their own blockers); the frontier stays 38, 40.

### Found while hand-driving: `.save` could write a record `.load` cannot read

Typing the example on the dev server corrupted the store. A pause after `.s` runs `… home .s`; the unbound `.s` parses to `E(missing_operation)`, which `dsl.md` §6 pushes *without unwinding*, sealing the stack over the pending literals: `[S, L[url, home], E]`. `.$` is absorbed, `.out` pops the `E`, and `.save` — "persists the stack as it stands" — wrote `[S, L[url, home]]`. A literal array is never a valid top-level value, so every later `.load` failed with `parse_error` and the page was stuck on the corrupted-record error. Pre-existing (a `?q=home .rn` typo did the same), made trivially reachable by live execution.

**Fix (human's design, second commit):** **`.save` persists only when the register holds an `R`.** The `R` proves `.$` ran and consumed the literals, so the stored stack is loadable *by construction* — no filtering rule. Consequences accepted: a run that ended in an `E` persists nothing (one-line user model: *an error means nothing was saved*); a program that mutates and then errors (`<url> home .set git .set` via URL) commits nothing — §6's "not rolled back" holds for the returned stack, the host declines to commit; a stray `.save` typed before the search is now a no-op. The "never an empty one" guard fell out (an `R` implies an `S` beneath). Quota path unchanged (its `E` is produced inside `.save` after the check). Rejected alternative: the core consuming the `L` when an `E` lands, which contradicts §6's explicit `[S, L] + E → [S, L, E]`. `.out` is untouched: after a parse-phase `E` the `S` sits beneath the orphaned `L`, so `state` is absent for that run and the instructions/focus chip are hidden while the error shows (a walk past the `L`, and recording `state` only alongside an `R`, were both considered and declined as extra mechanism). `browser-client.md` `.save` bullet and the malformed-data paragraph, ADR 0007's `.save` bullet amended. Three fixtures: `.s` run leaves the record and the next run `loaded: true`; mutation-then-error persists nothing; stray `.save` writes nothing. Verified live in headless Chrome: `?q=<url> home .s` → error + instructions, record untouched; `.se` same; `.set` → listed; blank reload keeps it. 417 tests.

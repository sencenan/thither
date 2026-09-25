# Empty-target-set setup instructions, and `.out` records the state

Type: task
Status: open
Blocked by: 36

## Question

Per `browser-client.md` "Fallback UI and settings": while the target set is empty, the page shows setup instructions in place of the result list — both shortcut URL templates (`?q=%s` and `#q=%s` against the page's own origin and path, so the deployed page and a dev server both read correctly) and one example `.set` program in the current `dsl.md` §4.1 form (destination first: `https://github.com/company/{} company git .set`), with a "Try it" that puts the example in the field. They disappear once the target set is non-empty and are not reachable from a dedicated URL, and they are not shown when `loaded` is false.

**How the view learns the target set is empty is decided (ticket 36, decision 2):** `.out`, after popping the terminal, records the `S` left on top as **`register.state`** (absent when nothing is left, e.g. a failed `.load`). Not `.load` — it sees the world *before* the user's tokens; `.out` sees it after a `.set` or `.@`, which is what the page must show. `OutputRegister` becomes `{ terminal, loaded, state }`. This ticket lands that in `browser-env.ts` (fixtures: state after a mutating run reflects the mutation; absent after a failed `.load`) and amends ADR 0007's `.out` bullet; `browser-client.md` and `CONTEXT.md` **Output register** are already amended. The same field supplies the focus chip and any target count the view shows.

TDD under `happy-dom`; fixtures for empty set, non-empty set with no matches, the corrupted-record case (`loaded: false`, no `state`), and the instructions vanishing after a `.set` in the same run.

**Done when** a fresh browser profile opening the page sees the instructions with correct URLs, and they vanish after the first `.set`; `pnpm verify` green.

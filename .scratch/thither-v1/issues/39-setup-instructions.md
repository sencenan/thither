# Empty-target-set setup instructions

Type: task
Status: open
Blocked by: 36

## Question

Per `browser-client.md` "Fallback UI and settings": while the target set is empty, the page shows setup instructions in place of the result list — both shortcut URL templates (`?q=%s` and `#q=%s` against the page's own origin and path, so the deployed page and a dev server both read correctly) and one example `.set` program in the current `dsl.md` §4.1 form (destination first: `S https://github.com/company/{} company git .set`). They disappear once the target set is non-empty and are not reachable from a dedicated URL.

Decide where the view learns the target set is empty: the register carries only `terminal`/`loaded`, and an empty-state `.$` yields an `R` with no matches — but so does a non-empty set with a no-match query. Options: expose the loaded state's target count on the register from `.load`, or derive it another way. Prefer the smallest addition to `OutputRegister` and say why on the ticket.

TDD under `happy-dom`; fixtures for empty set, non-empty set with no matches, and the corrupted-record case (`loaded: false` should not show setup instructions).

**Done when** a fresh browser profile opening the page sees the instructions with correct URLs, and they vanish after the first `.set`; `pnpm verify` green.

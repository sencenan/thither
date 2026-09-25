# S2 checkpoint: the skeleton is usable

Type: grilling
Status: resolved
Blocked by: 19

## Question

Human review of the walking skeleton, running locally.

Have the human drive it by hand: set several real targets, navigate with and without arguments, hit an ambiguous query, hit a query with no matches, trigger an error, and reload to confirm replay behaves as the spec intends. Confirm the client has stayed dumb — it reads only the output register, never the returned stack; no `S` extraction, no repair — and that `.load`/`.out`/`.save` are genuinely the operations S4 will deepen rather than something S4 must tear out.

Decide: does the execution flow feel right in the hand, and does anything learned change the S4 or S5 plan?

This checkpoint **graduates the S4 fog patch** on the map into tickets, using ticket 16's architecture: bounded history with eviction and `thither.settings.v1` inside `.save`, quota-exceeded retry inside `.save`, the Web Lock around `execute` in `session.ts`, and whatever of the malformed-data / localStorage-unavailable states the skeleton has not already exercised.

**Done when** the human confirms the skeleton and the S4 tickets exist on the map, wired to their blockers.

## Answer

**Signed off** after the human drove the walking skeleton by hand on the dev server (`pnpm dev`, `http://localhost:5173/`, driven through the URL `?q=` since the live input box is S5). Every case behaved as the spec intends: two `.set`s each rendered the growing target list without navigating (`changed: true`); an incomplete single match (`company`, argument balance −1) rendered a clickable link but did **not** auto-navigate or shortcut-fire; a complete single match (`company myrepo`, Δ 0) auto-redirected via `location.replace`; an ambiguous query (`git`) listed both targets; a no-match query showed "No matches."; a bad destination surfaced `invalid_destination`; a plain reload replayed the persisted targets; and a hand-corrupted `thither.stacks.v1` sealed with `parse_error`, showed the reset hint, and **left the bad record untouched** — no repair, no overwrite.

**Checkpoint decisions:**

- **Flow feels right in the hand** (Q1). No jarring behavior.
- **Rough edges accepted** (Q2): (a) never auto-navigating to a destination with an unfilled `{}` is correct and stays; (b) the "recovery through Settings reset" hint promising a control that only lands at S5 is acceptable for the skeleton — S5's settings modal closes the loop, already in the S5 fog; (c) the all-targets list after a `.set` (trailing empty `.$`) is welcome confirmation, kept.
- **`.load`/`.out`/`.save` are sound** (Q3): S4 deepens them in place; nothing has to be torn out. The client stayed dumb — reads the output register only, never the returned stack.

**Already done by the skeleton, so not ticketed:** the Web Lock around `execute` (already in `session.ts`), malformed-data handling (exercised in the drive), and localStorage-unavailable (`main.ts`'s one `try/catch`).

**S4 fog graduated** into four build tickets — 29 settings + history limit → 30 bounded history + eviction → (31 quota retry, 32 history/reset/restore readers) — and the S4 checkpoint (33, blocked by 30/31/32).

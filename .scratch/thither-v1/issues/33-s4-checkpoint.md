# S4 checkpoint: persistence is durable

Type: grilling
Status: resolved
Blocked by: 30, 31, 32

## Question

Human review of the deepened persistence, running locally.

Have the human drive it by hand: perform a mutation and confirm the previous stack becomes a history entry; perform ordinary searches and confirm they add no entry; drive enough mutations to force eviction at the default limit and at `N = 0`; lower the limit and confirm the oldest excess evicts on the next save; simulate a quota overflow and confirm evict-and-retry then `unknown_error`; and exercise `history()`/`reset()`/`restore()` directly (the modal is S5), confirming a reset/restore that yields `E` leaves the stored record untouched.

Confirm the deepening stayed inside the three host operations — `.save`'s caller (`main.ts`, since ticket 34 collapsed `session.ts` into it) is unchanged — and that nothing S4 built has to be torn out at S5.

Decide: does durable persistence behave as the spec intends, and does anything learned change the S5 plan?

This checkpoint **graduates the S5 fog patch** on the map into tickets, using ticket 16's architecture and ticket 32's readers. Expected to open with a `prototype` ticket on layout and highlight presentation.

**Done when** the human confirms persistence and the S5 tickets exist on the map, wired to their blockers.

## Answer

**Signed off without a hand drive.** The human judged the history implementation simple enough to accept on its fixtures (312 → 332 tests across tickets 29–32) and debug later if it misbehaves. A drive script (A–J: seed, mutation adds an entry, searches add none, eviction at N=10 and N=0, lowering N trims on the next save, quota fill → `unknown_error` with the record untouched, hand revert/clear, corrupted record) was prepared and is kept in the comments below for whoever wants to run it.

**Ticket body was stale on two points, both already decided upstream and not reopened:** there is no evict-and-retry — an over-quota save simply fails with `E(unknown_error)` ([ticket 31](31-quota-exceeded-retry.md)); and the readers are `revertHistory`/`clearHistory`/`importStack`, with import deliberately **unvalidated** — a bad value is written and surfaces as `.load`'s `E` ([ticket 32](32-history-readers.md)).

**Deepening stayed inside the host operations.** `git log` confirms no S4 ticket (29–32) touched `src/client/main.ts`; the only edits since the S2 sign-off are tickets 34 and 35. Nothing S4 built needs tearing out at S5: the modal consumes `readHistory`/`readSettings`/`writeSettings`/`isHistoryLimit` and the three actions as free functions over `StorageArea`.

**Import** is first hand-driven in the S5 modal, not now (no REPL addition).

**S5 graduated** into six tickets, prototype first: [36 prototype](36-prototype-fallback-page.md) → ([37 live execution](37-live-execution.md), [38 highlights and shortcuts](38-highlights-and-shortcuts.md), [39 setup instructions](39-setup-instructions.md)) → [40 settings modal](40-settings-modal.md) (also blocked by 37) → [41 S5 checkpoint](41-s5-checkpoint.md). A throwaway `window.thither` console hook for the drive was proposed and rejected — a checkpoint must run against an unmodified `main.ts`.

## Comments

Drive script (unmodified `main`, `pnpm dev`, DevTools → Application → Local Storage):

| # | Do | Expect |
|---|---|---|
| A | Blank open | `thither.stacks.v1` = `[[S₀]]` |
| B | `?q=https://github.com/company/{} company git .set` | Lists the target, `q` stripped from URL; record has 2 entries |
| C | `?q=company` a few times, reload | Still 2 — searches add no entry |
| D | 11+ mutations (`?q=f1 .@`, `?q=f2 .@`, …) | Caps at 11; oldest fall off the front |
| E | Settings `{"historyLimit":3}`, one `?q=company` | Trims to 4 |
| F | Settings `{"historyLimit":0}`, one search | `[current]` only |
| G | Console: `let i=0; try { for(;;) localStorage.setItem('junk'+i++, 'x'.repeat(1e6)) } catch(e) {}` then `?q=g .@` | `unknown_error: the stack could not be saved: storage is full`; record unchanged. Also try a plain search — a same-length rewrite may fail too. Clean up the `junk*` keys after |
| H | Delete the last entries from the record by hand, blank open | Earlier stack is current |
| I | Delete `thither.stacks.v1`, blank open | Reseeded `[[S₀]]`; settings kept |
| J | Corrupt the record (`[`), open `?q=company` | `parse_error` + reset hint; record untouched |

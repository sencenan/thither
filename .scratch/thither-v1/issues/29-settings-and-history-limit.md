# Introduce `thither.settings.v1` and the history limit

Type: task
Status: open
Blocked by: 20

## Question

Add the `thither.settings.v1` record and the history-limit value that ticket 30's eviction will consume, per `browser-client.md` "Persistence" / "Bounded history".

In scope:

- Make the persistence module (currently `src/client/browser-env.ts`) the sole namer of `thither.settings.v1`, alongside `thither.stacks.v1`.
- `thither.settings.v1` holds configuration only, never language stack values: `{ "historyLimit": 10 }`. Read it with the default `historyLimit` of **10** when the key is absent or malformed.
- Validate `historyLimit` as a **nonnegative integer**; `0` is legal (retain only the current stack). Reject non-integers / negatives back to the default rather than throwing.
- Expose a read path the `.save` deepening (ticket 30) uses to obtain `N`, and a write path the S5 settings modal will later call. No history append or eviction here — this ticket only lands the setting and its value.

**Done when** the settings record round-trips with a validated `historyLimit`, defaults to 10 when absent/malformed, and ticket 30 has a single source for `N`. Fixtures cite `browser-client.md` "Persistence" / "Bounded history".

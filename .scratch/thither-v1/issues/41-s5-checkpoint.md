# S5 checkpoint: the page is usable

Type: grilling
Status: open
Blocked by: 37, 38, 39, 40

## Question

Human review of the full fallback UI, running locally and on a fresh profile.

Drive: open blank on an empty profile and follow the setup instructions to create the first target from the page itself; type queries and watch live execution re-render without navigating; confirm a mutation typed live persists and appears in Settings' history; read highlights against known targets; use `1`–`9`/`0` with focus in and out of the field, on navigable and non-navigable rows; open Settings and revert, clear, import (including a deliberately bad import that surfaces as `.load`'s `E`), and change the limit; confirm nothing on the page auto-navigates once shown.

Confirm `main.ts` is still the only composition root and the register is still the only thing the client reads.

Decide: is the page usable as `browser-client.md` intends, and does anything learned change the S6 plan?

This checkpoint **graduates the S6 fog patch** (`docs/search-shortcut-checklist.md` authoring and the cross-browser `%s` run) into tickets.

**Done when** the human signs off and the S6 tickets exist on the map, wired to their blockers.

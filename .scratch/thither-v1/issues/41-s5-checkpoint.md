# S5 checkpoint: the page is usable

Type: grilling
Status: resolved
Blocked by: 37, 38, 39, 40, 45

## Question

Human review of the full fallback UI, running locally and on a fresh profile.

Drive: open blank on an empty profile and follow the setup instructions to create the first target from the page itself; type queries and watch live execution re-render without navigating; confirm a mutation typed live persists and appears in Settings' history; read highlights against known targets; use `Ctrl+1`–`Ctrl+9`/`Ctrl+0` with focus in and out of the field, on complete and incomplete rows (both open; note whether Ctrl+digit reaches the page at all on a non-macOS browser); open Settings (newest first, click a row to view its JSON) and revert, clear, import (including a deliberately bad import that surfaces as `.load`'s `E`), and change the limit; confirm nothing on the page auto-navigates once shown.

Confirm `main.ts` is still the only composition root and the register is still the only thing the client reads.

Decide: is the page usable as `browser-client.md` intends, and does anything learned change the S6 plan?

This checkpoint **graduates the S6 fog patch** (`docs/search-shortcut-checklist.md` authoring and the cross-browser `%s` run) into tickets.

**Done when** the human signs off and the S6 tickets exist on the map, wired to their blockers.

## Answer

**Signed off** after the human drove the live page (dark themed, served from the built
`dist/index.html`) through empty-profile setup, live execution without navigation, a live mutation
that persisted and showed in Settings, highlights, the Settings actions (revert/clear/import/limit),
and the `?`/gear controls. The code-facts held: `main.ts` is the only composition root, and the
client reads only the register.

The drive surfaced fixes that landed as their own tickets rather than blocking sign-off:
[46](issues/46-probe-port-and-scheme.md) (`{}`-port destinations), [47](issues/47-s5-drive-ui-polish.md)
(Escape-clears / sticky summary / row args), [48](issues/48-help-modal-and-larger-controls.md) (Help
modal + SVG controls), and [49](issues/49-dark-theme-and-branding.md) (dark theme, colour-coded
results, wordmark).

**`Ctrl+digit` reachability on non-macOS was not exercised** (the drive was on macOS) and carries
into S6 as ticket 51's explicit question. No auto-navigation once the page was shown, as specified.

**S6 fog graduated** into [50 Author the search-shortcut checklist](issues/50-author-shortcut-checklist.md)
→ [51 Cross-browser verification + `Ctrl+digit` fallback decision](issues/51-cross-browser-verification.md)
→ [52 S6 checkpoint](issues/52-s6-checkpoint.md).

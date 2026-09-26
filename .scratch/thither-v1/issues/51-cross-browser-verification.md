# Run the checklist across browsers; decide the `Ctrl+digit` fallback

Type: task
Status: open
Blocked by: 50

## Question

Run ticket 50's checklist across the target browsers (at least Chrome, Firefox, Safari on the
OSes available) against the live Pages deployment, and record the results.

Two questions to settle from the run:
1. Does `%s` substitution of `#`, `&`, and `+` behave as `browser-client.md` expects in each
   browser/shortcut form? Record any that mangle input and whether `#q=` vs `?q=` differs.
2. **Does `Ctrl+digit` reach the page** on Windows/Linux Chrome and Firefox, where `Ctrl+1`–`9`
   are browser-reserved tab switches (macOS reserves `Cmd+digit`, leaving `Ctrl` free)? If it
   does not, choose a fallback modifier (ticket 36, decision 5) and file the follow-up.

HITL: a human drives real browsers. Records findings on the ticket; any code change (a fallback
modifier) is a follow-up ticket, not this one.

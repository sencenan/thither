# Author the search-shortcut checklist

Type: task
Status: open
Blocked by:

## Question

`browser-client.md` references `docs/search-shortcut-checklist.md` (currently a dangling link).
Write it: the hand-verification steps for registering Thither as a browser search shortcut and
exercising `%s` substitution, so ticket 51 has a concrete script to run across browsers.

Cover at least:
- registering both shortcut forms (`?q=%s` and `#q=%s`) in a browser;
- inputs that stress `%s` encoding: `#`, `&`, `+`, spaces, and a full URL argument (for `.set`);
- what correct vs. broken substitution looks like (the client cannot distinguish a
  browser-split parameter from a typed character — `browser-client.md` "Search-shortcut contract");
- the `Ctrl+digit` reachability check per browser/OS (feeds ticket 51's fallback decision).

Doc-only; no code. `pnpm verify` stays green.

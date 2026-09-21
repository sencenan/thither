# Enable GitHub Pages and deploy

Type: task
Status: open
Blocked by: 20, 21

## Question

Get the built page live at a stable public URL on GitHub Pages for `sencenan/thither`. This is the manual, account-bound work that the deploy workflow cannot do for itself.

The agent drives what it can: confirming the workflow authored in ticket 02 still matches the build, cutting the first `v*` tag that triggers it (per [ADR 0004](../../../docs/adr/0004-publish-by-tag.md), a merge to `main` publishes nothing), and reading its logs. The human does the parts requiring repo settings — enabling Pages, selecting the GitHub Actions source, and granting the workflow its `pages` and `id-token` permissions if not already set. Hand them a precise checklist rather than a description; consult the `wizard` skill if the steps are fiddly enough to justify a script.

Record on this ticket, because later tickets depend on them: the live URL, the two search-shortcut templates filled in with it (`https://<host>/<path>/?q=%s` and `https://<host>/<path>/#q=%s`), and anything about the deploy that differs from what the workflow assumed.

**Done when** the deployed page loads at its public URL, serves the single-file artifact, and executes a program end to end in a real browser — having been published by a tag, which also confirms the tag trigger works.

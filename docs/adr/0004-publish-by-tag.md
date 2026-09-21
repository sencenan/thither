# Publishing to Pages is triggered by a version tag, not by a merge

The deploy workflow runs on a pushed `v*` tag (or a manual dispatch), never on a merge to `main`. The alternatives were deploying every merge, deploying every merge behind a required-reviewer rule on the `github-pages` environment, and fast-forwarding a dedicated `release` branch. Once a user has configured the search shortcut, the live page is their address bar: a bad merge does not break a demo, it breaks the way they open every link. Tagging makes publishing a deliberate act, and records in git exactly which commit is live — something neither the environment gate nor "latest merge wins" gives you.

## Consequences

- `main` can hold merged but unpublished work; the live page is whatever the newest `v*` tag points at, not the head of `main`.
- Continuous integration keeps running on every push and pull request. The gate is on publishing, not on checking, so a red `main` is still caught immediately.
- Releasing requires `git tag vX.Y.Z && git push origin vX.Y.Z`. The manual `workflow_dispatch` trigger stays as an escape hatch for republishing without a new tag.
- During implementation, dogfooding an unfinished page means tagging it. That is intended: a half-built fallback UI reaches the address bar only when its author decides it should.

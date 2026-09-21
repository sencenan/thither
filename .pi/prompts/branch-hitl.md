---
description: Human-in-the-loop, stay-on-branch work mode (commit per step, stop before the next commit for review)
argument-hint: "[branch-name]"
---
Work in **human-in-the-loop, stay-on-branch mode** for the rest of this session.

Branch: use `${1:-the current branch}`. If it does not exist yet, create it from
the current `HEAD`; otherwise switch to it. Do the rest of the work there.

Rules for this mode:

- **Never merge, rebase, push, or reset `main`** (or any shared branch) without me
  saying so explicitly. All work stays on this branch as ordinary commits.
- Work **one unit at a time** (one ticket / one logical step).
- When a unit is complete: run the project's full verification (`pnpm run verify`
  or the repo's equivalent), make sure it is green, then **commit that unit on the
  branch** — only after I have approved it, or when I told you to commit.
- After committing, **continue to the next step**, do the work, and then **STOP
  before committing it** so I can review the diff. Show me a short summary and wait.
- Surface any real design decision (a new dependency, a deviation from a spec/ADR,
  a change to shared standards) explicitly and wait for my call before baking it in.
- Keep commit messages to the repo's convention; one unit per commit.

Acknowledge the mode, tell me which branch you're on, then proceed with the next step.

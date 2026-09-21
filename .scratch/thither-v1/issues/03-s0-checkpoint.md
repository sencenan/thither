# S0 checkpoint: the harness is trustworthy

Type: grilling
Status: resolved
Blocked by: 02

## Question

Human review of the scaffold before any Thither code is written. Does the toolchain match what the next twenty tickets assume?

Walk the human through: the installed dependency set and pinned versions, the source layout and why the core/client split falls where it does, the strictness settings actually in effect, the scripts, and the deploy workflow as authored. Demonstrate the proven-failing type error and the passing test.

Decide: anything to change before S1 starts, and anything discovered here that should amend `docs/code-standards.md`.

**Done when** the human confirms the harness, or the corrections are made and confirmed.

## Answer

Harness reviewed with the human and confirmed trustworthy for S1, with one change applied and one item deferred.

**Verified against what the next twenty tickets assume.** Full `verify` pipeline runs green locally: Biome clean (15 files), both `tsc` passes (`tsconfig.json` + DOM-free `tsconfig.dsl.json`), zero dependency-cruiser violations, 3 invariant tests pass, build inlines to a single `dist/index.html` (1.09 kB). The DOM-free core guard was demonstrated live: injecting `document` into `src/dsl/index.ts` passes the repo-wide pass and fails `tsconfig.dsl.json` with `TS2584`, then reverted clean.

**Decisions:**

- **Q1 — bleeding-edge majors (TypeScript 7, Vite 8, Vitest 5): kept.** The one known sharp edge (dependency-cruiser can't parse TS7) is already absorbed by the `@swc/core` parser. Revisit only if a concrete tool breaks.
- **Q3 â the pi coding agent is removed from `package.json` and moved into `devenv.nix`.** `--no-optional` was ruled out: it would also drop 145 transitive platform-native binaries including `@swc/*`, breaking `lint:boundaries` on CI. Instead `devenv.nix` `enterShell` checks for `pi` and, if absent, runs `pnpm add --global` with `PNPM_HOME` pointed at a repo-local prefix (`.devenv/pnpm-global`, gitignored); only its `bin/` goes on `PATH`. Verified: with `PNPM_HOME` repo-local, pnpm relocates all three global locations (packages, bins, store) under `.devenv/`, so the host's `~/Library/pnpm` is never touched — no host global pollution. `PNPM_HOME` is scoped to the install line, not exported shell-wide, so the project's ordinary `pnpm install` keeps using the shared host store. `pi --version` runs at runtime with only the bin dir on `PATH`. `pnpm install` dropped 111 packages; lockfile no longer mentions the agent; `verify` still green.
- **Q4 — pre-commit weight: kept as-is.** Full typecheck + boundaries + test on every commit is fine at 3 tests. Re-evaluate once the suite is slow enough to discourage small commits (flag carried at a later checkpoint).
- **Q5 — `docs/code-standards.md` amended.** Added a "How the boundaries are enforced" note under Tool-enforced covering (a) the two-tsconfig DOM-free mechanism and (b) the `@swc/core` parser workaround for dependency-cruiser under TS7, so these load-bearing choices aren't buried only in `.cjs`/config comments.

**Deferred to the human (Q2):** CI's pnpm version resolution is unverified. `package.json` sets `devEngines.packageManager` but no top-level `packageManager` corepack field, and `pnpm/action-setup@v4` resolves from that field or an explicit `version:` input — neither is present. This could not be checked locally. The human owns confirming CI runs green on a real runner (likely adding a top-level `packageManager` field or a `version:` to the action) before relying on the pipeline. Not a map ticket.

**No merge performed** — held for HITL per the working instruction.

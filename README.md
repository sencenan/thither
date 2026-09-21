# Thither

Thither helps people navigate quickly to known web destinations using short dimensions and optional
arguments, rather than searching history, bookmarks, or open tabs. It ships as a single
self-contained `index.html` driven from the browser's address bar through a search shortcut.

This file is the developer's entry point. What the thing *is* and what it *must do* live elsewhere:

| Document | What it holds |
| --- | --- |
| [CONTEXT.md](CONTEXT.md) | The glossary. Use these words in code, tests, and commits. |
| [docs/dsl.md](docs/dsl.md) | Normative language specification: values, operations, errors. |
| [docs/browser-client.md](docs/browser-client.md) | Normative browser-client contract: input, execution flow, persistence, UI. |
| [docs/adr/](docs/adr/) | Decisions that bind implementation, with their reasons. |
| [docs/code-standards.md](docs/code-standards.md) | How to write code here. Read before editing source. |
| [.scratch/thither-v1/map.md](.scratch/thither-v1/map.md) | The implementation plan: what is built, what is next. |

The specs are the source of truth. If code and spec disagree, that is a bug in one of them — fix the
spec in the same commit, or fix the code.

## Status

Early. The toolchain, layout, and CI are in place; the language core is stubbed, not implemented.
`src/dsl/index.ts` exports the four specified symbols, and calling them raises an invariant naming
the ticket that will implement them.

## Setup

Requires Node 24+ and pnpm 11+ (`corepack enable pnpm` if you have neither).

```bash
pnpm install
```

This also installs the Husky pre-commit hook, which runs lint-staged, `typecheck`,
`lint:boundaries`, and `test` before every commit.

## Commands

| Command | What it does |
| --- | --- |
| `pnpm dev` | Vite dev server with hot reload. |
| `pnpm test` | Run the Vitest suite once. |
| `pnpm test:watch` | Vitest in watch mode. |
| `pnpm typecheck` | `tsc --noEmit` over the repo, then again over the DOM-free core. |
| `pnpm check` | Biome format, lint, and import-order check. |
| `pnpm check:fix` | The same, writing fixes. |
| `pnpm lint:boundaries` | dependency-cruiser: import direction, entry points, cycles. |
| `pnpm build` | Build `dist/index.html`. |
| `pnpm verify` | All of the above in CI order. Run this before opening a PR. |

dependency-cruiser cannot use TypeScript 7 yet, so `@swc/core` is installed as its parser. Type-only
imports are still caught.

## Layout

```
src/dsl/       the language core — implements docs/dsl.md, no DOM, no persistence
src/lib/       utilities with no client knowledge
src/client/    the browser client — implements docs/browser-client.md
docs/          specifications, ADRs, standards, research notes
.scratch/      the implementation map and its tickets
```

Imports flow one way: `client → dsl`, `client → lib`, `dsl → lib`. `lib` imports neither. Inside
each area, **root files are the public surface**; `lib/` holds implementation and `tests/` holds
tests, and neither is importable from another area. `src/dsl` has exactly one entry point,
`index.ts`, exporting exactly the four symbols `browser-client.md` names — adding an export there is
a specification change.

Two tools hold this, so it cannot drift: `tsconfig.dsl.json` compiles the core without the `DOM`
lib, making `localStorage` a type error inside `src/dsl`, and `.dependency-cruiser.cjs` enforces the
directions above. Both have been observed failing on a deliberate violation.

## Deployment

Merging to `main` publishes nothing. The live page is whatever the newest `v*` tag points at, per
[ADR 0004](docs/adr/0004-publish-by-tag.md):

```bash
git tag v0.1.0 && git push origin v0.1.0
```

`.github/workflows/ci.yml` runs the checks on every push and pull request, and uploads the built
page as an artifact so a build can be inspected without publishing it.
`.github/workflows/deploy.yml` runs those same checks, then builds and deploys to GitHub Pages on a
tag or a manual dispatch. GitHub Pages is not yet enabled for this repository.

## Working on a ticket

Work comes from [the implementation map](.scratch/thither-v1/map.md). Branch `ticket/NN-slug` off
`main`, merge with `--no-ff`, and land the code, the ticket's `## Answer`, and the map's
Decisions-so-far line in one commit, so the tree and the map agree at every point in history.

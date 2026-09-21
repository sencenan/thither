# Scaffold the toolchain

Type: task
Status: resolved
Blocked by: 01

## Question

Stand up the project skeleton so that a test can be written, a type error can be caught, and a page can be built and deployed. Nothing in this ticket implements Thither behaviour.

Per `browser-client.md`: vanilla TypeScript with no UI framework, Vite with `vite-plugin-singlefile`, a separate `tsc --noEmit` type-check step, Vitest, the npm `fzf` port as a pinned ordinary dependency, and a GitHub Actions workflow that builds and deploys to Pages.

Everything tool-enforceable is specified in [docs/code-standards.md](../../../docs/code-standards.md) under "Tool-enforced"; wire up that table exactly.

Scope:

- pnpm install of Vite, Vitest, TypeScript, `vite-plugin-singlefile`, `fzf`, `@biomejs/biome`, `dependency-cruiser`, and Husky + lint-staged (use the `setup-pre-commit` skill). Pin versions; record the `fzf` version explicitly since the research note calls out port-vs-upstream drift.
- `biome.json` with the formatter and linter settings from the standards table, organize-imports included in `biome check`.
- Two tsconfigs: the strict base, and one for `src/dsl` whose `lib` **omits `DOM`**. Prove the second bites by confirming `localStorage` fails to typecheck inside `src/dsl`.
- `dependency-cruiser` config enforcing `client → dsl`, `client → lib`, `dsl → lib`, root-files-only imports, and no cycles. Prove it bites: a deliberate deep import must fail `lint:boundaries`, then pass again once reverted. The `setup-ts-deep-modules` skill has a working config and the proving procedure, though this repo uses `src/<area>` rather than `src/packages/<name>`.
- `src/dsl`, `src/lib`, `src/client` created with the `lib/` and `tests/` subfolder shape. `src/dsl/index.ts` exists as the core's single entry point, exporting the four specified symbols.
- `package.json` scripts for `dev`, `build`, `test`, `typecheck`, `check` (Biome), `lint:boundaries`, and one umbrella script running them all.
- The `invariant()` helper, since every `src/dsl` ticket depends on it existing.
- One trivial passing test and one deliberate type error verified to fail, so the harness is proven rather than assumed.
- `.github/workflows/` build-and-deploy workflow authored. Do **not** enable Pages in repo settings here; that is a separate HITL task at S3.
- Any tooling enforcement decided in 01 (pre-commit hooks, CI checks).

**Done when** the umbrella script runs clean from a fresh install, both the DOM-free tsconfig and the boundary rules have been observed failing on a deliberate violation and passing after reverting it, and the workflow file is committed.

## Answer

The scaffold is in place and proven. `pnpm run verify` (`check` → `typecheck` → `lint:boundaries` → `test` → `build`) runs clean after `rm -rf node_modules && pnpm install --frozen-lockfile`.

**Dependencies, all pinned exactly** (no ranges): runtime `fzf@0.5.2` (the `ajitid/fzf-for-js` port — recorded here because the research note calls out port-vs-upstream drift); dev `vite@8.3.0`, `vite-plugin-singlefile@2.3.3`, `vitest@5.0.1`, `typescript@7.0.2`, `@biomejs/biome@2.5.14`, `dependency-cruiser@18.4.0`, `@total-typescript/shoehorn@0.1.2`, `husky@9.1.7`, `lint-staged@17.5.1`, `@swc/core@1.16.2`.

**`@swc/core` is an unplanned dependency, and it earns its place.** `dependency-cruiser@18.4.0` accepts `typescript >=2 <7` and simply cannot parse `.ts` under `typescript@7`: before swc it cruised **0 modules** and reported "no violations" — a green light that checked nothing, the worst possible failure mode for a boundary tool. swc is its parser only; type-only imports are still detected (proven below), because swc keeps `import type` statements in the AST. The alternative was downgrading the product's compiler to satisfy a lint tool, which is the wrong way round. The config sets `parser: "swc"` and deliberately omits `tsConfig` and `tsPreCompilationDeps`: without a usable `tsc` those two options do nothing except trigger dependency-cruiser's `missing-typescript-transpiler` warning. Revisit when dependency-cruiser supports TypeScript 7, or if path aliases ever appear in a tsconfig.

**Layout.** `src/dsl/index.ts` exports exactly `emptyProgram`, `parse`, `execute`, `initialStack`, with `Program` and `Stack` as deliberately opaque `readonly unknown[]` placeholders until ticket 04 designs the value model; the three functions call `invariant(false, …)` naming the ticket that implements them, so an accidental early caller fails loudly rather than getting a plausible empty value. `src/lib/invariant.ts` is the single sanctioned throw site — a plain `Error` with an `INVARIANT_PREFIX`, not an `Error` subclass, because the standards rule out classes. `src/client/main.ts` is a placeholder page body. `src/lib/tests/invariant.test.ts` is the trivial passing suite (3 cases, including one that exercises the `asserts` narrowing).

**Two tsconfigs.** `tsconfig.base.json` holds the strictness table; `tsconfig.json` adds `DOM` and covers the repo; `tsconfig.dsl.json` includes only `src/dsl` with `lib: ["ES2022"]`, and the files it imports from `src/lib` are pulled into that program, so a DOM-using utility cannot leak into the core either. `typecheck` runs both. One addition to the standards table was needed and is recorded there: `allowImportingTsExtensions`, since `module: "preserve"` alone still rejects the `.ts` import specifiers this repo writes.

**Enforcement.** Husky `pre-commit` runs lint-staged (`biome check --write` on staged files), then `typecheck`, `lint:boundaries`, and `test`. `.github/workflows/ci.yml` runs the same five steps on push and PR; `.github/workflows/deploy.yml` calls it as a reusable workflow, then builds and deploys to Pages with `pages`/`id-token` permissions and a non-cancelling `pages` concurrency group. It triggers on a pushed `v*` tag or a manual dispatch, **not** on a merge to `main` — see [ADR 0004](../../../docs/adr/0004-publish-by-tag.md), decided while reviewing this ticket. Pages is **not** enabled in repo settings — that stays ticket 22.

**Proofs run (each failed on the violation, passed after reverting):**

- **DOM-free core.** Adding `localStorage.getItem(…)` to `src/dsl/index.ts`: the repo-wide pass accepted it, the dsl pass gave `error TS2304: Cannot find name 'localStorage'`.
- **Boundaries.** A `src/client/main.ts → src/dsl/lib/probe.ts` import tripped both `dsl-entry-point-only` and `area-internals-are-private`; re-running it as `import type` tripped both again, confirming swc does not silently drop type-only edges; a `src/dsl → src/client` import tripped `core-imports-no-client`.
- **Type error.** A `const count: number = "not a number"` file gave `error TS2322` and failed `typecheck`.

**Deferred deliberately:** the single-file output check (ticket 21 — the plugin is wired and `dist/` is one `index.html` today, but nothing yet asserts it), Vitest DOM environment (no client tests exist yet; `environment: "node"` until ticket 17 needs otherwise), and the `.vscode/` folder, excluded from Biome rather than reformatted since it is editor-local.

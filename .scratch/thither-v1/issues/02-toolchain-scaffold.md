# Scaffold the toolchain

Type: task
Status: open
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

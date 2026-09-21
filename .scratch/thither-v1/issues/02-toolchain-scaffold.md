# Scaffold the toolchain

Type: task
Status: open
Blocked by: 01

## Question

Stand up the project skeleton so that a test can be written, a type error can be caught, and a page can be built and deployed. Nothing in this ticket implements Thither behaviour.

Per `browser-client.md`: vanilla TypeScript with no UI framework, Vite with `vite-plugin-singlefile`, a separate `tsc --noEmit` type-check step, Vitest, the npm `fzf` port as a pinned ordinary dependency, and a GitHub Actions workflow that builds and deploys to Pages.

Scope:

- pnpm install of Vite, Vitest, TypeScript, `vite-plugin-singlefile`, `fzf`, plus whatever ticket 01 selected for formatting and linting. Pin versions; record the `fzf` version explicitly since the research note calls out port-vs-upstream drift.
- `tsconfig.json` matching the strictness decided in 01; `package.json` scripts for `dev`, `build`, `test`, `typecheck`, `format`, `lint`.
- Source layout implementing 01's module conventions, with the core and the client in separate directories so the core stays client-agnostic.
- One trivial passing test and one deliberate type error verified to fail, so the harness is proven rather than assumed.
- `.github/workflows/` build-and-deploy workflow authored. Do **not** enable Pages in repo settings here; that is a separate HITL task at S3.
- Any tooling enforcement decided in 01 (pre-commit hooks, CI checks).

**Done when** `pnpm test`, `pnpm typecheck`, and `pnpm build` all run clean locally from a fresh install, and the workflow file is committed.

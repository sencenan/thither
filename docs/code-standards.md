# Code standards

Rules for writing code in this repo. Read before adding or editing source.

Config files are the source of truth for anything a tool checks; this document holds the conventions and reasons a tool cannot state. The settings themselves are listed once under [Tool-enforced](#tool-enforced) so the scaffold can wire them up.

## Working mode

Unless the human explicitly says otherwise, do all coding work in the **human-in-the-loop, stay-on-branch mode** defined by [`.pi/prompts/branch-hitl.md`](../.pi/prompts/branch-hitl.md): work on a `ticket/NN-slug` branch, one unit at a time, run `pnpm run verify` before committing, and **stop before each commit to let the human review the diff**. Never merge, rebase, push, or reset a shared branch without an explicit instruction. Only depart from this mode when the human names a different mode for the session.

## Layout

```
src/dsl/      the language core — implements docs/dsl.md
src/lib/      utilities with no client knowledge
src/client/   the browser client — implements docs/browser-client.md
scripts/      developer tools run directly by Node (`pnpm repl`); never bundled
```

`scripts/` is outside `src`, so the import-direction rules do not apply to it; it may import the core through `src/dsl/index.ts` and use Node APIs. It has its own `scripts/tsconfig.json` (`types: ["node"]`, no DOM), placed inside the folder because editors resolve the nearest `tsconfig.json` per file, and `typecheck` runs it as a third pass. Relative imports carry their `.ts` extension everywhere: Node's ESM loader does no extension guessing, so this is what lets `node scripts/repl.ts` load the real core with no build step.

Imports flow one way: `client → dsl`, `client → lib`, `dsl → lib`. `lib` imports neither.

**`src/dsl` compiles without the DOM.** Its `tsconfig` omits the `DOM` lib, so `localStorage`, `document`, and `window` are type errors there. This is ADR-0001's client-agnostic core, held by the compiler instead of by memory.

The core may use *universal* platform globals — ones present in every JavaScript runtime (browser, Node, workers), such as the WHATWG `URL` — because they do not tie the core to a client. Omitting the `DOM` lib drops their types along with the client-only ones, so re-supply just the needed surface with a **module-scoped** `declare const` in the module that uses it, never by widening the core's `lib` (which would re-admit `localStorage`/`document`/`window`). Being module-local, the declaration shadows nothing and does not collide with the repo-wide DOM pass. `src/dsl/utils.ts`'s `declare const URL` is the reference example.

Inside each area the **root files are the public surface**; `lib/` holds implementation and `tests/` holds tests. Import a module through its root files.

The core has one more internal folder, `src/dsl/operations/`: one file per language operation (`set.ts`, `rm.ts`, and so on), each exporting a single `OpFn` under the operation's name, with its own `tests/` beside it. Operations are wired into the environment by the core's root files and are as private to `src/dsl` as `lib/` is: nothing outside the core imports them.

`src/dsl` has exactly one entry point, `index.ts`, exporting the surface `browser-client.md` specifies: `createInterpreter`, `defaultEnv`, and `emptyState`, plus the types those need. Everything else — appending items and executing — hangs off the `Interpreter` those return. That file *is* the core's documented interface, so adding an export to it is a specification change — amend `browser-client.md` in the same commit or don't add it. This is the only barrel in the repo; elsewhere, expose several small root files rather than re-exporting a subtree. (The surface diverged from an earlier four-symbol shape when the operation set became a client-extensible environment — see [ADR 0005](adr/0005-extensible-interpreter-environment.md).)

The whole language type algebra lives in one file, `src/dsl/types.ts`, so a developer reads the vocabulary in one place. `index.ts` re-exports from it; no other module redefines a core type.

File names are kebab-case: `match-ordering.ts`, `destination-template.ts`.

## Types

Model data with `type` and `interface`. Behaviour lives in functions that take their dependencies as parameters.

Enums are fine, including `const enum`. The one form to avoid is the **ambient** `declare const enum`: `isolatedModules` rejects it, because a transpiler compiling one file at a time has no way to read its values. Note also that an exported `const enum` loses its inlining across a module seam for the same reason — esbuild emits an ordinary enum object — so reach for it for local clarity, not for speed.

Discriminate a tagged union on element 0 of a `["sigil", body]` tuple, the shape the wire values (`S`, `R`, `E`) already take. Parsed program items reuse it, so every discriminated value in the core shares one style and reads like the persisted JSON. Do not introduce a `kind`/`type` discriminant field where a sigil tuple does the job; and keep the field name `type` for domain data only (an `E` payload's error category), never as a structural tag.

At every edge where untrusted input arrives, type the input `unknown` and narrow it. That is the whole contract of `Interpreter.pushToken`: it accepts any string or object and answers with a value. Reach for `@total-typescript/shoehorn` when a test needs partial data.

Mark core data `readonly`, including `ReadonlyArray`, and return new values rather than editing arguments. The carve-outs are the evaluator's working `Stack`, a mutable array an `OpFn` edits in place (and returns for convenience) because a stack machine is naturally imperative, and the `Program`, which `pushToken` appends to in place. Its safety rests on the *values* it holds — `S`, `R`, `E`, `L` — staying `readonly`, so nothing a client persists can be mutated through the stack. Deep-freeze fixtures in tests so an accidental mutation fails loudly there instead of silently corrupting a persisted snapshot in the browser.

## Interfaces

Design an interface from the caller inward: state the signature a caller wants, then make the implementation meet it. The reverse — building the mechanism and exporting whatever it happened to need — is how leaked parameters and awkward return types get in, and no amount of explanatory prose repairs them afterwards.

**Return the narrowest concrete type.** `validateState` returns `State | undefined`, never a union widened to cover a sibling's result. A function returning something broader than its name promises is a lie by widening, and every caller pays for it in narrowing.

**An alias must be clearer than what it aliases.** `State | Result | ThitherError` reads better than a name like `Envelope`, so that alias is not worth its indirection. Name a union only when the name carries meaning its members do not.

**Keep total transforms separate from partial validation.** A transform that cannot fail must not return `T | undefined` because a validity check was fused into it: that failure mode then propagates to every caller, including the ones that cannot fail. Split them — a predicate (`isValidDimension`) run at the edge where input is untrusted, and a total transform (`normalizeDimension`) everyone else uses freely. The parser validates then normalizes; the matcher only normalizes, and inherits no `undefined` to handle.

**No leaked parameters.** If the callee only merges two parameters and never branches on the difference, the difference belongs to the caller. Detector: does the body *use* the distinction, or immediately erase it? The matcher took a `focus` argument used solely for `[...focus, ...explicit]`, importing a state concept into a matching primitive for no gain; callers now merge, and the matcher takes one flat list.

**A name tracks its responsibility, and changes in the same commit the responsibility does.** `normalization.ts` became `dimension.ts` when it gained validation.

## Failure

`src/dsl` answers with values. A malformed token, an invalid envelope, a bad destination, an ambiguous `.set` — each becomes an `E` value per `dsl.md` §6, and evaluation continues or stops as the spec says.

One exception: an unreachable state, the kind the types say cannot happen. Route those through a single `invariant()` helper, so `grep -rn "throw" src/dsl` finds exactly one file and the totality guarantee stays checkable.

## Tests

Vitest, in each module's `tests/` subfolder, importing through root files.

Write table-driven fixtures whose case names cite the spec section they enforce:

```ts
// "§4.4 inferred separator: longest prefix wins over first unique match"
```

The worked programs of `dsl.md` §7 are golden end-to-end cases and must produce exactly the stacks that document shows.

## Comments and names

Every comment is a second thing to keep in sync with the code, and it rots the moment they disagree. Before writing one, try to delete it by changing the code instead.

A comment has to survive all four questions to earn its place:

1. **Does the code already say this?** A paraphrase of the line below it (`// trim, then lowercase` over `raw.trim().toLowerCase()`) is duplication. Delete one of them.
2. **Does the *type* already say this?** Totality, nullability, immutability, and what a function returns are the signature's job. If the type does not say it, fix the type rather than annotating around it.
3. **Is this arguing *why this design over another*?** That belongs in the ticket answer or an ADR, which are durable and reviewable. Source states the design; it never defends it.
4. **Is this the plan rather than the spec?** Ticket numbers and restated seam maps ("knows nothing of the stack") go stale and are recorded elsewhere already — the import list proves the second claim better than a sentence does. Cite `dsl.md §N`, never a ticket number.

What survives is the *why* the code cannot state: the trap avoided, the rule that looks wrong but is specified, an ordering dependency, a policy choice the code under-determines.

**Comment pressure is a design smell.** If a signature needs a paragraph to explain it, the signature is wrong — fix it instead, and the paragraph disappears with it. A module whose comments outweigh its code is under-designed or over-explained; treat that ratio as a review trigger, not a target to game.

Domain types are the exception that proves the rule: the dsl's type algebra lives in one file, `src/dsl/types.ts`, so a developer can read the whole vocabulary in one place. Keep its comments to the few distinctions the types genuinely cannot carry.

Identifiers use `CONTEXT.md` vocabulary exactly — dimension, target, destination template, focus, match, argument balance, fallback page — and avoid the synonyms that glossary lists under `_Avoid_`. A concept missing from the glossary is a signal: either the name is invented, or the glossary has a gap worth filling.

## Commits

Work each ticket on `ticket/NN-slug`, branched from `main`. Merge with `--no-ff`, so every ticket stays a visible unit of history.

A ticket's code, its `## Answer`, and the map's Decisions-so-far line land in the same commit: the tree and the map then agree at every commit.

Merging publishes nothing. The deployed page is whatever the newest `v*` tag points at, per [ADR 0004](adr/0004-publish-by-tag.md); release with `git tag vX.Y.Z && git push origin vX.Y.Z`.

## Tool-enforced

| Rule | Tool | Setting |
| --- | --- | --- |
| Formatting | Biome | `indentWidth: 2`, `lineWidth: 100` |
| Linting | Biome | `preset: "recommended"` (the 2.5 spelling of `recommended: true`), plus `noExplicitAny`, `noNonNullAssertion`, `noDefaultExport` as errors |
| Import order | Biome | organize-imports on, run by `biome check` |
| Enforcement points | Husky + lint-staged, CI | `biome check` at commit and in CI |
| Type strictness | tsc | `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noUnusedLocals`, `noUnusedParameters`, `verbatimModuleSyntax`, `isolatedModules`, `module: "preserve"`, `target: "ES2022"` |
| Import paths | tsc | `allowImportingTsExtensions`: relative imports carry their `.ts` extension |
| DOM-free core | tsc | `src/dsl` tsconfig omits the `DOM` lib |
| Import direction | dependency-cruiser | `client → dsl`, `client → lib`, `dsl → lib`; root files only (`lib/`, `tests/`, `operations/` fenced); no cycles |

Two rules have no tool behind them, so they hold by review: **no classes**, and **no `as` assertions** outside `as const` and shoehorn's own use.

### How the boundaries are enforced

Two mechanisms above have non-obvious wiring worth knowing before you touch the config:

- **DOM-free core = a second tsconfig, not a flag.** `typecheck` runs `tsc` twice: `tsconfig.json` checks the whole repo with the `DOM` lib present, and `tsconfig.dsl.json` re-checks `src/dsl` alone with a `lib` that omits `DOM`. A `document`/`window`/`localStorage` reference in the core passes the first pass and fails the second with `TS2304` (cannot find name). Any `lib` utility the core imports is pulled into the DOM-free program too, so a DOM-using helper cannot leak in through `src/lib`.
- **dependency-cruiser parses with `@swc/core`, not `tsc`.** dependency-cruiser accepts TypeScript `>=2 <7`, so it cannot use this repo's TypeScript 7; `@swc/core` is its parser instead. swc keeps `import type` in the AST, so type-only edges are still cruised. The `tsConfig` and `tsPreCompilationDeps` options are deliberately left unset (inert without a usable `tsc`, and setting them only triggers a missing-transpiler warning). Revisit when dependency-cruiser supports TypeScript 7, or if the repo grows tsconfig path aliases.

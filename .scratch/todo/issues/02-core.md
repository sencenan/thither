# Implement the todo list in the core

Type: task
Status: ready-for-agent
Blocked by: 01

## Question

Implement `dsl.md` §1, §2, §4.6–§4.8, and §6 as amended by ticket 01, test first ([tdd]), in `src/dsl`.

- **`types.ts`**:
  - `State` gains `readonly todo: readonly Template[]`. Use whatever name ticket 01 gives the item type; a URL is a `Template` of arity 0.
  - Add the envelope `TodoList = readonly ['D', { readonly todo: readonly Template[] }]`.
  - `Token` and `StackValue` include it.
- **`parser.ts`**:
  - A supplied `S`'s `todo` defaults to `[]`, and each entry is validated as a placeholder-free URL with no duplicates.
  - A supplied `D` is validated the same way, and unknown fields are dropped.
- **`utils.ts` `push`**: the stack is sealed on `D` as on `R`/`E`.
- **`interpreter.ts`**: `case 'D'` pushes like `S`/`R`/`E`.
- **`emptyState()`**: `todo: []`.
- **New `operations/todo.ts` and `operations/done.ts`**: each peeks the state and pops `L`, per §4.7/§4.8. On failure, put `S` back beneath the `E` (§6). Wire both into `env.ts` `defaultEnv`.
- **`operations/merge.ts`**: concatenate the todo lists, keeping the first occurrence.
- **Tests**:
  - Table fixtures citing §4.7/§4.8/§4.6/§2.
  - The §7 worked program as a golden through the barrel.
  - A sealed-stack case: `https://a .todo .$` ends `[S', D]`.
  - Extend the totality property's alphabet with `.todo`/`.done`.
- **`index.ts`**: export the new envelope type. This is a specification change; it's covered by ticket 01's `browser-client.md` amendment.

**Done when** `pnpm run verify` is green, and `grep -rn throw src/dsl` still finds only the invariant helper.

[tdd]: ../../../.agents/skills/tdd/SKILL.md

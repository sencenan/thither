# Implement the todo list in the core

Type: task
Status: resolved
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

## Answer

- **State is always complete.** `State.todo` is required, and the parser repairs a missing `todo` to `[]` (human call: option (a), with repair on parse). So every stored state gains `todo: []` on its first save after release.
- **Types:**
  - `TodoList = ["D", { todo }]` joins `Token` and `StackValue`, and is exported from `index.ts`.
  - `push` seals on `D`, and the evaluator pushes a supplied `D`.
- **Parser:** `S.todo` and `D.todo` are validated by `isTodoItems`: strings, untrimmed whitespace refused, placeholder-free, no duplicates. A `D` drops unknown fields.
- **Operations:**
  - `.todo` and `.done` share the `utils.ts` helpers `todoItemOf`, `withTodo`, and `todoListOf`, so neither operation imports the other.
  - `.done` with no `L` never takes `S`, so `S` stays beneath the `missing_operand`.
  - `.merge` deduplicates through a `Set` over the concatenation.
- **Bug fixed:** `.set` and `.rm` rebuilt `S` from `{targets, focus, alias}`, which would have dropped the todo list. They now spread `state[1]`.
- **Client and REPL:** only the `S` literals changed, so they still compile: `base-state.ts`, `scripts/repl.ts`, and client tests. `.out` and `.save` are ticket 03.
- **Tests:** `todo.test.ts` and `done.test.ts`, merge todo cases, a "todo list is kept" case in each of set/rm/at/alias, parser cases for `S.todo` and `D`, the §7 "keep and finish a todo item" golden, and `.todo`/`.done`/URL/`D` added to the totality alphabet. 864 tests green.

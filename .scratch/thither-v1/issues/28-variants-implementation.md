# Implement arity-keyed variants, exact-key `.set`, arity-targeted `.rm`

Type: task
Status: ready-for-agent
Blocked by: 27

## Question

Implement the amended `docs/dsl.md` from ticket 27 ([ADR 0008](../../../docs/adr/0008-arity-keyed-variants-and-exact-key-set.md)). Test-first per `docs/code-standards.md`; fixture names cite the new section text.

In scope:

- `src/dsl/types.ts`: `Target` → key + `Template[]`; `State.targets` → `{ [key: string]: Template[] }`; `Match` slot 2 → `key: string`; drop `ambiguous_set` from `ErrorTypes`.
- `src/dsl/parser.ts`: validate/normalize the new `S` shape — keys re-normalized from their dims (trim/lowercase/dedupe/sort/join), duplicate keys after normalization → `parse_error`, each variant validated as a destination, duplicate arity within a target → `parse_error`, variants sorted by arity ascending on the way in. Focus may carry search operators; targets' dims still may not. Update `R` shape check for `m.key`.
- `src/dsl/utils.ts`: a `keyOf(dims)` helper and `arityOf(template)` (move the `split('{}')` count out of `search.ts`).
- `src/dsl/selector.ts`: fzf `selector` returns the key; `Selection.target` becomes the key + variants pair.
- `src/dsl/operations/set.ts`: drop `searchTargets`; ignore focus; exact key lookup; insert / replace-by-arity / add-variant; remove the ambiguity branch.
- `src/dsl/operations/rm.ts`: keep the fzf query with focus; read the suffix — no separator → delete matched targets; separator → arity = suffix length, delete that variant from each matched target, drop emptied targets.
- `src/dsl/operations/at.ts`: remove the operator refusal.
- `src/dsl/operations/search.ts`: per selected target, best fit → one match, else one per variant; `toMatch` takes a key; new comparator (score desc, matcher order, then `0` / `+` asc / `−` by magnitude asc within a target — group rows by key so they stay contiguous).
- `src/dsl/index.ts` / `env.ts`: nothing expected beyond type exports.
- Tests: `operations/tests/{set,rm,at,search}.test.ts`, `tests/{golden,operators,parser,interpreter}.test.ts` rewritten for the new shapes; add the variants golden from §7.
- `src/client/view.ts` + tests: render `m[1]` as the key string (it was a dims array). `session.ts` `decideNavigation` is unchanged (`matches.length === 1 && argDelta >= 0`); confirm with a fixture where one target with two variants and no exact arity yields two matches and does not navigate.
- `src/client/browser-env.ts`: no migration; a stored record in the old shape parses to `parse_error` and is reset by hand (ADR 0008 consequences). Add a fixture pinning that.
- `scripts/repl.ts`: adjust any state printing/usage comment.

**Done when** `pnpm verify` is green, the §7 goldens (including the new variants golden) pass exactly through the barrel, and the REPL walk `https://jira.com jira .set` → `https://jira.com/browse/{} jira .set` → `jira` (one match) → `jira PROJ` (one match) → `jira PROJ x` (two matches) → `jira . x .rm` → `jira PROJ` (one match, `argDelta +1`) behaves as the ADR describes.

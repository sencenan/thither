# Fan out every variant; the client picks the navigable row by `argDelta`

Type: task
Status: resolved

## Question

Build the decision from [44](44-best-fit-hides-other-variants.md): `.$` stops hiding a target's other variants when a best fit exists, and navigation moves from "exactly one match" onto `argDelta`, reproducing today's teleport behaviour exactly (NAV-C).

### Core — `src/dsl/operations/search.ts`

`matchesFor` no longer special-cases the best fit: emit one match per variant, always.

```ts
const matchesFor = (selection: Selection, args: readonly Literal[]): Match[] => {
  const [key, variants] = selection.target;
  return variants.map((template) => toMatch(selection, key, template, args));
};
```

`toMatch`, `orderVariants` (`Δ0` first, then positive ascending, then negative by magnitude), and group ordering by score stay as they are: the best-fit row still leads its target's contiguous group, the siblings follow.

### Client — `src/client/navigation.ts`

`length === 1` is dead. `resolveNavigationDestination(register)` becomes: reject unless the terminal is `R` and `inputs.length > 0`; group `matches` by key (`match[2]`) and reject unless exactly one distinct key (one selected target); then

- if some match has `argDelta === 0` → resolve that row's rendered destination (`match[0]`) — best fit;
- else if `matches.length === 1 && matches[0][4].argDelta > 0` → resolve `matches[0][0]` — single-variant surplus;
- else reject.

This is provably identical to today's `matches.length === 1 && match.argDelta >= 0` on the pre-fan-out `R` (best-fit teleport, single-variant surplus teleport, two targets never, incomplete never); the only visible difference is the siblings now appearing in the rendered list.

### Docs / ADRs / glossary

- **New ADR 0011** "Fan out every variant; the client selects the navigable row by argument balance" — supersedes ADR 0008's `.$`/best-fit bullet ("emit one match for it" → always one per variant) and ADR 0008's "Direct navigation" bullet, and restates ADR 0009's navigation rule (drop "`R.matches` has exactly one entry"; the client's rule is NAV-C over the fanned-out `R`). Record the trade-off: retiring the best-fit *drop* removes a concept, surfaces siblings for free, and keeps navigation behaviour byte-for-byte via the client rule.
- **`docs/dsl.md`** §4.4 (best fit no longer "yields exactly one match"; it is the exact-arity = `Δ0` variant, one row among the target's fanned-out rows), §5 (ordering already covers multi-row output; note the best-fit row leads), §7 (the "Variants of one target" golden and any best-fit golden now show every variant).
- **`CONTEXT.md`** **Best fit** — drop "A target with a best fit yields exactly one match, for that variant; a target without one yields one match per variant"; best fit is the exact-arity variant, distinguished only for ordering and (client) navigation, never suppressing its siblings. Check **Match set** / **Fallback UI** notes read consistently.

### Tests

`tdd`. Update `.$` search fixtures and the §7 goldens to the fanned-out output; add a fixture pinning the ticket's scenario (arity 1 & 2, one argument → both rows, `Δ0` best-fit leads, `Δ-1` sibling follows). Rewrite the `navigation.test.ts` table for NAV-C, pinning: best-fit-with-sibling teleports, single-variant surplus teleports, two matched targets don't, incomplete doesn't, cross-target `Δ0`-only does *not* teleport. Confirm `.rm` is untouched (it never used `matchesFor`).

**Done when** `pnpm verify` is green, ADR 0011 is written and referenced, and the fan-out is confirmed in the REPL (the ticket-44 scenario shows both variants) and on the built page (live-typed `jira PROJ`-style query lists the sibling, address-bar run still teleports).

## Answer

Landed exactly as specified. `pnpm verify` green: lint / typecheck / boundaries / **540 tests** / build.

- **Core:** `matchesFor` (`src/dsl/operations/search.ts`) drops the best-fit branch and maps every variant to a row. `toMatch`/`orderVariants`/group-by-score untouched, so the best fit (`argDelta`-0) still leads its target's contiguous group.
- **Client:** `resolveNavigationDestination` (`src/client/navigation.ts`) is NAV-C — reject unless `R` + non-empty `inputs`; group `matches` by key (`match[2]`) and reject unless one distinct key; then the `argDelta === 0` row (best fit), else a single-variant `argDelta > 0` row (surplus), else reject. Provably identical to today's `length === 1 && argDelta >= 0`.
- **Docs / ADRs / glossary:** new ADR 0011 (amends ADR 0008's `.$`/direct-navigation bullets, restates ADR 0009's match test); `dsl.md` §4.4/§5/§7 (the "Variants of one target" golden text and JSON now list every variant, best fit leading); `browser-client.md` step 4; `CONTEXT.md` **Best fit**.
- **Tests:** search fixtures for the ladder/jira fan-out and the arity-{1,2}-one-arg shape; `navigation.test.ts` rewritten for NAV-C (best-fit-with-sibling teleports, single-variant surplus teleports, two matched targets don't, cross-target single-`argDelta`-0 doesn't, multi-variant-no-best-fit doesn't, incomplete doesn't). `.rm` confirmed untouched.
- Programmatic interpreter check confirmed the ticket-44 scenario: arity `{1,2}` with one argument now returns two rows — `https://x/one` (`argDelta 0`, best fit, leading) then `https://x/one/{}` (`argDelta -1`).

Landed on branch `ticket/45-fan-out-variants`; **`--no-ff` merge to `main` pending a human** (git guardrail). Live REPL/page confirmation folds into the S5 checkpoint (41).

# Fan out every variant; the client selects the navigable row by argument balance

Amends [ADR 0008](0008-arity-keyed-variants-and-exact-key-set.md)'s `.$` and direct-navigation bullets, and restates the match test of [ADR 0009](0009-auto-navigate-on-a-non-empty-query.md).

Under ADR 0008 a selected target with a **best fit** (a variant whose arity equals the argument count) emitted *only* that variant; siblings were dropped. That made the best fit invisible-by-omission: `jira PROJ` returned a single row and the plain `jira.example.com` variant never appeared, so a user typing on the fallback page or in the REPL could not see the target's other pages. The auto-navigation rule leaned on the same drop: "exactly one match in `R` with a nonnegative balance."

The observation that dissolves the trade-off (found hand-testing [ticket 43](../../.scratch/thither-v1/issues/43-trim-uninformative-prefix.md), decided in [ticket 44](../../.scratch/thither-v1/issues/44-best-fit-hides-other-variants.md)): a target has at most one variant per arity, so **at most one of a target's rows can have `argDelta === 0`**. The best fit *is* the `argDelta`-0 row. Dropping the siblings was therefore redundant with a navigation rule keyed on `argDelta` — so we drop the drop, not add a marker.

## The decision

- **Core (`.$`).** For each selected target, emit **one match per variant**, always. The best fit is no longer singled out; it is the `argDelta`-0 row, which ordering (dsl.md §5) already leads with. Rendering and ordering are unchanged.
- **Client navigation (NAV-C).** `resolveNavigationDestination` navigates iff the terminal is an `R`, `R.inputs` is non-empty, **every match shares one key** (a single selected target), and then:
  - some match has `argDelta === 0` → navigate to that row (best fit); else
  - the target is single-variant (`matches.length === 1`) and its row has `argDelta > 0` → navigate to it (surplus arguments dropped, e.g. `home foo` → `home`); else
  - show the fallback page.

  This reproduces ADR 0009's teleport behaviour **exactly** on the pre-fan-out result: best fit teleports, single-variant surplus teleports, two matched targets never do, incomplete never does.

## Considered options

- **Keep-as-is (best fit drops siblings).** Loses no functionality but leaves the siblings hidden on the page and in the REPL — the reported friction.
- **Client-only context** (the client re-derives siblings from `register.state.targets[key]`). Cheap, but a second source of truth for something the core already knows, and the REPL gets nothing.
- **Core context rows tagged non-navigable.** Overcomplicated: `argDelta` is already the discriminator, so no tag is needed.
- **NAV-A "exactly one `argDelta === 0` anywhere."** Simplest client rule, but it changes behaviour two ways: it would teleport across targets (`git` matching `github`/`gitlab`, only one exact arity), and it would stop teleporting on single-variant surplus. Rejected in favour of NAV-C, which keeps navigation byte-for-byte identical to today.

## Consequences

- `R.matches` grows for multi-variant targets: `jira`, `jira PROJ`, and `jira PROJ extra` now each return two rows. The `dsl.md` §7 "Variants of one target" golden and the `.$` fan-out fixtures are updated accordingly.
- The client stops consulting the raw match count; it groups matches by key. A target's sibling variants no longer suppress its navigation, and the fallback page / REPL now list every variant.
- `.rm` is untouched: it never used the best-fit path.
- `dsl.md` §4.4/§5/§7, `CONTEXT.md` **Best fit**, ADR 0008 (`.$`, direct-navigation bullets), ADR 0009 (match test), and `browser-client.md` step 4 are amended to match.

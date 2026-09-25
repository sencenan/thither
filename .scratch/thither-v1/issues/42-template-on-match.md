# Carry the variant's template on the match

Type: task
Status: resolved
Blocked by: 36

## Question

Ticket 36 decided that argument highlights are rendered from the match's **template**, not recovered from the rendered destination (a match carries no template today, so locating arguments in the destination is a left-to-right `indexOf` guess that mis-highlights when the argument text also appears in the template before its `{}`). Add the variant's destination template to the match, in the **second slot, before the key**:

```text
m = [u_or_p, template, k, [args], hint]
```

- `src/dsl/types.ts`: `Match` becomes `readonly [destination, template, key, args, hint]`; `src/dsl/operations/search.ts` fills it; `selectTargets`/`.rm` untouched.
- `docs/dsl.md`: §1 value table row for `m`, §5 (rendering is per variant — say the template travels with its rendering so a presentation layer can show which `{}` each argument filled and which stayed open), and every §7 golden.
- `CONTEXT.md` **Match**: "…represented with its fully or partially rendered destination, the variant's template, the target's key, applied arguments, and hints."
- Client: `view.ts` destructuring and `navigation.ts`'s match reading shift one slot; fixtures follow. The REPL's match display too.

The view then renders each row by walking the template's `{}` left to right — filled slots show their argument, unfilled ones stay as placeholders — and uses the destination only as the link target. Rendering template + args slot by slot reproduces the destination exactly (the core substitutes by slicing), so a fixture should pin that equality on the §5 table.

TDD: the goldens are the exact fixtures; add one §5 case where an argument's text also occurs in the template before its placeholder, to show the template makes the span unambiguous.

**Done when** `Match` carries the template in slot 2 across core, specs, glossary, client, and REPL; `pnpm verify` green. Unblocks 38.

## Answer

Landed on `ticket/42-template-on-match` (branched from `ticket/36-prototype-fallback-page`, which holds this ticket). `pnpm verify` green, 371 tests (was 332 on the previous map line; this ticket adds 39: two new `.$` fixtures, a slot-walk check over every `.$` case, and one parser rejection).

**The shape.** `Match` is now `readonly [destination, template, key, args, hint]` in `src/dsl/types.ts`. `search.ts`'s `toMatch` fills slot 2 with the variant it rendered; `orderVariants` reads `argDelta` from slot 4. `parser.ts`'s `isMatch` requires exactly five slots and holds the template to the same `isTemplate` check as the destination, so a supplied `R` with the old four-slot matches is `parse_error` (pinned; there is no migration — a persisted stack normally holds only `S`, since `.out` pops the `R`).

**The contract this adds, and its fixture.** dsl.md §5 now states that filling the template's `{}` left to right with the applied arguments, an unfilled slot keeping its placeholder, reproduces the destination exactly. `search.test.ts` pins that as a second `it.each` over *every* `.$` case (`fillSlots(template, args) === destination` for each emitted match), so the walk ticket 38's view will perform is guaranteed to agree with the `href`. The ticket's requested §5 case is `echo . thither` against `https://example.com/thither/{}`: the destination `https://example.com/thither/thither` contains the argument text twice, and only the template makes the span unambiguous.

**Found while implementing — a §5 rendering bug, fixed.** The old `render` re-scanned the *output* for the next `{}`, so an argument that was itself `{}` was re-read as a placeholder on the next pass: template `https://example.com/{}/tree/{}` with arguments `{} y` rendered `https://example.com/y/tree/{}` instead of `https://example.com/{}/tree/y`, contradicting §5's "replacement text is argument content, not a new round of template syntax". The slot-walk equality would have exposed it the moment a `{}` argument appeared. `render` now consumes the template left to right, appending each argument to the output and resuming the scan on the remaining template, so an inserted argument is never scanned. Pinned as an exact fixture and a new row in the §5 rendering table (`{} y` → `https://example.com/{}/tree/y`, `argDelta 0`, `[{}, y]`); the old body fails both (confirmed red).

**Specs and glossary.** `docs/dsl.md`: §1 `m` row is `[u_or_p, p, k, [args], hint]` with each slot named; §5 gains the template-travels-with-its-rendering paragraph and the `{}`-argument sentence + table row; every §7 JSON golden carries the template. `CONTEXT.md` **Match** names the variant's template and why it travels. `browser-client.md` needed nothing — ticket 36 already amended "Fallback UI" to render argument highlights from the template.

**Client and REPL.** `view.ts` skips slot 2 (`[destination, , key]`) — walking the template is ticket 38's, not this one's; `navigation.ts` reads `match[4].argDelta`; fixtures in `view.test.ts`, `navigation.test.ts`, `operators.test.ts` (`match[2]` for the key) follow. The REPL's match line shows `args […] into <template>` when arguments were applied, so the slot fill is visible while teaching; verified live (`company git thither`, `jira PROJ extra`).

**Not done, deliberately.** No `Match` helper/constructor was added to the barrel: the client reads slots by position as before, and ticket 38 decides whether a `fillSlots`-style walker belongs in `src/client` (the test-local one in `search.test.ts` is its reference). **Unblocks 38.**

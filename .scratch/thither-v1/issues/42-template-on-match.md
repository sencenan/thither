# Carry the variant's template on the match

Type: task
Status: open
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

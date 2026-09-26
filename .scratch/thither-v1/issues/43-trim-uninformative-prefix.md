# Trim the inferred prefix of literals that add no matching evidence

Type: task
Status: resolved

## Question

Reported live: with a single target keyed `api docs` and the variant `https://docs.example.com/api/{}/{}`, the program `api a` renders the template untouched with `argDelta -2` instead of filling the first slot with `a`. §4.4's longest-prefix rule fuzzy-matches the argument letter `a` against the `a` in `api`, so `api a` is a matching prefix and `a` is consumed as matching input. Tickets 28 and 38 both hit the same friction and worked around it with an explicit `.`.

Alternatives weighed against a split-position table (every prefix length × selection count, fzf score, positions, argDelta per variant):

- **Shortest unique prefix.** Breaks §4.4's own example: with one target `company git`, `company` is already unique, so `git` becomes an argument. Also has no answer when no prefix is unique (`company thither` against `company git` + `company docs`).
- **Prefer the split with `argDelta = 0`.** `api a` has no such split; `jira a` has two; `git personal thither` fits `git personal pr` at split 1 with `[personal, thither]` as arguments. Arity is a property of the destination and should not decide what the user's tokens mean.
- **Maximise score.** Score grows with every consumed literal, so this *is* the longest-prefix rule.
- **Matching evidence** (chosen). A genuine key word matches characters of the key no earlier term matched (`api` → `api docs`: 3 → 7 positions); an argument that only fuzzy-hits re-covers matched characters (`api` → `api a`: 3 → 3). Independent of arity, target count, and score.

## Answer

Landed on `ticket/43-trim-uninformative-prefix`, recorded as [ADR 0010](../../docs/adr/0010-trim-the-inferred-prefix-by-matching-evidence.md), verified by hand in the REPL. §4.4 keeps the longest-matching-prefix step and adds a **trim** step: drop trailing literals that add no matching evidence — a literal adds evidence when it changes which targets are selected or matches a character of a selected key that no earlier term matched — until the last literal adds evidence or only the first literal remains. The boundary sits after the *last* informative literal, not the first uninformative one, so an OR group `git | docs` survives even though the standalone `|` changes nothing by itself.

`inferBoundary` in `src/dsl/operations/search.ts` finds the longest matching length as before, then walks it back with `addsEvidence(before, after)` comparing the two selections (set of keys, then positions per surviving target). The first literal is never trimmed, so `R.inputs` stays nonempty whenever any prefix matched — ADR 0009's navigation witness is unaffected.

Behaviour changes, all pinned in `search.test.ts`:

| Program | Before | After |
| --- | --- | --- |
| `api a` (arity-2 target) | matching `api a`, no args | matching `api`, arg `a` → `api/a/{}` |
| `api a b` | matching `api a`, arg `b` | `api/a/b` |
| `api docs a b` | matching `api docs a`, arg `b` | `api/a/b` |
| `company git git` | matching all three, no args | arg `git` → `company/git` |
| `jira a` (arities 0, 1) | `jira.example.com` | `browse/a` |
| `company !zzz` | NOT term consumed | `!zzz` is the argument |

Unchanged: `company git thither` (§4.4 example and §7 golden), `git !personal MyRepo` (the NOT term narrows the selection), `git | docs thither`, focus `[jira]` + `a` (first literal always matching). `docs/dsl.md` §3 and §4.4 amended; the rejected alternatives above are the ADR's considered options. `pnpm verify` green, 536 tests (+8: six red before the change, three pinning behaviour that must not change).

Known limit, deliberately kept: with focus already covering a key (`jira .@` then `a`), the single literal `a` is still matching input, because trimming it would leave `R.inputs` empty and the client would neither auto-navigate nor act on Enter (ADR 0009). Revisit if focus-plus-argument programs matter in practice.

Found while hand-testing: a target with variants of arity 1 and 2, given one argument, shows only the arity-1 row (§4.4 best fit, core not client). Filed as [Should a best fit hide the target's other variants?](44-best-fit-hides-other-variants.md).

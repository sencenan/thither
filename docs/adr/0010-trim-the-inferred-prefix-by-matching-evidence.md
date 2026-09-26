# Trim the inferred matching prefix of literals that add no matching evidence

Refines `dsl.md` §4.4's boundary inference. The longest-matching-prefix rule stays; a trimming step follows it.

Without a separator, `.$` infers where matching input ends and arguments begin by taking the longest nonempty prefix of the literals that still selects a target. Fuzzy matching undermines that rule for short arguments: against a single target keyed `api docs` with the variant `https://docs.example.com/api/{}/{}`, the program `api a` matched the prefix `api a` — the term `a` fuzzy-hits the `a` in `api` — so `a` was consumed as matching input and the template rendered untouched. Tickets 28 and 38 had met the same friction and worked around it with an explicit `.`; a live report made it a bug.

We enumerated every split position for a set of programs and recorded, per position, the selected targets, fzf's score, the matched key positions, and each variant's argument balance. Score rises monotonically with every consumed literal, so it cannot separate a key word from a fuzzy-hitting argument. Argument balance points the wrong way in several cases. What does separate them is **matching evidence** (`CONTEXT.md`): a genuine key word matches characters of the key no earlier term matched (`api` → `api docs`: 3 → 7 positions), while an argument that only fuzzy-hits re-covers characters already matched (`api` → `api a`: 3 → 3).

## The decision

After finding the longest matching prefix, **trim it**: drop trailing literals that added no matching evidence, one at a time, until the last literal adds evidence or only the first literal remains. A literal adds evidence when appending it to the query **changes which targets are selected** or **matches a character of a selected key that no earlier term matched**. What remains is the matching portion; the rest of the literals are arguments.

Two properties of the rule are deliberate:

- **The boundary sits after the last informative literal, not the first uninformative one.** A standalone `|` changes nothing by itself; the information arrives with the next term. Trimming from the end keeps `git | docs` intact and passes `thither` in `git | docs thither`, whereas a forward scan that stopped at the first uninformative literal would have broken every OR group.
- **The first literal is always matching input.** Trimming it would leave `R.inputs` empty, and ADR 0009 makes a non-empty `R.inputs` the witness that a query was typed — the client would neither auto-navigate nor act on Enter. So under focus `[jira]`, the single literal `a` still matches rather than becoming an argument; a known limit, revisited only if focus-plus-argument programs matter in practice.

## Considered options

- **Shortest unique prefix** ("consume as few literals as identify one target"). Rejected: with a single target `company git`, `company` is already unique, so `git` would become an argument — §4.4's own worked example and a §7 golden. It also has no answer when no prefix is unique (`company thither` against `company git` and `company docs`).
- **Prefer the split whose argument count fits a variant** (`argDelta = 0`). Rejected: `api a` has no such split, so a tiebreak is still needed; `jira a` has two (arity 1 with `a`, arity 0 consuming `a`); and `git personal thither` fits `git personal pr` at the first split with `[personal, thither]` as arguments. Arity is a property of the destination and should not decide what the user's literals mean.
- **Maximise score.** Score grows with each consumed literal, so this is the longest-prefix rule under another name.
- **Special-case operators** (always consume `|` and the term after it, always consume `!x`). Rejected as ad hoc: trimming from the end already keeps OR groups, and a NOT term that excludes nothing genuinely carries no information, so treating it as an argument is consistent.

## Consequences

- `api a` fills the first slot; `api a b` navigates; `jira a` is `browse/a`; a key word typed twice (`company git git`) passes the second occurrence as the argument; `company !zzz` passes `!zzz` as the argument. `company git thither`, `git !personal MyRepo` (the NOT term narrows the selection), and every §7 golden are unchanged.
- The inference now runs the matcher up to twice per prefix length instead of once; target sets are small and the client debounces, so this is not measurable.
- A literal that fuzzy-hits *new* characters (`d` against `docs` in `api d a`) is still consumed. Such inputs are ambiguous by construction; `.` remains the explicit boundary.
- `dsl.md` §3 and §4.4 are amended; `search.test.ts` pins each row above.

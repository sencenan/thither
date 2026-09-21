# Implement .$ search and boundary inference

Type: task
Status: open
Blocked by: 08, 09

## Question

Implement and test `.$` per `dsl.md` §4.4.

**With a separator**: everything before the standalone `.` is the matching portion, matched in full against focus and never shortened; everything after is arguments, not fuzzy-matched. An empty matching portion searches on focus alone and keeps the suffix, so `S lookup . https://example.com .$` passes a URL as an argument with no escaping.

**Without a separator**: examine nonempty leading prefixes of `L` and select the **longest** prefix yielding at least one matching target when combined with focus. Do not stop at the first unique match — a longer prefix that still matches must be consumed. The remaining literals are arguments.

Edge rules: if matching literals were supplied but no nonempty prefix matches, return **no matches** — never discard them all and fall back to focus, and never shorten focus itself. With no supplied literals, search on focus alone; with empty focus too, select every target.

`R.inputs`: the user-supplied literals used as matching inputs, in their original spelling, excluding focus, the separator, and arguments. A failed inferred search still reports the attempted input list so the result identifies the failed query. A focus-only search has empty `inputs`.

Search never changes state; producing `R` ends evaluation.

**Done when** fixtures cover the `company` / `company git` / `company git thither` prefix ladder, the case where the longer prefix still matches and must be consumed, the no-prefix-matches case, focus-only and select-all, and `R.inputs` spelling preservation in each.

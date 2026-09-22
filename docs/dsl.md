# Thither DSL specification

Status: agreed.

This document specifies Thither's stack-based language for maintaining targets, setting focus, and resolving navigation inputs. Domain terminology is defined in [CONTEXT.md](../CONTEXT.md).

Browser integration, HTTP behavior, persistence, authentication, deployment, and the concrete host interpreter interface are outside this specification. See [browser-client.md](browser-client.md) for one host's contract.

## 1. Model, values, and evaluation

A program is a stream of values and operations, built by appending items one at a time. An item is a string token or a structured value; the interpreter applies the same language rules to every item, whatever its origin. How a host obtains items is outside this specification.

The interpreter evaluates the whole program as given, left to right, against a fresh empty data stack. Worked examples supply state as the program's first item.

### Notation

The rightmost stack element is the top. Transition notation is:

```text
stack | current value or operation -> resulting stack
```

`K` denotes an untouched stack prefix, which successful operations preserve. `S` is state, `R` a result, `E` an error, `L` an accumulated literal array, and `x` any ordinary literal (`d`, `u`, or `p`).

Square brackets in transition diagrams describe values, not source syntax. In particular, an accumulated literal array is an evaluator value, not an array literal that users can write.

### Value types

| Symbol | Meaning | Representation or constraint |
| --- | --- | --- |
| `u` | URL | A valid URL with an explicit scheme and without template placeholders. Any scheme is supported. |
| `p` | Destination template | A URL with an explicit scheme and additional anonymous `{}` placeholders. A plain `u` is accepted wherever a destination template is required. |
| `d` | Dimension literal | A space-free literal. Preserve source spelling during evaluation; normalize when used as a stored dimension. |
| `L` | Literal array | An ordered array of ordinary literals: dimensions, URLs, or templates. Created by accumulation during evaluation. |
| `t` | Target | `[[d], p]`, also permitting a plain URL in the destination slot. |
| `T` | Target set | `[t]`. |
| `S` | State of the world | `["S", { "targets": T, "focus": [d] }]`. |
| `m` | Match | `[u_or_p, [d], [args], hint]`, where `hint` carries at least `argDelta`, `positions`, and `score`. Missing arguments may leave a partially rendered template in the first slot. |
| `M` | Match set | `[m]`, including matches with missing arguments. |
| `R` | Search result | `["R", { "matches": M, "inputs": [d] }]`. |
| `E` | Error | `["E", { "type": string, "description": string }]`; additional diagnostic fields are permitted. |

The `[d]` and `[args]` notation means an array, not necessarily a single element.

`t` and `T` occur inside `S`; `m` and `M` occur inside `R`. They cannot appear as standalone program values; such input parses to `E`. `S`, `R`, and `E` are permitted top-level JSON values.

A match is a **selected target**, not necessarily a fully rendered destination. Producing an `R` does not itself mean navigation can proceed.

### Transitions

Terminal rules take priority over the rest.

| Stack before | Input | Stack after | Effect |
| --- | --- | --- | --- |
| `[K, R]` | Anything remaining | `[K, R]` | Stop; silently discard the remaining parsed program. |
| `[K, E]` | Anything remaining | `[K, E]` | Stop; error is terminal. |
| `[K, L]` | `x` | `[K, L ++ [x]]` | Append without changing spelling or order. |
| `[K]`, top is not `L` | `x` | `[K, [x]]` | Start a literal array; also applies to an empty stack. |
| `[K]` | `S` | `[K, S]` | Push state separately. |
| `[K]` | `R` | `[K, R]` | Push result and stop. |
| `[K]` | `E` | `[K, E]` | Push an explicit error and stop without unwinding. |
| `[K, S, L]` | `.set` | `[K, S']` | 0 matches appends a target, 1 replaces its destination, more than 1 errors. |
| `[K, S, L]` | `.rm` | `[K, S']` | Remove all complete-query matches; no explicit dimensions or 0 matches is a no-op. |
| `[K, S]` | `.rm` | `[K, S]` | No explicit dimensions: leave state unchanged. |
| `[K, S, L]` | `.@` | `[K, S']` | Replace focus with the dimensions before `.`. |
| `[K, S]` | `.@` | `[K, S']` | Clear focus. |
| `[K, S, L]` | `.$` | `[K, S, R]` | Search, render matches, and stop. |
| `[K, S]` | `.$` | `[K, S, R]` | Search using focus alone; empty focus selects all targets. Stop. |
| Any invalid stack or operands | Operation | Unwind, then push `E` | Preserve the nearest working state; see section 6. |

Accumulation keeps literals exactly as supplied. Do not lowercase, sort, or deduplicate `L`: that would destroy argument spelling, ordering, and the boundary inferred by search.

```text
[S]                        | company                  -> [S, [company]]
[S, [company]]             | git                      -> [S, [company, git]]
[S, [company, git]]        | https://example.com/{}   -> [S, [company, git, https://example.com/{}]]
```

### Lifecycle

1. Build the program by appending parsed items in order. An unparsable item becomes an `E` value at that position; earlier items remain executable.
2. Append `.$` unless the program's last item is already the **operation** `.$`. An escaped literal `..$` does not count.
3. Start with an empty data stack and evaluate left to right.
4. Stop when an `R` or explicit `E` reaches the top, discarding the rest of the program. Pushing an explicit `E` does not unwind the stack.
5. Stop on a generated evaluation error after applying the unwinding of section 6.

`.$` may occur earlier in a valid program; its result terminates evaluation, so later values never execute. The specification describes the final stack, without prescribing a host-language return type.

## 2. Source syntax and parsing

A program is built one item at a time: `append(program, tokenOrValue) -> program'`. The core parses a **single** item per call and never tokenizes a multi-item string. Hosts split user input on JavaScript whitespace (`\s`) and append the resulting tokens in order.

Each appended item is either:

- a **string token**, interpreted as one value's textual form: an ordinary literal, the separator `.`, an escaped literal, or an operation; or
- a **structured value** supplied as a JavaScript object, such as an `S`, `R`, or `E` envelope, normalized and validated on parse.

Worked examples write structured values inline, such as `S company git .set`. That is notation for a supplied structured value followed by string tokens, not a claim that a host must serialize state into text.

Supported operations are:

```text
.set    insert or update a target
.rm     remove matching targets
.@      replace or clear focus
.$      search and produce a result
```

Ordinary literals retain their spelling and order. URL literals and templates accumulate exactly like dimensions, so a URL-valued argument needs no escaping.

### Separator and escaping

A leading dot is the language's only control syntax: `.set`, `.rm`, `.@`, and `.$` are operations, and a **standalone `.`** is the argument separator. Every other token is data. Only the standalone token is a separator; a dot inside a literal or URL, as in `node.js` or `example.com`, is ordinary content.

A leading double dot escapes a dot-prefixed token: parsing keeps the token verbatim as an ordinary literal, `..` and all. One leading dot is removed whenever the literal is later *used* — both when it is matched and when it is substituted into a destination — while the accumulated form retains the `..`. So `..git` matches as `.git` and renders as `.git`.

```text
..rm   -> literal ..rm   (resolves to .rm)
..set  -> literal ..set  (resolves to .set)
..$    -> literal ..$    (resolves to .$)
..     -> literal ..     (resolves to .)
```

Escaped tokens are not interpreted again as operations. An unescaped dot-prefixed token that the interpreter's environment does not bind to an operation parses to an `E` of type `missing_operation`. The environment supplies the operation set; by default it is exactly the four above, and a host may extend it (see [ADR 0005](adr/0005-extensible-interpreter-environment.md)). Double-quoted tokens are not a quoting mechanism, and multiword literals are not part of this version: each argument is one space-separated literal.

The first standalone `.` divides an input array into a **matching portion** and a **suffix**. Each operation in section 4 says what it does with them; only `.$` uses the suffix.

### URL and template validation

Accept any valid URL with an **explicit scheme**, allowing anonymous `{}` placeholders as additional template syntax. There is no scheme allowlist, and a scheme does not require `//`. Do not infer a scheme or resolve a relative reference against a base URL.

Validate by rendering, not by parsing the raw template: replace every `{}` with the probe token `thither`, then validate that rendered string with the standard WHATWG `URL` parser. Accept the destination when the rendered form parses and has an explicit scheme. Store and later substitute into the **original** template text, never the parser's normalized output of the probe.

```text
accepted:  https://example.com/{}    https://{}.example.com/{}   file:///tmp/{}
           mailto:{}                 data:text/plain,{}          myapp:open/{}
           {}://example.com          (renders as thither://example.com)

rejected:  example.com/path          /path/{}                    //example.com/{}
           https://exa mple.com/{}
```

Placeholders may appear in any position, including the scheme. Merely containing a colon is not sufficient. Substituting actual arguments can still produce a different, possibly invalid, URL at navigation time; template acceptance is not a promise about every rendered result, nor permission for a host to execute every accepted scheme.

This rule applies wherever a destination is accepted, including `.set` operands and destinations inside supplied state.

### Parse failures are values

Parsing is total: an item that is not a valid value parses to an `E` value appended to the program, rather than throwing or rejecting the whole program. Malformed structured values, unsupported standalone intermediate values, and invalid operation syntax all take this path.

Execution therefore applies every item preceding the first `E`, then pushes that `E` and stops. Given previous state `S` and the input `git .rm @@bad`, the removal is applied and the final stack is `[S', E]`. Items after the first `E` are never reached, so `[S, E, E']` cannot arise. Appending text is not atomic: a later invalid token does not undo earlier valid mutations from the same input.

Errors that depend on the current stack or an operation's operands are evaluation errors instead. A valid ordinary token in `.set`'s destination position parses successfully and can then fail URL validation during evaluation.

### Supplied structured values

Validate supplied values in the core, not the browser client. Reject malformed required structures. A supplied `S` or `R` carries only its defined fields; unknown fields on those envelopes are dropped, not preserved. An `E` payload is the exception: it may carry diagnostic fields beyond the required `type` and `description`, which are kept as uninterpreted data and never acquire execution semantics. Its `type` must still be one of section 6's vocabulary values; an `E` whose `type` is outside that vocabulary is malformed and parses to `parse_error`.

Normalize each supplied `S`'s target dimensions and focus by the rules of section 3. Reject dimension strings containing internal whitespace after trimming. Normalization does not change target order, destination text, argument spelling, or `R.inputs`.

Within each target set, every normalized dimension set must be unique. Two targets with identical normalized dimensions make the value invalid, so it parses to `E`, whether their destinations differ or are identical. Detect duplicates after normalization; do not merge targets or choose one. Different `S` values in a program may independently contain the same dimension sets. For example, dimensions `["Git", " company ", "git"]` normalize to `["company", "git"]`, so a second target with `["git", "company"]` in that same target set makes the state invalid.

Validation happens when an item is parsed, not when it is reached. An invalid value placed after a terminal result therefore still parses to `E`, but evaluation stops before reaching it.

Hosts reuse this parse step to validate data they hold, such as manually supplied reset JSON. A value that parses to `E` must not replace persisted data.

## 3. Dimensions, focus, and matching

Stored dimensions are trimmed, lowercase, whitespace-free, deduplicated, and deterministically sorted. Use JavaScript's standard `trim()` and locale-independent `toLowerCase()`, followed by default string sorting (lexicographic UTF-16 code-unit order). Do not use locale-sensitive lowercasing or collation. Internal whitespace is invalid, not a request to split one supplied dimension into several.

This gives equivalent dimension sets a consistent searchable representation. Focus is also a stored dimension list, not an argument list, and setting it replaces it rather than extending it. Focus is implicit fuzzy-search input, not an exact namespace or an access-control boundary.

**Target-set order** is the order targets occupy in the state. A supplied `S` keeps the order it was given; `.set` appends a newly inserted target to the end; updating an existing target leaves it in place; `.rm` removes targets without reordering the rest. That order is the final tiebreak wherever matches are ranked.

To construct a matching query:

1. Select the operation's explicit matching literals.
2. Use lowercase copies for matching; retain original literals for arguments and result inputs.
3. Prepend the current focus.
4. Remove duplicate dimensions.

Each target's canonically sorted dimensions are joined with spaces into **one searchable string**. Fuzzy-match each query dimension independently against that entire string. Select a target only when every query dimension matches, and sum their scores for ranking. A fuzzy token may span dimension boundaries.

Query-dimension order does not affect selection or score: both `git company` and `company git` match the searchable string `company git`. Do not pass the whole space-joined query as a single ordered fuzzy pattern. Only `.$`'s prefix inference cares about the user's original token order.

Do not import fzf's special query operators, such as negation, anchors, or exact-match syntax; they have no meaning here. Matching is case-insensitive, but diacritic normalization is disabled: `cafe` does not match `café`. No confidence threshold or winner-margin rule is applied, so a first-ranked match is not automatically a unique match.

Operations differ only in how they choose query inputs:

- `.set` and `.rm` match the **entire explicit matching portion**, combined with focus. They never retry shorter prefixes.
- `.$` infers the boundary between matching literals and arguments by finding the longest matching prefix.
- `.@` sets focus directly; it does not search for targets.

An empty explicit query searches on focus alone; empty focus with no explicit input selects all targets.

## 4. Operations

Each operation reads the matching portion defined in section 2, normalizes dimensions by section 3, and validates destinations by section 2.

### 4.1 `.set`

```text
[K, S, L] | .set -> [K, S']
```

Interpret `L` in this order:

1. Require its last literal to be a valid URL or destination template, and remove it as the destination. Do not search backward for a URL. A plain URL is a valid destination with zero placeholders.
2. From the remaining literals, keep the matching portion.
3. Require **at least one explicit dimension** there. Focus cannot satisfy this requirement.
4. Combine those dimensions with focus and match the complete combined query.

| Matching targets | Effect |
| --- | --- |
| Zero | Append a target with the normalized combined dimensions and the supplied destination to the end of the target set. |
| Exactly one | Replace only that target's destination. Preserve its existing dimensions and its position. |
| More than one | Emit an error; leave the operation's input state unchanged. |

Fuzzy updating does not rename dimensions: if `comp git` uniquely matches `[company, git]`, `.set` updates the URL and retains `[company, git]`.

```text
S company git . ignored https://github.com/company/{} .set
```

The URL is extracted first, so the explicit dimensions are `company git` and `. ignored` plays no part.

These are errors, even when focus is nonempty, because no explicit dimension remains:

```text
S https://github.com/company/{} .set
S . ignored https://github.com/company/{} .set
```

### 4.2 `.rm`

```text
[K, S, L] | .rm -> [K, S']
[K, S]    | .rm -> [K, S]
```

With no literal array, or a matching portion that is empty, leave state unchanged without matching, regardless of focus. Focus alone never authorizes removal:

```text
S .rm
S . ignored .rm
```

Otherwise combine the explicit dimensions with focus, match that complete dimension list, and remove every matching target. Zero matches is a successful no-op and multiple matches are allowed; never shorten the query to obtain a match. So `S company nonexistent .rm` removes nothing and does not retry `company`.

The interpreter still appends `.$`, so these programs go on to search the unchanged state.

### 4.3 `.@`

```text
[K, S, L] | .@ -> [K, S']
[K, S]    | .@ -> [K, S']
```

Normalize the matching portion and replace focus with it, without combining it with the old focus. No literal array, or an empty matching portion, clears focus. So `S company . git .@` sets focus to `[company]`, not `[company, git]`.

### 4.4 `.$`

```text
[K, S, L] | .$ -> [K, S, R]
[K, S]    | .$ -> [K, S, R]
```

Search does not change state. Producing `R` ends evaluation.

**With a separator**, the matching portion is matched in full against focus — never shortened — and the suffix is taken as arguments without fuzzy-matching. An empty matching portion searches on focus alone and keeps the suffix. URL arguments therefore need no escape:

```text
S lookup . https://example.com .$
```

**Without a separator**, examine nonempty leading prefixes of `L` and select the **longest prefix yielding at least one matching target** when combined with focus. That prefix supplies the matching inputs; the remaining literals are arguments. Do not stop at the first unique match: a longer prefix may still match the same target and must be consumed.

```text
company              -> matches
company git          -> matches
company git thither  -> no matches
```

For a target whose dimensions are `[company, git]`, the selected prefix is `company git` and `thither` is the argument. If `company git thither` itself matched a target, the longest-prefix rule would consume `thither` as matching input; use `.` when an explicit boundary is needed.

If the user supplied matching literals but **no nonempty prefix matches**, return no matches. Do not discard all supplied literals and fall back to focus; focus itself is never shortened.

Return one `m` for every selected target, including targets missing arguments, ordered as section 5 defines; clients render that order rather than re-sorting. `R.inputs` records the user-supplied literals used as matching inputs, in their original spelling, excluding focus, the separator, and arguments. A failed inferred search still reports the attempted input list, so the result identifies the failed query. A focus-only search has empty `inputs`.

## 5. Arguments, rendering, and match ordering

Each anonymous `{}` in the destination template requires one argument, in left-to-right order. Each supplied argument is one literal, preserving its original spelling and case. For a target with `P` placeholders and `A` supplied arguments:

```text
hint.argDelta = A - P
appliedArgs   = first min(A, P) supplied arguments
```

Extra arguments are ignored during substitution; missing ones leave their placeholders intact. The `[args]` field in `m` contains the **applied** arguments only, but `argDelta` counts every supplied argument.

Substitution is literal, not percent-encoding, and fills the original template; replacement text is argument content, not a new round of template syntax.

| Template | Supplied arguments | Rendered destination | `argDelta` | Applied arguments |
| --- | --- | --- | --- | --- |
| `https://example.com/{}` | `MyRepo` | `https://example.com/MyRepo` | `0` | `[MyRepo]` |
| `https://example.com/{}` | `thither extra` | `https://example.com/thither` | `1` | `[thither]` |
| `https://example.com/{}` | `a/b` | `https://example.com/a/b` | `0` | `[a/b]` |
| `https://example.com/{}/tree/{}` | `thither` | `https://example.com/thither/tree/{}` | `-1` | `[thither]` |
| `https://example.com/{}` | none | `https://example.com/{}` | `-1` | `[]` |
| `https://example.com/` | `ignored` | `https://example.com/` | `1` | `[]` |

### Matching evidence

Each match reports why it matched, so a presentation layer can highlight without re-running the matcher:

- `hint.positions`: the ascending, deduplicated character indices matched within that target's searchable string. Matching runs one fuzzy query per query dimension, so these are the **union** of those results: a character matched by two dimensions appears once, and the list does not record which dimension matched it. Because a fuzzy token may span dimension boundaries, these are string indices, not dimension indices.
- `hint.score`: the match's ranking score, the sum of its per-query-dimension scores. The breakdown is not reported; an implementation may add it as an extra debugging field.

These fields are evidence, not presentation instructions: the language defines no highlight markup, colour, or label. Other hint fields may be added for debugging or custom presentation.

A query with no dimensions still produces ordinary matches, with empty `positions` and a `score` of `0`, because a sum over no dimensions is zero. Every target then ties on score, so ordering falls to argument balance and target-set order.

### Match ordering

`R.matches` is emitted in one total order, so a client renders it top to bottom without sorting. Compare two matches by these keys in turn:

1. **Nonnegative `argDelta` first.** This is the split between matches whose destination is fully rendered and matches still showing a `{}`.
2. **`|argDelta|` ascending.** Exact counts (`0`) therefore lead the nonnegative group, `+1` precedes `+2`, and `-1` precedes `-2`.
3. **`hint.score` descending.** Closeness to a balanced argument count outranks match quality: a weakly scored `+1` still precedes a strongly scored `+2`.
4. **Target-set order.** The final tiebreak, leaving no pair undetermined.

A direct-navigation candidate requires exactly one selected target and a nonnegative argument balance. Missing-argument matches remain in `R.matches` and count toward ambiguity. Ordering never turns multiple selected targets into a unique match: a client must check the match count, not take the first row.

## 6. Errors and state preservation

An operation with no matching stack rule, a failed operand validation, or an ambiguous `.set` emits an evaluation error. An explicit `E` value is not such a failure: push it and stop without unwinding, so `[S, L]` followed by an explicit `E` becomes `[S, L, E]`.

Every error carries a machine-readable `type` from this closed vocabulary, plus a human-readable `description`. The vocabulary is discriminated by **phase**: failures raised while parsing one item are `parse_error` or `missing_operation`, and the remaining types name failures raised while evaluating an operation.

| `type` | Phase | Raised when |
| --- | --- | --- |
| `parse_error` | Parse | An item is not a usable value: malformed JSON, a value that is never permitted at top level such as `t`, `T`, `m`, `M`, or a literal array, or a recognized `S`, `R`, or `E` envelope failing validation, such as duplicate normalized dimension sets or an `E` whose `type` is outside this vocabulary. |
| `missing_operation` | Parse | A dot-prefixed token is not the separator and is not bound to an operation in the interpreter's environment. |
| `invalid_destination` | Evaluation | An operand URL or destination template fails render-then-parse validation. |
| `missing_operand` | Evaluation | An operation lacks a required operand: no explicit dimension, no destination literal, or no state to operate on. |
| `ambiguous_set` | Evaluation | `.set` matches more than one target. |
| `unknown_error` | Evaluation | A catch-all for an evaluation failure that does not match a more specific type. |

The phase rule decides overlapping cases: the same malformed destination reports `parse_error` inside a supplied `S` and `invalid_destination` as a `.set` operand. One is an unusable item, the other an unusable operand.

`missing_operand` covers every required-operand failure of one operation, whichever operand is absent:

```text
S .set                              # no explicit dimension
S . ignored .set                    # no explicit dimension; the suffix is ignored
S company git .set                  # no destination literal
git https://example.com/{} .set     # no state anywhere on the stack
```

Hosts display `type` and `description` without interpreting the type value. Adding a new `type` is a specification change, not an implementation detail. A supplied `E` must carry a `type` drawn from this vocabulary and a string `description`; unlike a generated error it may also carry extra diagnostic fields, which are preserved. An `E` whose `type` falls outside the vocabulary fails validation and parses to `parse_error`, so an error produced by another version does not round-trip unchanged.

### Unwinding

On a generated evaluation error, pop stack elements until the nearest valid `S` reaches the top or the stack empties, preserve that `S` and everything below it, push `E`, and stop. Unwinding does not inspect or rewrite values below the retained state.

```text
[S0, L0, S1, L1] -> [S0, L0, S1, E]
[L]              -> [E]
```

Operations must preserve their input state until they have succeeded: an ambiguous `.set` must not consume or partially modify `S` before emitting its error.

Earlier successful operations are **not rolled back**. The retained state is the nearest working state at the point of failure, not the initial state. Suppose the original focus is `[personal]` and `git` matches more than one target when focus is empty:

```text
S company .@ .@ git https://example.com/{} .set
```

The first `.@` sets focus, the second clears it, and `.set` then fails as ambiguous. The error stack retains the state with cleared focus.

A parse failure behaves like any other `E` in the stream: items before it have already executed, and pushing it stops evaluation without unwinding. A program whose first item is unparsable evaluates to `[E]`.

## 7. Worked programs

These examples use `S`, `S0`, and `S1` as explanatory names for actual state JSON values; they are not source-level variable bindings.

### Create and implicitly search

```text
["S", {"targets": [], "focus": []}]
company git https://github.com/company/{} .set
```

The interpreter appends `.$`. `.set` appends `[company, git]`, and the appended search selects all targets because focus and explicit input are empty. The final shape is `[S', R]`, whose single match keeps its `{}` intact with `argDelta: -1`.

### Navigate with inferred arguments

```text
["S", {
  "targets": [[["company", "git"], "https://github.com/company/{}"]],
  "focus": []
}]
Company Git MyRepo
```

The implicit `.$` matches `Company Git` case-insensitively and treats `MyRepo` as the argument:

```json
["R", {
  "matches": [
    ["https://github.com/company/MyRepo", ["company", "git"], ["MyRepo"], {"argDelta": 0}]
  ],
  "inputs": ["Company", "Git"]
}]
```

### Preserve ambiguity when arguments are missing

```text
["S", {
  "targets": [
    [["company", "git"], "https://github.com/company/{}"],
    [["git", "personal"], "https://github.com/personal/{}/tree/{}"]
  ],
  "focus": []
}]
git . thither .$
```

Both targets are selected, so the result is ambiguous even though only one URL is complete. The complete destination leads because its `argDelta` is `0`, whatever the two scores are:

```text
https://github.com/company/thither          argDelta:  0
https://github.com/personal/thither/tree/{} argDelta: -1
```

### Select every target with an empty query

```text
["S", {
  "targets": [
    [["company", "git"], "https://github.com/company/{}"],
    [["docs"], "https://docs.example.com/"]
  ],
  "focus": []
}]
```

The appended `.$` selects everything, and each match carries empty evidence:

```json
["R", {
  "matches": [
    ["https://docs.example.com/", ["docs"], [],
      {"argDelta": 0, "positions": [], "score": 0}],
    ["https://github.com/company/{}", ["company", "git"], [],
      {"argDelta": -1, "positions": [], "score": 0}]
  ],
  "inputs": []
}]
```

Both scores are `0`, so argument balance decides: the complete `docs` destination leads despite being second in the target set. Two matches remain, so this is not a direct-navigation candidate.

### Stop at the first result

```text
S0 git .$ S1 docs .$
```

Execute the first search and stop with `[S0, R]`. `S1` is never pushed and the second search never runs.

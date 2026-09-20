# Axon DSL specification

Status: agreed core semantics; remaining precision questions are listed at the end.

This document specifies Axon's stack-based language for maintaining targets, setting focus, and resolving navigation inputs. Domain terminology is defined in [CONTEXT.md](../CONTEXT.md).

Browser integration, HTTP behavior, persistence, authentication, deployment, and the host interpreter API are outside this specification. Examples supply state explicitly; how an interface supplies that state is a separate concern.

## Evaluation rules — one-page reference

**Setup:** Parse the entire program first; any parse error prevents execution. Append `.$` unless the final parsed item is already that operation. Start with an empty stack and evaluate left to right.

**Notation:** Rightmost is top. `K` is a preserved stack prefix; `S` is state, `R` a result, `E` an error, `L` an ordered literal array, and `x` any ordinary literal (`d`, `u`, or `p`). Terminal rules take priority.

| Stack before | Input | Stack after | Effect |
| --- | --- | --- | --- |
| `[K, R]` | Anything remaining | `[K, R]` | Stop; silently discard the remaining parsed program. |
| `[K, E]` | Anything remaining | `[K, E]` | Stop; error is terminal. |
| `[K, L]` | `x` | `[K, L ++ [x]]` | Append without changing spelling or order. |
| `[K]`, top is not `L` | `x` | `[K, [x]]` | Start a literal array; also applies to an empty stack. |
| `[K]` | `S` | `[K, S]` | Push state separately. |
| `[K]` | `R` | `[K, R]` | Push result and stop. |
| `[K, S, L]` | `.set` | `[K, S']` or `[K, S, E]` | Extract destination; 0 matches inserts, 1 updates URL only, more than 1 errors. |
| `[K, S, L]` | `.rm` | `[K, S']` | Remove all complete-query matches; no explicit dimensions or 0 matches is a no-op. |
| `[K, S]` | `.rm` | `[K, S]` | No explicit dimensions: leave state unchanged. |
| `[K, S, L]` | `.@` | `[K, S']` | Replace focus with dimensions before `?`. |
| `[K, S]` | `.@` | `[K, S']` | Clear focus. |
| `[K, S, L]` | `.$` | `[K, S, R]` | Search, render matches, and stop. |
| `[K, S]` | `.$` | `[K, S, R]` | Search using focus alone; empty focus selects all targets. Stop. |
| Any invalid stack/operands | Operation | Unwind, then push `E` | Preserve the nearest working state as described below. |

**Operation details**

- **`.set`:** Require and remove the final literal as a valid URL/template with an explicit scheme (any scheme); then discard `?` and its suffix. Require at least one remaining explicit dimension—focus cannot substitute. Match the complete dimension list plus focus. Insert normalized combined dimensions on 0 matches; preserve existing dimensions on an update. Failure preserves the input state.
- **`.rm`:** Discard `?` and its suffix. With no explicit dimensions, leave state unchanged, regardless of focus. Otherwise match the complete remaining dimensions plus focus; never retry shorter prefixes.
- **`.@`:** Discard `?` and its suffix; normalize the retained dimensions as the new focus. Do not include old focus. An empty retained list clears focus.
- **`.$`:** With `?`, match its entire prefix and use its suffix as arguments. Without `?`, use the longest **nonempty** matching prefix and take the remainder as arguments. If supplied matching tokens have no matching prefix, return no matches—never discard them all to fall back to focus. No matching tokens means focus-only search.

**Shared rules**

- Ordinary literals include `?` and URLs; `..rm` decodes to literal `.rm`. Standalone `t`, `T`, `m`, and `M` values are parse errors, not pushes.
- Matching uses lowercase copies, prepends focus, and deduplicates. Stored dimensions are trimmed, lowercase, deduplicated, and alphabetically sorted; join each target's dimensions into one searchable string. Use fzf-style fuzzy matching/ranking, not its query operators.
- Produce one match per selected target, including incomplete ones. Fill original `{}` placeholders left-to-right with literal, case-preserved arguments; do not URL-encode. Ignore extras; leave missing placeholders intact. `hint.argDelta = supplied arguments − placeholders`; each `m` stores only applied arguments. Keep fuzzy rank order in `R`; `R.inputs` excludes focus and arguments.
- **Error unwinding:** Pop until the nearest `S` is on top, retaining everything below it, then push `E` and stop. If no `S` exists, end with `[E]`. Earlier successful changes survive; a failing operation must preserve its own input state.

The numbered sections below expand these rules and define result presentation and remaining precision questions.

## 1. Model and notation

A program is a stream of values and operations. The interpreter parses the **entire program before executing any of it**, then evaluates the parsed stream from left to right against a fresh data stack.

The rightmost stack element is the top. Transition notation is:

```text
stack | current value or operation -> resulting stack
```

`K` denotes an untouched stack prefix. Successful operations match the required stack suffix and preserve `K`.

Square brackets in transition diagrams describe values; they are not necessarily source syntax. In particular, an accumulated literal array is an evaluator value, not a standalone array literal that users can write in a program.

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
| `m` | Match | `[u_or_p, [d], [args], hint]`. Missing arguments may leave a partially rendered template in the first slot. |
| `M` | Match set | `[m]`, including matches with missing arguments. |
| `R` | Search result | `["R", { "matches": M, "inputs": [d] }]`. |
| `E` | Error | `["E", {}]`; the object may carry diagnostics, whose fields are not yet specified. |

The `[d]` and `[args]` notation means an array, not necessarily a single element.

`t` and `T` occur inside `S`; `m` and `M` occur inside `R`. They cannot appear as standalone program values. Such input is a parse error. `S` and `R` are permitted top-level JSON values.

A match is a **selected target**, not necessarily a fully rendered destination. Producing an `R` does not itself mean navigation can proceed.

## 2. Source syntax and parsing

The source consists of whitespace-separated ordinary literals and operations, plus complete JSON envelopes for `S` and `R`. Whitespace inside a JSON envelope belongs to that JSON value rather than separating program values.

Supported operations are:

```text
.set    insert or update a target
.rm     remove matching targets
.@      replace or clear focus
.$      search and produce a result
```

Ordinary literals retain their spelling and order. URL literals and templates participate in the same literal accumulation as dimensions; a URL-valued argument does not need escaping.

### Operator escaping

A leading double dot escapes a dot-prefixed token by removing one leading dot and treating the result as an ordinary literal:

```text
..rm   -> literal .rm
..set  -> literal .set
..$    -> literal .$
```

Escaped tokens are not interpreted again as operations. An unrecognized, unescaped dot-prefixed operation is a syntax error.

Double-quoted standalone tokens are not an agreed quoting mechanism. Multiword literals are not part of this version: each argument is one space-separated literal.

### Separator

A standalone `?` is a valid literal, not an operation. Only a standalone token is special; a question mark inside a URL is ordinary URL content.

The first standalone `?` divides an input array into a matching portion and a suffix:

- `.$` uses the suffix as arguments, without fuzzy-matching it.
- `.rm` and `.@` ignore the separator and suffix.
- `.set` first extracts its final destination literal, then ignores the separator and suffix in the remaining input.

### URL and template validation

Accept any valid URL with an **explicit scheme**, allowing anonymous `{}` placeholders as additional template syntax. There is no scheme allowlist: HTTP, HTTPS, file, mail, data, and custom application schemes are all supported.

A scheme does not necessarily require `//`; for example, `mailto:user@example.com` and `myapp:open/{}` are valid forms. Do not infer a scheme or resolve a relative reference against a base URL.

Examples of accepted destinations:

```text
https://example.com/{}
https://{}.example.com/{}
file:///tmp/{}
mailto:{}
data:text/plain,{}
myapp:open/{}
```

Scheme-less destinations such as `example.com/path`, `/path/{}`, and `//example.com/{}` are invalid. Merely containing a colon is not sufficient: the destination must still be a valid URL/template.

Validation must account for `{}` rather than reject a template solely because it contains placeholders. Keep the original template text for literal substitution; validation must not silently encode or rewrite its placeholders.

This is a language-level acceptance rule, not permission for a browser or other host to execute every accepted scheme. Host security policy remains outside this specification.

### Whole-program parsing

Malformed JSON, unsupported standalone intermediate values, and invalid operation syntax fail parsing before any evaluation occurs.

This remains true for malformed source after a result-producing operation. Evaluation may ignore that suffix, but parsing does not.

Errors that depend on the current stack or an operation's operands are evaluation errors, not parse errors. For example, a valid ordinary token in `.set`'s destination position can parse successfully and then fail URL validation during evaluation.

## 3. Interpreter lifecycle

1. Parse the entire source. On a parse error, execute nothing.
2. Check the end of the parsed program. Append `.$` unless its last item is already the **operation** `.$`.
3. Start with an empty data stack.
4. Evaluate values and operations from left to right.
5. Stop immediately when an `R` reaches the stack top. Silently discard the remaining parsed program.
6. Stop on an evaluation error after applying error unwinding.

An escaped literal `..$` does not count as the final search operation.

`.$` may occur earlier in a syntactically valid program. Its result terminates evaluation; subsequent parsed values do not execute. Pushing an `R` literal also terminates evaluation.

The specification describes the final stack, without prescribing a host-language return type.

## 4. Literal accumulation

Let `x` be an ordinary literal (`d`, `u`, or `p`).

```text
[K, L] | x -> [K, L ++ [x]]
[K]    | x -> [K, [x]]        # when the current top is not L
```

The second rule also applies to an empty stack. Result/error termination takes precedence over these rules.

Structured state and result values are pushed separately:

```text
[K] | S -> [K, S]
[K] | R -> [K, R]             # then stop evaluation
```

For example:

```text
[S]                        | company                  -> [S, [company]]
[S, [company]]             | git                      -> [S, [company, git]]
[S, [company, git]]        | https://example.com/{}   -> [S, [company, git, https://example.com/{}]]
```

Do not lowercase, alphabetically sort, or deduplicate an accumulated literal array. Those transformations would destroy argument spelling, ordering, and the boundary inferred by search.

## 5. Dimensions, focus, and fuzzy matching

Stored dimensions are trimmed, lowercase, space-free, deduplicated, and alphabetically sorted. This gives equivalent dimension sets a consistent searchable representation. Focus is also a stored dimension list, not an argument list.

To construct a matching query:

1. Select the operation's explicit matching literals.
2. Use lowercase copies for matching; retain original literals for arguments and result inputs.
3. Prepend the current focus.
4. Remove duplicate dimensions.

Focus is implicit fuzzy-search input, not an exact namespace or an access-control boundary. Setting focus replaces it; it does not prepend the previous focus.

Each target's alphabetically sorted dimensions are joined with spaces into **one searchable string**. Matching and ranking use fzf-style fuzzy matching against that string. A fuzzy token may span dimension boundaries.

Do not import fzf's special query operators, such as negation, anchors, or exact-match syntax. They have no special query-language meaning here. Matching is case-insensitive.

No additional confidence threshold or winner-margin rule is applied. A first-ranked match is not automatically a unique match.

### Complete-list selection versus prefix inference

All matching operations use the same underlying fuzzy matcher, but they choose their query inputs differently:

- `.set` and `.rm` match the **entire explicit matching portion**, combined with focus. They never retry shorter prefixes.
- `.$` can infer the boundary between matching literals and arguments by finding the longest matching prefix.
- `.@` sets focus directly; it does not search for targets.

An empty explicit search uses focus alone. Empty focus with no explicit search tokens selects all targets.

## 6. Operations

### 6.1 `.set`

Successful transition:

```text
[K, S, L] | .set -> [K, S']
```

Interpret `L` in this order:

1. Require its last literal to be a valid URL or destination template.
2. Remove that literal as the destination. Do not search backward for a URL.
3. From the remaining literals, keep only those before the first standalone `?`.
4. Require **at least one explicit dimension** in that retained portion. Focus cannot satisfy this requirement.
5. Combine those dimensions with focus and match the complete combined query.

Apply the match cardinality rule:

| Matching targets | Effect |
| --- | --- |
| Zero | Insert a target containing the normalized combined dimensions and the supplied destination. |
| Exactly one | Replace only that target's destination. Preserve its existing dimensions. |
| More than one | Emit an error; leave the operation's input state unchanged. |

A plain URL is a valid destination with zero placeholders.

Example of extraction order:

```text
S company git ? ignored https://github.com/company/{} .set
```

The final URL is extracted first. The explicit dimensions are then `company git`; `? ignored` is ignored.

These are errors, even when focus is nonempty:

```text
S https://github.com/company/{} .set
S ? ignored https://github.com/company/{} .set
```

Fuzzy updating does not rename dimensions. If `comp git` uniquely matches `[company, git]`, `.set` updates the URL while retaining `[company, git]`.

### 6.2 `.rm`

```text
[K, S, L] | .rm -> [K, S']
[K, S]    | .rm -> [K, S]
```

Take the literals before the first standalone `?`. If none remain, consume the literal array and leave state unchanged without matching, regardless of focus. With no literal array, likewise leave state unchanged.

Otherwise, combine the explicit dimensions with focus and match that complete dimension list. Remove every matching target.

Zero matches is a successful no-op. Multiple matches are allowed. Do not shorten the query to obtain a match.

For example, when `company nonexistent` matches no target:

```text
S company nonexistent .rm
```

removes nothing. It does not retry `company`.

These removal operations are successful no-ops, even with nonempty focus:

```text
S .rm
S ? ignored .rm
```

Focus alone never authorizes removal. The interpreter still appends `.$` as usual, so these programs subsequently search the unchanged state.

### 6.3 `.@`

```text
[K, S, L] | .@ -> [K, S']
[K, S]    | .@ -> [K, S']
```

With `L`, keep the literals before the first standalone `?`, normalize them as stored dimensions, and replace focus with that list. Do not combine them with the old focus.

Without `L`, clear focus to an empty list. A retained empty list likewise sets empty focus.

For example:

```text
S company ? git .@
```

sets focus to `[company]`, not `[company, git]`.

### 6.4 `.$`

```text
[K, S, L] | .$ -> [K, S, R]
[K, S]    | .$ -> [K, S, R]
```

Search does not change state. Producing `R` ends evaluation.

#### Explicit separator

If `L` contains a standalone `?`:

- All literals before it are explicit matching inputs.
- All literals after it are supplied arguments.
- Match the entire explicit matching portion plus focus; do not infer a shorter prefix.
- With an empty matching portion, search using focus alone and retain the suffix as arguments.

Thus URL arguments need no special escape:

```text
S lookup ? https://example.com .$
```

#### Inferred separator

Without `?`, examine nonempty leading prefixes of `L`. Select the **longest prefix yielding at least one matching target** when combined with focus.

The selected prefix supplies the explicit matching inputs. All remaining literals are supplied arguments.

Do not stop at the first unique match: a longer prefix may still match the same target and must be consumed.

If the user supplied matching literals but **no nonempty prefix matches**, return no matches. Do not discard all supplied literals and search using focus alone. Focus itself is never shortened.

With no supplied literals, search using focus alone; with empty focus, select all targets.

Example, with a target whose dimensions are `[company, git]`:

```text
company           -> matches
company git       -> matches
company git axon  -> no matches
```

The selected matching prefix is `company git`; `axon` is the argument.

If instead `company git axon` itself matches a target, the longest-prefix rule consumes `axon` as matching input. Use `?` when an explicit argument boundary is needed.

#### Results

Return one `m` for every selected target, including targets missing arguments. Preserve fuzzy rank order in the match set; presentation can apply the argument-balance grouping described below.

`R.inputs` records the user-supplied literals used as matching inputs, without implicit focus, the separator, or supplied arguments. Preserve their original spelling. For a failed inferred search, retain the attempted explicit input list so the result still identifies the failed query. With a focus-only search, `inputs` is empty.

## 7. Arguments and template rendering

Each anonymous `{}` in the destination template requires one argument, in left-to-right order. Each supplied argument is one literal, preserving its original spelling and case.

For a target with `P` placeholders and `A` supplied arguments:

```text
hint.argDelta = A - P
appliedArgs   = first min(A, P) supplied arguments
```

`hint.argDelta` is the argument-balance field used by this specification. Other hint fields may be added for debugging or custom presentation.

- `0`: exactly enough arguments.
- Positive: extra arguments; ignore them during substitution.
- Negative: missing arguments; leave their placeholders intact.

The `[args]` field in `m` contains the **applied** arguments, not ignored extras. Compute `argDelta` using the full supplied argument count before ignoring extras.

Substitution is literal, not percent-encoding:

```text
Template: https://example.com/{}
Argument: a/b
Result:   https://example.com/a/b
```

Fill placeholders in the original template; replacement text is argument content, not a new round of template syntax.

Examples:

| Template | Supplied arguments | Rendered destination | `argDelta` | Applied arguments |
| --- | --- | --- | --- | --- |
| `https://example.com/{}` | `MyRepo` | `https://example.com/MyRepo` | `0` | `[MyRepo]` |
| `https://example.com/{}` | `axon extra` | `https://example.com/axon` | `1` | `[axon]` |
| `https://example.com/{}/tree/{}` | `axon` | `https://example.com/axon/tree/{}` | `-1` | `[axon]` |
| `https://example.com/{}` | none | `https://example.com/{}` | `-1` | `[]` |
| `https://example.com/` | `ignored` | `https://example.com/` | `1` | `[]` |

Presentation prioritizes argument-balance groups in this order:

1. Exact counts (`0`).
2. Extra arguments (positive).
3. Missing arguments (negative).

A direct-navigation candidate requires exactly one selected target and a nonnegative argument balance. Missing-argument matches remain in `R.matches` and count toward ambiguity. UI sorting must not turn multiple selected targets into a unique match.

## 8. Errors and state preservation

Any operation with no matching stack rule emits an evaluation error. Operand validation failures and ambiguous `.set` selection also emit evaluation errors.

When emitting an error:

1. Pop stack elements until the nearest valid `S` reaches the top, or until the stack is empty.
2. Preserve that `S` and everything below it.
3. Push `E`.
4. Stop evaluation.

For example:

```text
[S0, L0, S1, L1] -> [S0, L0, S1, E]
```

Unwinding does not inspect or rewrite values below the retained state.

With no state anywhere in the stack:

```text
[L] -> [E]
```

Operations must preserve their input state until they have succeeded. An ambiguous `.set` must not consume or partially modify `S` before emitting its error.

Earlier successful operations are **not rolled back** on a later evaluation error. The retained state is the nearest working state at the point of failure, not necessarily the initial state.

A parse error is different: because parsing completes before evaluation starts, no earlier operation in that source has executed.

## 9. Worked programs

These examples use `S`, `S0`, and `S1` as explanatory names for actual state JSON values; they are not source-level variable bindings.

### Create and implicitly search

```text
["S", {"targets": [], "focus": []}]
company git https://github.com/company/{} .set
```

The interpreter appends `.$`. `.set` inserts `[company, git]` and leaves the updated state. The appended search selects all targets because focus and explicit search input are empty.

Final shape:

```text
[S', R]
```

`R` contains the new target with its `{}` intact, no applied arguments, and `argDelta: -1`.

### Navigate with inferred arguments

```text
["S", {
  "targets": [[["company", "git"], "https://github.com/company/{}"]],
  "focus": []
}]
Company Git MyRepo
```

The implicit `.$` matches `Company Git` case-insensitively and treats `MyRepo` as the argument.

Result:

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
git ? axon .$
```

Both targets appear in `R.matches`:

```text
https://github.com/company/axon         argDelta:  0
https://github.com/personal/axon/tree/{} argDelta: -1
```

The result is ambiguous even though only one URL is complete. Their actual match-array ordering follows fuzzy ranking, not the order used to display this example.

### Focus and mutation

```text
S company .@ git https://github.com/company/{} .set
```

Set focus to `[company]`, then set a target using explicit dimension `git`. An insertion stores `[company, git]`. The appended search uses focus alone.

### Literal operation name as an argument

```text
S company git ? ..rm .$
```

The argument is the literal `.rm`; no removal operation executes.

### Stop at the first result

```text
S0 git .$ S1 docs .$
```

Parse the entire program, execute the first search, and stop with its `[S0, R]`. Do not push `S1` or execute the second search.

### Failed `.set` preserves prior work

Suppose the original focus is `[personal]` and `git` matches more than one target when focus is empty:

```text
S company .@ .@ git https://example.com/{} .set
```

The first `.@` sets focus and the second clears it. `.set` then fails due to ambiguity. The final error stack retains the state with cleared focus, not the original state.

## 10. Remaining precision questions

The core transitions above are agreed. These details still need to be pinned down before an implementation claims exact compatibility:

- **Fuzzy scoring:** concrete fzf-compatible algorithm/library/version, multi-token score aggregation, and deterministic tie-breaking. No extra confidence threshold or fzf query operators should be introduced while choosing these.
- **URL parsing details:** the concrete URL standard/parser and precise structural validation of templates containing `{}`. Acceptance of any scheme, the explicit-scheme requirement, and support for placeholders are settled. Raw argument substitution can also produce unusual URLs; browser/security policy is outside this language specification.
- **Character rules:** exact whitespace handling, Unicode lowercasing, and alphabetical collation. These must be consistent across stored dimensions and matching copies.
- **Incoming state/result validation:** treatment of noncanonical dimension arrays, duplicate targets, and unknown fields in supplied JSON envelopes. Do not silently assume whether these are normalized or rejected.
- **Error details:** diagnostic field names/codes and whether a literal `["E", {}]` may appear in source. Runtime-generated errors and their unwind behavior are defined above.

Implementation work should resolve these explicitly rather than changing the agreed operation semantics as a side effect.

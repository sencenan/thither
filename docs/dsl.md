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
| `d` | Dimension literal | A space-free literal. Preserve source spelling during evaluation; normalize when used as a stored dimension. In a search query or in focus a literal may also carry a **search operator** (section 3); a target's dimension never does. |
| `L` | Literal array | An ordered array of ordinary literals: dimensions, URLs, or templates. Created by accumulation during evaluation. |
| `k` | Key | A target's normalized dimensions joined with single spaces (section 3). A target's identity and the text matching runs against. |
| `t` | Target | One entry `k: [p]` of a target set: a key paired with its **variants**, destination templates of pairwise distinct **arity** (number of `{}`) in arity-ascending order. A plain URL is a variant of arity zero. |
| `T` | Target set | `{ k: [p] }`: an object keyed by `k`, at most one target per key. |
| `S` | State of the world | `["S", { "targets": T, "focus": [d], "alias": { string: string } }]`. |
| `m` | Match | `[u_or_p, p, k, [args], hint]`: the rendered destination, the variant's template it was rendered from, the target's key, the applied arguments, and a `hint` carrying at least `argDelta`, `on`, `positions`, and `score`. Missing arguments may leave a partially rendered template in the first slot. |
| `M` | Match set | `[m]`, including matches with missing arguments. |
| `R` | Search result | `["R", { "matches": M, "inputs": [d], "args": [d] }]`. |
| `E` | Error | `["E", { "type": string, "description": string }]`; additional diagnostic fields are permitted. |

The `[d]` and `[args]` notation means an array, not necessarily a single element.

`t` and `T` occur inside `S`; `m` and `M` occur inside `R`. They cannot appear as standalone program values; such input parses to `E`. `S`, `R`, and `E` are permitted top-level JSON values.

A match is **one variant of a selected target**, not necessarily a fully rendered destination. Producing an `R` does not itself mean navigation can proceed.

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
| `[K]` | `E` | `[K, E]` | Push an explicit error and stop; nothing is taken off the stack. |
| `[K, S, L]` | `.set` | `[K, S']` | No target with the resulting key appends one; an existing target replaces or gains the variant of the destination's arity. |
| `[K, S, L]` | `.rm` | `[K, S']` | Remove the target with the exact key, or with a separator only its variant of the arity the suffix length names; a multi-variant target without a separator, no explicit dimensions, or no such key is a no-op or error. |
| `[K, S]` | `.rm` | `[K, S]` | No explicit dimensions: leave state unchanged. |
| `[K, S, L]` | `.@` | `[K, S']` | Replace focus with the dimensions before `.`. |
| `[K, S]` | `.@` | `[K, S']` | Clear focus. |
| `[K, S, L]` | `.$` | `[K, S, R]` | Search, render matches, and stop. |
| `[K, S]` | `.$` | `[K, S, R]` | Search using focus alone; empty focus selects all targets. Stop. |
| `[K, S, L]` | `.alias` | `[K, S']` or `[K, S', L']` | Define an alias: the last two literals of `L` are its short form and literal; the literals before them stay as `L'`. A separator in `L`, or a single literal, is an error. |
| `[K, S1, S2]` | `.merge` | `[K, S']` | Merge `S2` into `S1`: targets and alias definitions united, `S2` winning conflicts; focus is `S2`'s. |
| Any invalid stack or operands | Operation | Push what the operation puts back, then `E` | A failed operation never loses a state it took; see section 6. |

Accumulation keeps literals exactly as supplied. Do not lowercase, sort, or deduplicate `L`: that would destroy argument spelling, ordering, and the boundary inferred by search.

```text
[S]                        | company                  -> [S, [company]]
[S, [company]]             | git                      -> [S, [company, git]]
[S, [company, git]]        | https://example.com/{}   -> [S, [company, git, https://example.com/{}]]
```

### Lifecycle

1. Build the program by appending parsed items in order. An unparsable item becomes an `E` value at that position; earlier items remain executable.
2. The interpreter appends nothing. A host that wants a search to close every program appends the **operation** `.$` itself, along with any host operations of its own (see [ADR 0007](adr/0007-hosts-compose-the-program.md)). An escaped literal `..$` is not an operation.
3. Start with an empty data stack and evaluate left to right.
4. Stop when an `R` or explicit `E` reaches the top, discarding the rest of the program. Pushing an explicit `E` takes nothing off the stack.
5. Stop on a generated evaluation error, leaving the stack as section 6 describes.

`.$` may occur earlier in a valid program; its result terminates evaluation, so later values never execute. The specification describes the final stack, without prescribing a host-language return type.

## 2. Source syntax and parsing

A program is built one item at a time: `pushToken(program, tokenOrValue) -> program`. The core parses a **single** item per call and never tokenizes a multi-item string. Hosts split user input on JavaScript whitespace (`\s`) and append the resulting tokens in order.

Each appended item is either:

- a **string token**, interpreted as one value's textual form: an ordinary literal, the separator `.`, an escaped literal, or an operation; or
- a **structured value** supplied as a JavaScript object, such as an `S`, `R`, or `E` envelope, normalized and validated on parse.

Worked examples write structured values inline, such as `S company git .set`. That is notation for a supplied structured value followed by string tokens, not a claim that a host must serialize state into text.

Supported operations are:

```text
.set    insert or update a target
.rm     remove a target by exact key
.@      replace or clear focus
.$      search and produce a result
.alias  define an alias
.merge  merge two states into one
```

Ordinary literals retain their spelling and order. URL literals and templates accumulate exactly like dimensions, so a URL-valued argument needs no escaping. A string token is trimmed; one that is empty after trimming, or still contains whitespace, is not a single literal and parses to `parse_error`. The core never splits it.

### Separator and escaping

A leading dot is the language's control syntax: `.set`, `.rm`, `.@`, `.$`, and `.alias` are operations, and a **standalone `.`** is the argument separator. The one other marker is a leading `~`, which makes a literal an alias (below). Every other token is data. Only the standalone token is a separator; a dot inside a literal or URL, as in `node.js` or `example.com`, is ordinary content.

A leading double dot escapes a dot-prefixed token: parsing keeps the token verbatim as an ordinary literal, `..` and all. One leading dot is removed whenever the literal is later *used* — both when it is matched and when it is substituted into a destination — while the accumulated form retains the `..`. So `..git` matches as `.git` and renders as `.git`.

```text
..rm   -> literal ..rm   (resolves to .rm)
..set  -> literal ..set  (resolves to .set)
..$    -> literal ..$    (resolves to .$)
..     -> literal ..     (resolves to .)
```

A leading `.~` escapes an alias the same way: the token is an ordinary literal kept verbatim, `.~` and all, never resolved, and one leading dot is removed when it is used.

```text
.~gh   -> literal .~gh   (resolves to ~gh)
.~     -> literal .~     (resolves to ~)
```

Escaped tokens are not interpreted again as operations. An unescaped dot-prefixed token that the interpreter's environment does not bind to an operation parses to an `E` of type `missing_operation`. The environment supplies the operation set; by default it is exactly the six above, and a host may extend it (see [ADR 0005](adr/0005-extensible-interpreter-environment.md)). Double-quoted tokens are not a quoting mechanism, and multiword literals are not part of this version: each argument is one space-separated literal.

The first standalone `.` divides an input array into a **matching portion** and a **suffix**. Each operation in section 4 says what it does with them: `.$` takes the suffix as arguments, `.rm` reads only its length, and `.set` and `.@` ignore it.

### Search operators

The matching portion is handed to the matcher as an fzf **extended-search** query, so fzf's operators are part of the language. They are recognised only at the edges of a term:

```text
git docs      both terms must match                (AND, the default)
git | docs    either term may match                (OR; `|` is its own token)
!personal     the term must not match              (NOT, exact substring)
'ompany       exact substring, not fuzzy
^git          the key starts with git
git$          the key ends with git
^git$         the key is exactly git
```

A bare `$` is plain text. A token that is nothing but operator syntax (`!`, `'`, `^`, `^$`, ...) has no text to match; the matcher would drop it silently, so it parses to `parse_error`. There is no escape for these characters: a leading `!`, `'` or `^`, a trailing `$`, and a standalone `|` are reserved, in queries and in a target's dimensions alike. Operator-carrying terms are legal wherever a literal is search input — the matching portion of `.$`, and focus set by `.@` — and refused by `.set` and `.rm`, whose dimensions are stored or matched as a key (sections 4.1 and 4.2).

### Aliases

A literal written `~` followed by at least one character is an **alias**: it stands for the literal of the **alias definition** whose short form is the rest of the literal, lowercased (section 4.5). A bare `~` has no short form and is plain text. Parsing does not resolve aliases; it keeps `~gh` as an ordinary literal, and the operations that read literals as search input resolve it against the alias definitions of the state they operate on:

- `.@` resolves its matching portion before storing it as focus, so focus never holds an alias (section 4.3).
- `.$` resolves its whole literal array, matching inputs and arguments alike, before inferring the boundary (section 4.4).

Resolution replaces an alias that has a definition with the definition's literal, once: that literal is not resolved again, and it keeps any escape it carries, so an alias defined as `..set` resolves to the text `.set` when used and never runs the operation. An alias with no definition stays as typed, spelling and case included. An alias defined earlier in the same program resolves, since resolution reads the state at the moment the operation runs.

`.set` and `.rm` never resolve aliases, so that an alias cannot silently decide which target is written or removed: an alias anywhere in their literal array is `invalid_dimension` (sections 4.1 and 4.2). An escaped `.~x` is not an alias and is accepted, giving the dimension `~x`.

```text
S gh github .alias ~gh .@     focus [github]
S ~gh ~me .$                  searches github, with me's defined literal as its argument
S ~nope .$                    searches the text ~nope
S https://x/ ~gh .set         invalid_dimension
S https://x/ .~gh .set        sets a target keyed ~gh
```


### URL and template validation

Accept any valid URL with an **explicit scheme**, allowing anonymous `{}` placeholders as additional template syntax. There is no scheme allowlist, and a scheme does not require `//`. Do not infer a scheme or resolve a relative reference against a base URL.

Validate by rendering, not by parsing the raw template: replace every `{}` with a probe token, then validate that rendered string with the standard WHATWG `URL` parser. No single probe is valid in every position — a port must be all digits, a scheme must begin with a letter — so render with **both** a word probe (`thither`) and a digit probe (`1`), and accept the destination when **either** rendering parses with an explicit scheme. Store and later substitute into the **original** template text, never the parser's normalized output of a probe.

```text
accepted:  https://example.com/{}    https://{}.example.com/{}   file:///tmp/{}
           mailto:{}                 data:text/plain,{}          myapp:open/{}
           {}://example.com          (renders as thither://example.com, word probe)
           https://localhost:{}      (renders as https://localhost:1, digit probe)

rejected:  example.com/path          /path/{}                    //example.com/{}
           https://exa mple.com/{}
```

Placeholders may appear in any position, including the scheme. Merely containing a colon is not sufficient. Substituting actual arguments can still produce a different, possibly invalid, URL at navigation time; template acceptance is not a promise about every rendered result, nor permission for a host to execute every accepted scheme.

This rule applies wherever a destination is accepted, including `.set` operands and every variant inside supplied state.

### Parse failures are values

Parsing is total: an item that is not a valid value parses to an `E` value appended to the program, rather than throwing or rejecting the whole program. Malformed structured values, unsupported standalone intermediate values, and invalid operation syntax all take this path.

Execution therefore applies every item preceding the first `E`, then pushes that `E` and stops. Given previous state `S` and the input `git .rm @@bad`, the removal is applied and the final stack is `[S', E]`. Items after the first `E` are never reached, so `[S, E, E']` cannot arise. Appending text is not atomic: a later invalid token does not undo earlier valid mutations from the same input.

Errors that depend on the current stack or an operation's operands are evaluation errors instead. A valid ordinary token in `.set`'s destination position parses successfully and can then fail URL validation during evaluation.

### Supplied structured values

Validate supplied values in the core, not the browser client. Reject malformed required structures. A supplied `S` carries only `targets`, `focus`, and `alias`: an omitted field defaults to empty (`{}`, `[]`, and `{}` respectively), so `["S", {}]` is the empty state, and any other field makes the `S` invalid, so it parses to `E`. The `alias` field holds the alias definitions: an object whose short forms and literals are each a single literal (non-empty, whitespace-free, not the separator) not starting with `~`; anything else makes the `S` invalid. A supplied `R` carries only its defined fields; unknown fields on it are dropped, not preserved. An `E` payload is the exception: it may carry diagnostic fields beyond the required `type` and `description`, which are kept as uninterpreted data and never acquire execution semantics. Its `type` must still be one of section 6's vocabulary values; an `E` whose `type` is outside that vocabulary is malformed and parses to `parse_error`.

Normalize each supplied `S`'s target keys by the rules of section 3: a key is split on whitespace into dimensions, each dimension normalized, and the result rejoined. A key that is empty after normalization, or that carries a search operator, is invalid. Focus is kept verbatim; a focus term that is empty, contains whitespace, or is operator-only is invalid. Normalization does not change target order, variant text, focus, argument spelling, or `R.inputs`.

Within each target set, every normalized key must be unique. Two targets whose keys normalize to the same text make the value invalid, so it parses to `E`, whether their variants differ or are identical. Detect duplicates after normalization; do not merge targets or choose one. Different `S` values in a program may independently contain the same keys. For example, the key `"Git  company git"` normalizes to `"company git"`, so a second target keyed `"git company"` in that same target set makes the state invalid.

Within each target, every variant must be a valid destination template and no two variants may share an arity: `["https://a/{}", "https://b/{}"]` is invalid. Variants are stored in arity-ascending order; a supplied list in another order is sorted on parse, since the order carries no information.

Validation happens when an item is parsed, not when it is reached. An invalid value placed after a terminal result therefore still parses to `E`, but evaluation stops before reaching it.

Hosts reuse this parse step to validate data they hold, such as manually supplied reset JSON. A value that parses to `E` must not replace persisted data.

## 3. Dimensions, focus, and matching

A target's dimensions are trimmed, lowercase, whitespace-free, deduplicated, and deterministically sorted. Use JavaScript's standard `trim()` and locale-independent `toLowerCase()`, followed by default string sorting (lexicographic UTF-16 code-unit order). Do not use locale-sensitive lowercasing or collation. Internal whitespace is invalid, not a request to split one supplied dimension into several.

Focus is **not normalized at all**: it is stored exactly as accumulated, in typed order with its original case, like any literal array. It is a query fragment, so `|` binds the terms on either side of it by position, and an uppercase focus term is a case-sensitive term under smart-case just as it would be typed into a search. Each focus term must still be a valid single literal: non-empty, whitespace-free, and not operator-only (section 2).

A target's **key** is its normalized dimensions joined with single spaces. Equivalent dimension sets therefore share one key, and the key is both the target's identity (what `.set` and `.rm` compare) and the text the matcher runs against (what `.$` searches). Focus is a stored list of search terms, not a key and not an argument list, and setting it replaces it rather than extending it. Focus is implicit fuzzy-search input for `.$` only, never part of what `.set` or `.rm` name, and not an exact namespace or an access-control boundary.

**Target-set order** is the order targets occupy in the state's target map. A supplied `S` keeps the order it was given, as far as the host language's object iteration preserves it; `.set` appends a newly inserted target to the end; changing an existing target's variants leaves it in place; `.rm` removes targets without reordering the rest. It is the **final** tiebreak, applied only after section 5's length tiebreaks cannot separate two targets, and nothing more is promised of it.

To construct a matching query for `.$`:

1. Select the operation's explicit matching literals, resolving escapes (section 2).
2. Prepend the current focus, resolving its escapes likewise (focus is stored in accumulated form).
3. Keep the result as given: typed order, original case, no deduplication. It is an fzf query, and fzf owns its interpretation.

The query terms are joined with spaces into **one fzf extended-search query** and matched against each target's key: every term must match (an OR group counts as one term), and a target is selected when they all do. Its score is the sum of the per-term scores; a NOT term contributes nothing. A single term is fuzzy-matched against the whole key, so it may span dimension boundaries: `am` selects `apple mango`. Terms are independent of one another, so `m ppl` and `pple m` both select `apple mango` too.

Term order does not affect selection or score except around `|`, which binds the terms on either side of it: with focus `[company]`, the query `git | docs` is `company AND (git OR docs)`. Only `.$`'s prefix inference otherwise cares about the user's original token order.

Casing follows fzf's **smart-case**: a term written entirely in lowercase matches case-insensitively, and a term containing an uppercase letter matches case-sensitively. Keys are lowercase, so an uppercase term matches no key: `Git` finds no key where `git` finds every git target. An uppercase letter is read as a deliberate request for case-sensitive matching, and the language does not second-guess it — so under `.$`'s prefix inference (section 4.4), `company Git MyRepo` stops matching at `company` and takes `Git` as the first argument. Matching is diacritic-insensitive for a term written without diacritics: `cafe` matches `café`. No confidence threshold or winner-margin rule is applied, so a first-ranked match is not automatically a unique match.

Operations differ only in how they choose query inputs:

- `.rm` does not search. Like `.set`, it normalizes its explicit dimensions into a key and looks for that exact key (section 4.2); focus plays no part, and operator terms are refused.
- `.set` does not search. It normalizes its explicit dimensions into the key it would store and looks for that exact key (section 4.1); focus plays no part, and operator terms are refused.
- `.$` infers the boundary between matching literals and arguments: the longest matching prefix, trimmed of trailing literals that add no matching evidence (section 4.4); operator terms take part in that inference like any other term. When no key matches, `.$` runs the same query against destination templates instead (destination search, section 4.4).
- `.@` sets focus directly; it does not search for targets.

An empty explicit query searches on focus alone; empty focus with no explicit input selects all targets.

## 4. Operations

Each operation except `.alias`, which takes no separator (section 4.5), and `.merge`, which takes no literal array (section 4.6), reads the matching portion defined in section 2, normalizes dimensions by section 3, and validates destinations by section 2.

### 4.1 `.set`

```text
[K, S, L] | .set -> [K, S']
```

Interpret `L` in this order:

1. Remove its first literal as the destination and require it to be a valid URL or destination template; a first literal that fails validation is `invalid_destination`, whatever it looks like. Do not search forward for a URL. A plain URL is a valid destination with zero placeholders.
2. From the remaining literals, keep the matching portion.
3. Require **at least one explicit dimension** there. Focus is not consulted and cannot satisfy this requirement.
4. Normalize those dimensions into a key (section 3) and look for a target with **exactly that key**. This is string equality, not a search: no fuzzy matching, no prefix, no focus.

| Target with that key | Effect |
| --- | --- |
| None | Append a target with that key and the supplied destination as its only variant to the end of the target set. |
| Exists, and has a variant of the destination's arity | Replace that variant with the supplied destination. Preserve the target's key, other variants, and position. |
| Exists, without a variant of that arity | Add the destination as a new variant, keeping the list in arity-ascending order. Preserve the target's position. |

Because `.set` compares keys rather than searching, `jira` and `company jira` are different targets even though a search for `jira` selects both: given an existing `company jira`, `https://jira.example.com jira .set` creates a second target keyed `jira` rather than touching the first. A variant is addressed by arity alone, so setting a second template with the same number of `{}` replaces the earlier one, and there is no way to hold two arity-1 templates under one key.

An explicit dimension carrying a search operator (section 2) is `invalid_dimension`: what `.set` stores is a key, and a key is plain text. An alias anywhere in `L` — destination, dimension, or suffix — is `invalid_dimension` too, checked before the destination is validated, since `.set` does not resolve aliases (section 2). Uppercase is not an error; `Git` normalizes to `git` and finds the same key.

```text
S https://github.com/company/{} company git . ignored .set
```

The URL leads and is extracted first, so the explicit dimensions are `company git` and `. ignored` plays no part.

```text
S https://jira.example.com jira .set
S https://jira.example.com/browse/{} jira .set
```

The first program creates a target keyed `jira` with one arity-0 variant; the second adds an arity-1 variant to it. The target's variants are now `[https://jira.example.com, https://jira.example.com/browse/{}]`.

These are errors, even when focus is nonempty, because no explicit dimension remains:

```text
S https://github.com/company/{} .set
S https://github.com/company/{} . ignored .set
```

### 4.2 `.rm`

```text
[K, S, L] | .rm -> [K, S']
[K, S]    | .rm -> [K, S]
```

`.rm` does not search. Like `.set` (section 4.1), it normalizes its explicit dimensions into a key and looks for a target with **exactly that key**: string equality, no fuzzy matching, no prefix, no focus. This is deliberately narrow — fuzzy matching let a one-letter shortcut authorize removal of every target whose key merely contained that letter, which is too destructive for a delete.

With no literal array, or a matching portion that is empty, leave state unchanged without matching, regardless of focus. Focus alone never authorizes removal:

```text
S .rm
S . x .rm
```

An explicit dimension carrying a search operator (section 2) is `invalid_dimension`, exactly as in `.set`: what `.rm` names is a key, and a key is plain text. An alias anywhere in `L`, the arity suffix included, is `invalid_dimension` too, since `.rm` does not resolve aliases (section 2). Uppercase is not an error; `Git` normalizes to `git` and names the same key.

A key with no target is a successful no-op: `S nonexistent .rm` removes nothing. When a target is found, what is removed depends on the separator:

- **Without a separator**, remove the target whole — but only when it is **unambiguous**. A target with a single variant is removed. A target with **more than one variant** is `missing_operand`: to remove more than one page you must name which by arity, using the `. x x x` separator syntax below. This keeps a bare `.rm` from silently deleting every variant of a target at once.
- **With a separator**, the suffix is not arguments: its **length is an arity**. Remove from the target the variant of that arity, if it has one; a target with no such variant is left as it is. A target whose last variant is removed is removed itself. The suffix tokens' text is irrelevant; only their count is read.

```text
S jira .rm            remove jira if it has a single variant; otherwise missing_operand
S jira . x .rm        remove its arity-1 variant
S jira . .rm          remove its arity-0 variant
S jira . a b .rm      remove its arity-2 variant, if any; otherwise no change
```

Because `.rm` names a key rather than searching, `jira` and `company jira` are different targets: `S company jira .rm` never touches a target keyed `jira`. A host that appends `.$` makes the no-op programs go on to search the unchanged state.

### 4.3 `.@`

```text
[K, S, L] | .@ -> [K, S']
[K, S]    | .@ -> [K, S']
```

Replace focus with the matching portion exactly as accumulated (section 3: no normalization), after resolving its aliases (section 2), without combining it with the old focus. No literal array, or an empty matching portion, clears focus. So `S company . git .@` sets focus to `[company]`, not `[company, git]`.

Focus is only ever prepended to a search query (section 3), so it may carry search operators: `!personal .@` makes every later `.$` exclude personal targets until focus changes. `.rm` does not consult focus.

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

**Without a separator**, examine nonempty leading prefixes of `L` and select the **longest prefix yielding at least one matching target** when combined with focus. Do not stop at the first unique match: a longer prefix may still match the same target and must be consumed.

```text
company              -> matches
company git          -> matches
company git thither  -> no matches
```

For a target keyed `company git`, the selected prefix is `company git` and `thither` is the argument.

Then **trim** that prefix: a trailing literal that added no matching evidence is not matching input. A literal adds evidence when appending it to the query **changes which targets are selected**, or **matches a character of a selected key that no earlier term matched**. Drop such literals from the end of the prefix, one at a time, until the last literal adds evidence or only the first literal remains — the first literal is always matching input. What remains supplies the matching inputs; the rest of `L` are arguments.

Fuzzy matching is why this step exists: a one-letter argument matches almost any key, so without it the longest-prefix rule would swallow it. Against a single target keyed `api docs` with the variant `https://docs.example.com/api/{}/{}`:

```text
api a        -> `a` re-hits the a of api: no new evidence, so it is the first argument
api a b      -> https://docs.example.com/api/a/b
api docs a b -> `docs` matches four new characters and is consumed; a and b are the arguments
api a docs   -> `docs` adds evidence, so everything before it is matching input too
```

The boundary sits after the **last** literal that adds evidence, not the first that does not: an OR group `git | docs` is informative as a whole even though the standalone `|` changes nothing by itself. Conversely a NOT term that excludes no target, or a key word typed twice, adds nothing and becomes an argument. Use `.` when an explicit boundary is needed.

If the user supplied matching literals but **no nonempty prefix matches**, every literal is matching input and there are no arguments. Do not discard all supplied literals and fall back to focus; focus itself is never shortened.

**Destination search.** When the search above selects no target — with or without a separator — run the **same query** (focus then the matching portion, operators live) against each variant's **destination template** instead of the key ([ADR 0014](adr/0014-destination-search-when-no-key-matches.md)). Each variant is matched on its own, against its raw template, `{}` included. A target is selected when at least one of its variants matches, and **only the variants that matched** yield matches; arguments are applied to them exactly as for a key match (section 5) — the separator's suffix when there is one, none otherwise. Their evidence says it came from the destination (section 5). If no template matches either, return no matches.

With a target keyed `jira` whose variants are `[https://jira.example.com, https://jira.example.com/browse/{}]`, no key contains `browse`, so `browse . PROJ` matches only the second variant's template and yields one match, `https://jira.example.com/browse/PROJ`, with destination evidence. Its arity-0 sibling did not match and is not listed.

For every selected target, emit **one match per variant**, each rendered as far as the arguments allow (section 5), so the fallback page can show every page the target could have meant. A target's **best fit** — the variant whose arity equals the number of arguments — is not singled out in the result; it is simply the match with a zero argument balance (there is at most one, since a target has at most one variant per arity), which ordering (section 5) leads with. Order the matches as section 5 defines; clients render that order rather than re-sorting.

With a target keyed `jira` whose variants are `[https://jira.example.com, https://jira.example.com/browse/{}]`:

```text
jira               two matches: https://jira.example.com (best fit, argDelta 0) then …/browse/{} (argDelta -1)
jira PROJ          two matches: …/browse/PROJ (best fit, argDelta 0) then https://jira.example.com (argDelta +1)
jira PROJ extra    two matches: no variant has arity 2, so neither is a best fit
```

The first two programs each have a best fit — the argDelta-0 row — and can navigate directly to it (section 5); the third has none, so it only ever shows the fallback page.

`.$` resolves the aliases in `L` before anything else (section 2), so inference, matching, rendering, and `R.inputs` all see the defined literals. `R.inputs` records the user-supplied literals used as matching inputs, in their original spelling after that resolution, excluding focus, the separator, and arguments, whether the key search or destination search found the matches. A failed inferred search still reports the attempted input list, so the result identifies the failed query. A focus-only search has empty `inputs`.

`R.args` records the arguments the search took, in the same accumulated form and order: the suffix after a separator, or the literals inference gave back. A search with no arguments, including one where no prefix matched, has empty `args`. Together, `inputs` and `args` are exactly what the search consumed, so a host can rebuild that search as `inputs`, then `.` and `args` when there are any. A supplied `R` without `args` has none.

### 4.5 `.alias`

```text
[K, S, L ++ [a, b]] | .alias -> [K, S', L]
[K, S, [a, b]]      | .alias -> [K, S']
```

Define an alias: the last two literals of `L` are its short form `a` and the literal `b` it stands for. `S'` is `S` with the alias definition `a -> b`, held as `alias[a]` set to `b`, overwriting any existing definition for that short form; targets, focus, and the other alias definitions are unchanged. Only the pair is consumed: any earlier literals stay on the stack, in order, as a literal array above `S'`.

The short form is lowercased and otherwise kept exactly as accumulated; the literal is kept exactly as accumulated, spelling and case included. Either may carry search operators, and an escaped literal keeps its escape, as focus does (section 3). Neither may start with `~`, so a definition's literal is never itself an alias; an escaped `.~x` does not start with `~` and is accepted. `.alias` does not resolve its own literals. How an alias is resolved is section 2's *Aliases*.

`.alias` takes no argument separator. An `L` containing `.` anywhere, or whose pair has a half starting with `~`, is `missing_operand` before anything is consumed, so the stack keeps both `S` and `L` beneath the error. An `L` with a single literal is `missing_operand` after that literal is consumed: `[S, [gh]] | .alias -> [S, E]`.

```text
S gh github .alias          defines gh -> github
S GH GitHub .alias          defines gh -> GitHub
S company gh github .alias  defines gh -> github; [company] stays on the stack
S gh .alias                 missing_operand; [S, E]
S gh . github .alias        missing_operand; [S, [gh, ., github], E]
S ex ~gh .alias             missing_operand; [S, [ex, ~gh], E]
```

### 4.6 `.merge`

```text
[K, S1, S2] | .merge -> [K, S']
```

Merge two states into one: `S2`, the top, into `S1`. `S'` holds:

- **Targets**: every target of either state. A key only one state holds keeps its variants. A key both hold has `S1`'s variants with each of `S2`'s added as `.set` adds a destination (section 4.1): `S2`'s variant replaces `S1`'s of the same arity, the rest are kept, and the list stays in arity-ascending order.
- **Target-set order**: `S1`'s targets keep their order, a key both hold included; `S2`'s other targets follow, in `S2`'s order.
- **Focus**: `S2`'s, exactly as stored, even when empty. The two focuses are never combined.
- **Alias definitions**: every definition of either state; `S2`'s wins a short form both define.

With `S1` holding `jira: [https://jira.a.com, https://jira.a.com/browse/{}]` and `S2` holding `jira: [https://jira.b.com/{}, https://jira.b.com/{}/{}]`, `S'` holds `jira: [https://jira.a.com, https://jira.b.com/{}, https://jira.b.com/{}/{}]`.

`.merge` takes no literal array and resolves no aliases. Both operands are valid states, so their merge is too, and `.merge` fails only on its operands: anything but two states on top of the stack is `missing_operand`. A state it took goes back beneath the error; a value that is not a state where one is expected stays where it is (section 6).

```text
S1 S2 .merge         [S']
S .merge             [S, E]
x S .merge           [[x], S, E]
S1 x S2 .merge       [S1, [x], S2, E]
S x .merge           [S, [x], E]
S1 S2 x .merge       [S1, S2, [x], E]
```

## 5. Arguments, rendering, and match ordering

Rendering is per variant. Each anonymous `{}` in a variant requires one argument, in left-to-right order. Each supplied argument is one literal, preserving its original spelling and case. For a variant of arity `P` and `A` supplied arguments:

```text
hint.argDelta = A - P
appliedArgs   = first min(A, P) supplied arguments
```

Extra arguments are ignored during substitution; missing ones leave their placeholders intact. The `[args]` field in `m` contains the **applied** arguments only, but `argDelta` counts every supplied argument. An escaped argument is resolved on use (section 2): `..git` substitutes as `.git`, and `[args]` reports that resolved spelling, while `R.inputs` keeps the accumulated `..git`.

Substitution is literal, not percent-encoding, and fills the original template; replacement text is argument content, not a new round of template syntax. An argument that is itself `{}` fills its slot and is never re-read as a placeholder.

The variant's template travels with its rendering: `m` carries the template in its second slot beside the destination in its first. Filling the template's `{}` left to right with the applied arguments, an unfilled slot keeping its placeholder, reproduces the destination exactly, so a presentation layer can show which `{}` each argument filled and which stayed open by walking the template slot by slot, without searching the rendered destination for argument text (which is ambiguous when that text also occurs in the template).

| Template | Supplied arguments | Rendered destination | `argDelta` | Applied arguments |
| --- | --- | --- | --- | --- |
| `https://example.com/{}` | `MyRepo` | `https://example.com/MyRepo` | `0` | `[MyRepo]` |
| `https://example.com/{}` | `thither extra` | `https://example.com/thither` | `1` | `[thither]` |
| `https://example.com/{}` | `a/b` | `https://example.com/a/b` | `0` | `[a/b]` |
| `https://example.com/{}/tree/{}` | `thither` | `https://example.com/thither/tree/{}` | `-1` | `[thither]` |
| `https://example.com/{}/tree/{}` | `{} y` | `https://example.com/{}/tree/y` | `0` | `[{}, y]` |
| `https://example.com/{}` | none | `https://example.com/{}` | `-1` | `[]` |
| `https://example.com/` | `ignored` | `https://example.com/` | `1` | `[]` |

### Matching evidence

Each match reports why it matched, so a presentation layer can highlight without re-running the matcher:

- `hint.on`: what the query was matched against — `"key"` for the target's key, or `"destination"` for the variant's destination template, when the match came from destination search (section 4.4). An `R` supplied without `on` in a hint is read as `"key"`.
- `hint.positions`: the ascending, deduplicated character indices matched within what `on` names — the target's key, or the variant's raw template — the union over every term of the query; NOT terms contribute none, and a key's joining spaces are never among them. Because a term may span dimension boundaries, these are string indices, not dimension indices. A destination position may fall inside a `{}`.
- `hint.score`: the match's ranking score, the sum of the matcher's score for each term.

Every key match of one target carries the same `positions` and `score`: they describe the target, and the variants share them. Destination matches describe their own variant, so variants of one target may differ; the target's score, for ordering, is its best variant's.

These fields are evidence, not presentation instructions: the language defines no highlight markup, colour, or label. Other hint fields may be added for debugging or custom presentation.

A query with no dimensions still produces ordinary matches, with empty `positions` and a `score` of `0`, because an empty pattern matches every target with no evidence. Every target then ties on score, so ordering falls to the length tiebreaks below — shortest key first — and only then to target-set order.

### Match ordering

`R.matches` is emitted in one total order, so a client renders it top to bottom without sorting. The rows of one target are **contiguous**: targets are ordered first, then each target's rows within its run. Compare two targets by:

1. **`hint.score` descending.** A destination-search target's score is its best variant's (section 4.4).
2. **Key length ascending.** On equal scores the shorter key leads. The matcher's score ignores a key's unmatched tail, so every target a prefix query hits ties on score; the shorter key is the tighter fit for what was typed, and an exact key (`git`) leads its longer neighbours (`gitlab`, `githubprojects`) ([ADR 0013](adr/0013-break-score-ties-by-key-then-destination-length.md)).
3. **Representative-destination length ascending.** On equal score and key length the shorter representative destination leads. A target's **representative destination** is the rendered destination of the row a client would navigate to — its best fit (`argDelta 0`), or its sole row when the target is single-variant — or, when no row is navigable, the shortest of its rendered destinations.
4. **Target-set order.** Targets equal on all of the above fall to the order they occupy in the state.

These are display tiebreaks only: reordering never turns an ambiguous result (more than one selected target) into a navigable one.

Within a target, compare two variants by `argDelta`:

5. **Zero first.** The best fit, when there is one, leads the target's rows.
6. **Positive ascending.** Complete destinations with arguments to spare: `+1` before `+2`.
7. **Negative by `|argDelta|` ascending.** Destinations still showing a `{}`: `-1` before `-2`.

So for a target keyed `jira` with arities `{0, 2}` and one argument, the rows are its arity-0 variant (`+1`) then its arity-2 variant (`-1`).

A direct-navigation candidate is a **single selected target** — every match in `R` shares its key — that has a **best fit**: navigate to its argDelta-0 row. A single-variant target whose one row has a nonnegative argument balance also navigates, dropping any surplus arguments. A target's sibling variants no longer suppress navigation, but matches from a **second** selected target do; a client checks the set of keys, not the raw match count ([ADR 0011](adr/0011-fan-out-variants-client-picks-navigable.md)). Ordering never turns an ambiguous result into a navigable one. A result of destination search (`hint.on` is `"destination"`) is never a direct-navigation candidate, however many targets it selects ([ADR 0014](adr/0014-destination-search-when-no-key-matches.md)).

## 6. Errors and state preservation

An operation with no matching stack rule or a failed operand validation emits an evaluation error. An explicit `E` value is not such a failure: push it and stop, taking nothing off the stack, so `[S, L]` followed by an explicit `E` becomes `[S, L, E]`.

Every error carries a machine-readable `type` from this closed vocabulary, plus a human-readable `description`. The vocabulary is discriminated by **phase**: failures raised while parsing one item are `parse_error` or `missing_operation`, and the remaining types name failures raised while evaluating an operation.

| `type` | Phase | Raised when |
| --- | --- | --- |
| `parse_error` | Parse | An item is not a usable value: malformed JSON, a value that is never permitted at top level such as `t`, `T`, `m`, `M`, or a literal array, a string token that is empty, whitespace-bearing, or operator-only, or a recognized `S`, `R`, or `E` envelope failing validation, such as an unknown field on an `S`, an invalid alias definition, duplicate normalized keys, an empty key, a key carrying operator syntax, two variants of one target sharing an arity, an invalid variant, or an `E` whose `type` is outside this vocabulary. |
| `missing_operation` | Parse | A dot-prefixed token is not the separator and is not bound to an operation in the interpreter's environment. |
| `invalid_destination` | Evaluation | An operand URL or destination template fails render-then-parse validation. |
| `invalid_dimension` | Evaluation | A dimension used as a key by `.set` or `.rm` carries search-operator syntax, or a `.set` or `.rm` literal array holds an alias (section 2). |
| `missing_operand` | Evaluation | An operation lacks a required operand: no literal array, no explicit dimension, no state to operate on, a bare `.rm` naming a multi-variant target without an arity separator, an `.alias` given a separator, a single literal, or a pair with a half starting with `~`, or a `.merge` without two states on top of the stack. |
| `unknown_error` | Evaluation | A catch-all for an evaluation failure that does not match a more specific type. |

The phase rule decides overlapping cases: the same malformed destination reports `parse_error` inside a supplied `S` and `invalid_destination` as a `.set` operand. One is an unusable item, the other an unusable operand. `.set` treats the first literal of `L` as its destination unconditionally, so `S company git .set` is `invalid_destination` (`company` is an unusable destination), not `missing_operand`.

`missing_operand` covers every required-operand failure of one operation, whichever operand is absent:

```text
S .set                                          # no literal array
S https://github.com/company/{} .set            # no explicit dimension
S https://github.com/company/{} . ignored .set  # no explicit dimension; the suffix is ignored
https://example.com/{} git .set                 # no state anywhere on the stack
```

Hosts display `type` and `description` without interpreting the type value. Adding a new `type` is a specification change, not an implementation detail. A supplied `E` must carry a `type` drawn from this vocabulary and a string `description`; unlike a generated error it may also carry extra diagnostic fields, which are preserved. An `E` whose `type` falls outside the vocabulary fails validation and parses to `parse_error`, so an error produced by another version does not round-trip unchanged.

### Taking operands

An operation takes its operands off the top of the stack, matching each value, top down, against the operand it expects in that exact position. A value that fits is consumed. Taking stops at the first value that does not fit, which stays where it is, as does everything beneath it; nothing beneath the taken values is inspected or rewritten.

On a generated evaluation error, whether its operands did not all fit or the ones it took failed validation, the operation decides which of the values it took to put back beneath the `E`, then pushes `E` and stops. Usually it puts back nothing, and the consumed values are dropped. An operation that took a state may put it back, and every operation of this specification puts back, unchanged, any state it took, so none of them loses a state by failing. An operation may say it puts back more, as `.alias` keeps its `L` when given a separator (section 4.5).

```text
[S0, L0, S1, L1] | .set (invalid destination) -> [S0, L0, S1, E]   L1 dropped, S1 put back
[L]              | .set                       -> [E]               L taken, no S beneath it
[S, L]           | .merge                     -> [S, L, E]         L does not fit and stays
[S1, L, S2]      | .merge                     -> [S1, L, S2, E]    S2 taken, then put back
```

A state is put back exactly as it was taken: a `.set` whose destination fails validation must not partially modify `S` before emitting its error.

Earlier successful operations are **not rolled back**. The state put back is the working state at the point of failure, not the initial state. Suppose the original focus is `[personal]`:

```text
S company .@ .@ example.com/{} git .set
```

The first `.@` sets focus, the second clears it, and `.set` then fails with `invalid_destination` because `example.com/{}` has no scheme. The error stack retains the state with cleared focus.

A parse failure behaves like any other `E` in the stream: items before it have already executed, and pushing it stops evaluation, taking nothing off the stack. A program whose first item is unparsable evaluates to `[E]`.

## 7. Worked programs

These examples use `S`, `S0`, and `S1` as explanatory names for actual state JSON values; they are not source-level variable bindings.

The worked programs end in an explicit `.$`. The interpreter appends nothing; a host such as the browser client or the REPL appends `.$` (and its own host operations) to the user's tokens before executing.

### Create and search

```text
["S", {"targets": {}, "focus": []}]
https://github.com/company/{} company git .set .$
```

`.set` appends a target keyed `company git` with one arity-1 variant, and the search selects all targets because focus and explicit input are empty. The final shape is `[S', R]`, whose single match keeps its `{}` intact with `argDelta: -1`.

### Navigate with inferred arguments

```text
["S", {
  "targets": {"company git": ["https://github.com/company/{}"]},
  "focus": []
}]
company git MyRepo .$
```

`.$` matches `company git` and treats `MyRepo` as the argument, keeping its case. (Under smart-case, `Company Git` would match no key: an uppercase term is case-sensitive and keys are lowercase. Destination search would then try the same case-sensitive query against the lowercase template, and find nothing either.)

```json
["R", {
  "matches": [
    ["https://github.com/company/MyRepo", "https://github.com/company/{}", "company git",
      ["MyRepo"], {"argDelta": 0}]
  ],
  "inputs": ["company", "git"],
  "args": ["MyRepo"]
}]
```

### Preserve ambiguity across targets

```text
["S", {
  "targets": {
    "company git": ["https://github.com/company/{}"],
    "git personal": ["https://github.com/personal/{}/tree/{}"]
  },
  "focus": []
}]
git . thither .$
```

Both targets are selected, so the result is ambiguous even though only one URL is complete. Each target yields one row: the arity-1 variant is `company git`'s best fit, and the arity-2 variant is `git personal`'s only variant. The two keys tie on score, so the shorter key (`company git`, eleven characters) leads the longer (`git personal`, twelve); argument balance does not reorder rows across targets:

```text
https://github.com/company/thither          argDelta:  0
https://github.com/personal/thither/tree/{} argDelta: -1
```

### Variants of one target

```text
["S", {"targets": {}, "focus": []}]
https://jira.example.com jira .set
https://jira.example.com/browse/{} jira .set
jira .$
```

The first `.set` creates `jira` with an arity-0 variant; the second adds an arity-1 variant to the same target. `jira` has no arguments, so the arity-0 variant is the best fit; the target yields one row per variant, the best fit (`argDelta 0`) leading, and is a direct-navigation candidate to that row:

```json
["R", {
  "matches": [
    ["https://jira.example.com", "https://jira.example.com", "jira", [], {"argDelta": 0}],
    ["https://jira.example.com/browse/{}", "https://jira.example.com/browse/{}", "jira",
      [], {"argDelta": -1}]
  ],
  "inputs": ["jira"],
  "args": []
}]
```

Against the same resulting state, `jira PROJ .$` makes the arity-1 variant the best fit, again leading its arity-0 sibling; it navigates to the best-fit row:

```json
["R", {
  "matches": [
    ["https://jira.example.com/browse/PROJ", "https://jira.example.com/browse/{}", "jira",
      ["PROJ"], {"argDelta": 0}],
    ["https://jira.example.com", "https://jira.example.com", "jira", [], {"argDelta": 1}]
  ],
  "inputs": ["jira"],
  "args": ["PROJ"]
}]
```

`jira PROJ extra .$` yields two rows with no best fit, because neither variant has arity 2, so it cannot navigate:

```json
["R", {
  "matches": [
    ["https://jira.example.com/browse/PROJ", "https://jira.example.com/browse/{}", "jira",
      ["PROJ"], {"argDelta": 1}],
    ["https://jira.example.com", "https://jira.example.com", "jira", [], {"argDelta": 2}]
  ],
  "inputs": ["jira"],
  "args": ["PROJ", "extra"]
}]
```

`jira . x .rm` then removes the arity-1 variant, leaving `jira` with the arity-0 variant alone, so `jira PROJ .$` afterwards yields one row with `argDelta: 1` and navigates.

### Select every target with an empty query

```text
["S", {
  "targets": {
    "company git": ["https://github.com/company/{}"],
    "docs": ["https://docs.example.com/"]
  },
  "focus": []
}]
.$
```

`.$` selects everything, and each match carries empty evidence:

```json
["R", {
  "matches": [
    ["https://docs.example.com/", "https://docs.example.com/", "docs", [],
      {"argDelta": 0, "on": "key", "positions": [], "score": 0}],
    ["https://github.com/company/{}", "https://github.com/company/{}", "company git", [],
      {"argDelta": -1, "on": "key", "positions": [], "score": 0}]
  ],
  "inputs": [],
  "args": []
}]
```

Both scores are `0`, so the shorter key decides: `docs` (four characters) leads `company git` (eleven), even though `company git` comes first in the state. Two matches remain, so this is not a direct-navigation candidate.

### Search destinations when no key matches

```text
["S", {
  "targets": {
    "jira": ["https://jira.example.com", "https://jira.example.com/browse/{}"],
    "company git": ["https://github.com/company/{}"]
  },
  "focus": []
}]
browse . PROJ .$
```

No key contains `browse`, so destination search matches the query against each variant's template. Only `jira`'s arity-1 template matches; the separator's suffix is still applied, and the match carries destination evidence, its positions indexing the template:

```json
["R", {
  "matches": [
    ["https://jira.example.com/browse/PROJ", "https://jira.example.com/browse/{}", "jira",
      ["PROJ"], {"argDelta": 0, "on": "destination", "positions": [25, 26, 27, 28, 29, 30]}]
  ],
  "inputs": ["browse"],
  "args": ["PROJ"]
}]
```

`jira`'s arity-0 variant did not match and is not listed. The one row is a best fit, but it is destination evidence, so it is not a direct-navigation candidate: the client shows it on the fallback page.

### Stop at the first result

```text
S0 git .$ S1 docs .$
```

Execute the first search and stop with `[S0, R]`. `S1` is never pushed and the second search never runs.

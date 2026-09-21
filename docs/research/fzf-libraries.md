# Libraries for fzf-style string matching

> **Outcome:** Axon adopted the npm `fzf` port as an ordinary dependency, with per-dimension AND matching, summed scores, target-set order for ties, and diacritic normalization disabled. See [dsl.md](../dsl.md) and [browser-client.md](../browser-client.md). This note is the research snapshot that led there; its open questions are now closed.

## Recommendation

**Go is the strongest choice for fidelity to fzf: use fzf's own matcher. TypeScript/JavaScript is the practical choice for a browser-based Axon: use the `fzf` npm package, accepting a pinned port rather than claiming compatibility with current upstream fzf.** Rust's `nucleo-matcher` is worth considering for a native application, but explicitly differs from fzf. These are architectural recommendations based on the primary-source findings below, not benchmark results.

No stack decision is made by this note. Axon's browser and deployment requirements remain open.

## Comparison

| Language | Candidate | Assessment |
| --- | --- | --- |
| Go | `github.com/junegunn/fzf/src/algo` | The actual upstream algorithm, with exported `FuzzyMatchV2` and `Result` containing start, end, and score. Best starting point for exact matcher fidelity. Initialization, input conversion, query composition, and result sorting still need a wrapper. [1] |
| TypeScript / JavaScript | npm `fzf` (`ajitid/fzf-for-js`) | A port intended for browser use, with typed `Fzf`/`AsyncFzf` interfaces, scores, match positions, selectors, and configurable tie-breakers. Most convenient candidate for a web implementation. [3–5] |
| Rust | `nucleo-matcher` | A reusable matcher; its authors describe fzf's scoring system but explicitly document different optimal matches and Unicode handling. Good candidate for fzf-like behavior, not strict replication. [7] |
| Rust | `fuzzy-matcher` / `SkimMatcherV2` | Provides scores and indices and uses a Smith–Waterman-based algorithm, but that algorithm family alone does not establish fzf equivalence. Not recommended over upstream fzf when fidelity is the objective. [8] |

### Go: same matcher does not mean the entire CLI behavior

Upstream's V2 matcher uses modified Smith–Waterman scoring. The source exposes scheme initialization (`default`, `path`, `history`) and flags for case sensitivity, normalization, direction, and positions. Scheme choice changes boundary bonuses. Pin the upstream version and initialization rather than treating “fzf” as a timeless algorithm specification. [1]

The higher-level query machinery is separate: upstream `pattern.go` parses extended terms and sums their match scores. Calling `FuzzyMatchV2` alone does not reproduce query parsing or list ranking. For Axon, bypassing the extended query language is desirable because the DSL prohibits its operators. [2, 9]

Recommendation: place the upstream package behind a small adapter, pin its revision, and own Axon's multi-token and tie-breaking policies. This is a source-level dependency on the fzf project; this investigation did not establish an independently guaranteed stable matcher API.

### JavaScript: a real port, but not current-upstream parity

The inspected port explicitly identifies upstream commit `9cb7a364a31bdb882d873807774bdcf6fad0c9e4` as its algorithm update point. It uses a single non-word boundary class and `BONUS_BOUNDARY = 8`. Inspected current upstream distinguishes whitespace and delimiter boundaries, with default bonuses of 10 and 9 respectively. Therefore identical current-upstream scores cannot be assumed merely because the npm package is named `fzf`. [1, 4]

The published npm metadata returned version **0.5.2**, with publication `gitHead` `357c8aedaeff3f1af190049fab1c8d03609e7aee`. Source inspection used repository HEAD `cf3903255b6bba6143bfbed5a387f3cadfd6938a`; the published artifact was not executed or checked exhaustively against that source snapshot. [6]

Useful options include `fuzzy: "v2"`, `casing: "case-insensitive"`, normalization, selectors, and tie-breakers. The documented defaults include smart case, normalization enabled, basic matching, and an unlimited result count. Explicit configuration is preferable for Axon. [5]

**Important integration trap:** `basicMatch` sends one query pattern to the algorithm. `extendedMatch` parses multiple terms but also imports fzf's special operators. Neither should silently decide Axon's unresolved multi-token policy. If Axon chooses independent AND-matched dimensions with summed scores, implement that composition using literal fuzzy patterns rather than passing raw user input to the extended parser. [5, 9]

### Rust: quality and compatibility are different goals

Nucleo's authors give `foo` against `xf foo` as an example where their chosen match differs from fzf, and describe grapheme-based handling that differs from fzf's code-point handling. They also report performance advantages, but label their comparisons unscientific; no independent performance claim is made here. [7]

## Implications for Axon

The existing DSL requires case-insensitive fuzzy matching over each target's sorted, space-joined dimensions; it forbids fzf query operators and leaves the concrete algorithm, multi-token aggregation, and deterministic ties open. It also requires preserving ambiguity rather than navigating to the top-ranked result. [9]

Before adopting any candidate, settle and test:

1. **Compatibility target:** a pinned upstream fzf version, a pinned JS port, or intentionally fzf-like behavior.
2. **Multiple dimensions:** should `git company` select `company git`? Independent term matching can allow this; one ordered fuzzy pattern cannot. Decide rather than inheriting a library default.
3. **Unicode and normalization:** Axon's dimension lowercasing is not automatically the same as a matcher's optional diacritic normalization.
4. **Ties:** define a deterministic policy rather than assuming equal scores imply identical ordering across libraries.
5. **Cardinality:** retain every selected target for ambiguity checking; truncation to a top result must not permit direct navigation.

Suggested compatibility corpus: punctuation and word boundaries, reversed dimension order, tokens spanning dimension boundaries, diacritics, non-ASCII case, equal scores, empty input, and literal `!`, `^`, `$`, and `|`. Differential tests against the selected reference should precede any exact-compatibility claim. These are proposed next steps, not completed tests.

## Primary sources

1. [fzf algorithm source, pinned upstream snapshot](https://github.com/junegunn/fzf/blob/b1be3a8be1b833ce5b92fbbac11637643d60a046/src/algo/algo.go).
2. [fzf query composition source, same snapshot](https://github.com/junegunn/fzf/blob/b1be3a8be1b833ce5b92fbbac11637643d60a046/src/pattern.go).
3. [FZF for JavaScript README](https://github.com/ajitid/fzf-for-js/blob/cf3903255b6bba6143bfbed5a387f3cadfd6938a/README.md) and [public entry point](https://github.com/ajitid/fzf-for-js/blob/cf3903255b6bba6143bfbed5a387f3cadfd6938a/src/lib/main.ts).
4. [JavaScript port algorithm and upstream provenance](https://github.com/ajitid/fzf-for-js/blob/cf3903255b6bba6143bfbed5a387f3cadfd6938a/src/lib/algo.ts).
5. [JS options and result types](https://github.com/ajitid/fzf-for-js/blob/cf3903255b6bba6143bfbed5a387f3cadfd6938a/src/lib/types.ts), [matchers](https://github.com/ajitid/fzf-for-js/blob/cf3903255b6bba6143bfbed5a387f3cadfd6938a/src/lib/matchers.ts), and [pattern construction](https://github.com/ajitid/fzf-for-js/blob/cf3903255b6bba6143bfbed5a387f3cadfd6938a/src/lib/pattern.ts).
6. [npm registry metadata](https://registry.npmjs.org/fzf/latest) (mutable endpoint; returned version recorded above).
7. [Nucleo's own README](https://github.com/helix-editor/nucleo/blob/8c16d47cdfa9607d3e44df5f81c635c6f43c65ee/README.md), including documented differences and benchmark limitations.
8. [`fuzzy-matcher` author's documentation](https://github.com/skim-rs/fuzzy-matcher/blob/master/README.md) (moving branch).
9. [Axon's DSL specification](../dsl.md), especially sections 5, 7, and 10.

Method: primary documentation and source inspection; no library installation in Axon, runtime benchmarks, or differential compatibility tests. No background-agent facility was available, so research was performed directly.

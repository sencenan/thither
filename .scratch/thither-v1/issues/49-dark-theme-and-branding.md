# Dark terminal/NVIDIA theme, colour-coded results, and a wordmark

Type: task
Status: claimed
Blocked by:

## Question

Two look-and-feel asks from the S5 drive, explored live:

1. A slicker, minimal **dark colour style** (NVIDIA-branding / modern-terminal feel) instead
   of the system light/dark scheme.
2. Thither had **no logo or banner**; add a lightweight brand mark above the field.

## Answer

1. **Tokenized dark theme.** Every `Canvas`/`CanvasText`/`LinkText`/warn colour in `style.css`
   became a `color-mix` over four `:root` tokens, so retheming is a one-block change:
   `--bg: #171a17` (green-tinted charcoal, lifted off pure black on review), `--fg: #e8ede6`,
   `--accent: #76b900` (NVIDIA green), `--warn: #ff6b53`; `color-scheme: dark` forces dark form
   controls. Slick touches: a faint green radial glow on the page; a green focus ring on the
   field (`:focus-within`); match rows highlight with a green tint + left accent bar on hover.
   **Background gap fixed** \u2014 `body` gained `min-height: 100vh`, `box-sizing: border-box`, and
   `background-attachment: fixed` so both layers fill the viewport (padding included).
2. **Colour-coded results.** Matched key characters stay green (`--accent`); **arguments got
   their own colour** (`--arg: #5ccfe6`, cyan) on the arg chips *and* the destination's argument
   highlights, so "why it matched" (green) reads distinct from "what you're passing" (cyan). The
   **match count** got its own colour (`--count`, green + bold) instead of muted grey (a `count`
   class on the summary span).
3. **Enter-target highlight.** When a query was searched (Enter opens row 1, ADR 0009),
   `renderMatchList` marks the list `enter-armed` (`output.ts` passes `R.inputs.length > 0`), and
   the first row shows the active highlight by default \u2014 standing down (`:not(:hover)`) as soon as
   the pointer is over the list, so only the hovered row is lit.
4. **Wordmark.** A text-only brand in the top gap (`fallback-page.ts`): `\u276f thither \u2014 to that
   place`, the prompt chevron in accent green with a glow, the name in the foreground monospace,
   the tagline in muted italic. No asset, so it stays in the single-file bundle.

Tests: `enter-armed` marking and the wordmark are pinned. `pnpm verify` green.

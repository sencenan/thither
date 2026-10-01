// browser-client.md "Fallback UI and settings" — the spans a result row is rendered from. Both
// are pure and DOM-free: `keySpans` turns `hint.positions` (string indices into the key, dsl.md
// §5 "Matching evidence") into runs, and `templateSpans` walks the variant's template left to
// right filling `{}` with the applied arguments (dsl.md §5), so the row marks what the core
// actually did rather than searching the rendered destination for argument text. For a
// destination-search match, `templateSpans` also marks the template characters its positions
// name; those index the raw template, so a slot's two characters are skipped, never marked.

export type KeySpan = readonly ['text' | 'matched', string];
export type TemplateSpan = readonly ['text' | 'matched' | 'argument' | 'placeholder', string];

const PLACEHOLDER = '{}';

// `text` occupies indices `from` onwards of the string `matched` indexes into.
const runs = (text: string, matched: ReadonlySet<number>, from = 0): KeySpan[] => {
  const spans: KeySpan[] = [];
  let run = '';
  let runMatched = false;

  const close = (): void => {
    if (run.length > 0) {
      spans.push([runMatched ? 'matched' : 'text', run]);
    }
  };

  for (let i = 0; i < text.length; i++) {
    const hit = matched.has(from + i);
    if (hit !== runMatched) {
      close();
      run = '';
      runMatched = hit;
    }
    run += text[i];
  }
  close();
  return spans;
};

export const keySpans = (key: string, positions: readonly number[]): readonly KeySpan[] =>
  runs(key, new Set(positions));

export const templateSpans = (
  template: string,
  args: readonly string[],
  positions: readonly number[] = [],
): readonly TemplateSpan[] => {
  const matched = new Set(positions);
  const pieces = template.split(PLACEHOLDER);
  const spans: TemplateSpan[] = [];
  let offset = 0;

  const text = (piece: string): void => {
    spans.push(...runs(piece, matched, offset));
    offset += piece.length;
  };

  text(pieces[0] ?? '');
  for (let slot = 1; slot < pieces.length; slot++) {
    const arg = args[slot - 1];
    spans.push(arg === undefined ? ['placeholder', PLACEHOLDER] : ['argument', arg]);
    offset += PLACEHOLDER.length;
    text(pieces[slot] ?? '');
  }
  return spans;
};

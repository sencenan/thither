// browser-client.md "Fallback UI and settings" — the spans a result row is rendered from. Both
// are pure and DOM-free: `keySpans` turns `hint.positions` (string indices into the key, dsl.md
// §5 "Matching evidence") into runs, and `templateSpans` walks the variant's template left to
// right filling `{}` with the applied arguments (dsl.md §5), so the row marks what the core
// actually did rather than searching the rendered destination for argument text.

export type KeySpan = readonly ['text' | 'matched', string];
export type TemplateSpan = readonly ['text' | 'argument' | 'placeholder', string];

const PLACEHOLDER = '{}';

export const keySpans = (key: string, positions: readonly number[]): readonly KeySpan[] => {
  const matched = new Set(positions);
  const spans: KeySpan[] = [];
  let run = '';
  let runMatched = false;

  const close = (): void => {
    if (run.length > 0) {
      spans.push([runMatched ? 'matched' : 'text', run]);
    }
  };

  for (let i = 0; i < key.length; i++) {
    const hit = matched.has(i);
    if (hit !== runMatched) {
      close();
      run = '';
      runMatched = hit;
    }
    run += key[i];
  }
  close();
  return spans;
};

export const templateSpans = (
  template: string,
  args: readonly string[],
): readonly TemplateSpan[] => {
  const pieces = template.split(PLACEHOLDER);
  const spans: TemplateSpan[] = [];

  const text = (piece: string | undefined): void => {
    if (piece !== undefined && piece.length > 0) {
      spans.push(['text', piece]);
    }
  };

  text(pieces[0]);
  for (let slot = 1; slot < pieces.length; slot++) {
    const arg = args[slot - 1];
    spans.push(arg === undefined ? ['placeholder', PLACEHOLDER] : ['argument', arg]);
    text(pieces[slot]);
  }
  return spans;
};

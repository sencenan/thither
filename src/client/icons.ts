// Inline SVG line-icons for the field's controls, so the help and settings buttons render at the
// same optical size (a text "?" beside the gear glyph never matched). Each icon carries its own
// viewBox and stroke width; the wrapper supplies no-fill, `currentColor` stroke, and rounded joins,
// so CSS colour and the 18px box size drive them. Inlined into the single-file bundle; no request.

export type IconName = 'help' | 'settings';

interface Icon {
  readonly viewBox: string;
  // Chosen so the on-screen stroke matches across icons despite different viewBox scales: the help
  // icon is 2 units in a 24 grid (≈0.083 of the box); the gear matches at ≈0.083 × 64 ≈ 5.3.
  readonly strokeWidth: number;
  readonly body: string;
}

const ICONS: Record<IconName, Icon> = {
  help: {
    viewBox: '0 0 24 24',
    strokeWidth: 2,
    body:
      '<circle cx="12" cy="12" r="10"></circle>' +
      '<path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>' +
      '<line x1="12" y1="17" x2="12.01" y2="17"></line>',
  },
  settings: {
    // The gear teeth span 1..63 of a 64 grid (≈97% of the box); the help circle fills only ≈83%
    // of its 24 grid, so the gear read bigger. Pad the viewBox to -5..69 (74 units) so the same
    // art now fills ≈83%, matching the help icon's visual size; stroke bumped to keep the weight.
    viewBox: '-5 -5 74 74',
    strokeWidth: 6.2,
    body:
      '<polygon points="32,1 26,1 26,10 20,12 14,6 6,14 12,20 10,26 1,26 1,38 10,38 12,44 6,50 14,58 20,52 26,54 26,63 32,63 38,63 38,54 44,52 50,58 58,50 52,44 54,38 63,38 63,26 54,26 52,20 58,14 50,6 44,12 38,10 38,1"></polygon>' +
      '<circle cx="32" cy="32" r="6"></circle>',
  },
};

export const iconMarkup = (name: IconName): string => {
  const { viewBox, strokeWidth, body } = ICONS[name];
  return (
    `<svg viewBox="${viewBox}" fill="none" stroke="currentColor" stroke-width="${strokeWidth}" ` +
    `stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`
  );
};

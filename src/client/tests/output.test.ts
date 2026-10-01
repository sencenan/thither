// @vitest-environment happy-dom

// browser-client.md "Fallback UI" — composing the output region from the register: an error as
// its type/description, then either the setup instructions (while the target set is empty) or
// the match list, then the reset hint when the store could not be loaded; and the bare error
// page that replaces everything when no execution happened.

import { beforeEach, describe, expect, it } from 'vitest';
import type { State } from '../../dsl/index.ts';
import type { OutputRegister } from '../browser-env.ts';
import { renderBareError, renderOutput as renderOutputOver } from '../output.ts';

const noBase: State = ['S', { targets: {}, focus: [], alias: {} }];
const renderOutput = (region: Element, register: OutputRegister): void =>
  renderOutputOver(region, register, noBase);

let root: HTMLElement;

beforeEach(() => {
  document.body.innerHTML = '<div id="app"></div>';
  const app = document.querySelector('#app');
  if (!(app instanceof HTMLElement)) {
    throw new Error('missing #app');
  }
  root = app;
});

const emptySet: OutputRegister['state'] = ['S', { targets: {}, focus: [], alias: {} }];
const oneTarget: OutputRegister['state'] = [
  'S',
  { targets: { home: ['https://example.com/'] }, focus: [], alias: {} },
];
const everyTarget: OutputRegister['terminal'] = ['R', { matches: [], inputs: [], args: [] }];

describe('renderOutput', () => {
  it('renders R.matches as the match list, in the order given', () => {
    renderOutput(root, {
      loaded: true,
      terminal: [
        'R',
        {
          matches: [
            [
              'https://b.example/',
              'https://b.example/',
              'beta',
              [],
              { argDelta: 0, on: 'key', positions: [], score: 1 },
            ],
            [
              'https://a.example/',
              'https://a.example/',
              'alpha',
              [],
              { argDelta: 0, on: 'key', positions: [], score: 2 },
            ],
          ],
          inputs: [],
          args: [],
        },
      ],
      state: oneTarget,
    });

    const links = [...root.querySelectorAll('a')];
    expect(links.map((a) => a.getAttribute('href'))).toEqual([
      'https://b.example/',
      'https://a.example/',
    ]);
    expect(links[0]?.textContent).toContain('beta');
  });

  describe('the focus bar ("the current focus, the dimensions added to every search")', () => {
    const focused: OutputRegister['state'] = [
      'S',
      { targets: { home: ['https://example.com/'] }, focus: ['company', '!archived'], alias: {} },
    ];

    it('shows the current focus above the results when focus is non-empty', () => {
      renderOutput(root, { loaded: true, terminal: everyTarget, state: focused });

      const bar = root.querySelector('.focus');
      expect(bar?.textContent).toContain('company !archived');
      const text = root.textContent ?? '';
      expect(text.indexOf('company')).toBeLessThan(text.indexOf('No matches'));
    });

    it('shows nothing when focus is empty', () => {
      renderOutput(root, { loaded: true, terminal: everyTarget, state: oneTarget });

      expect(root.querySelector('.focus')).toBeNull();
    });
  });

  it('shows the no-matches line for an empty match set on a non-empty target set', () => {
    renderOutput(root, { loaded: true, terminal: everyTarget, state: oneTarget });

    expect(root.querySelector('a')).toBeNull();
    expect(root.textContent).toContain('No matches');
    expect(root.textContent).not.toContain('?q=%s');
  });

  it('renders an E as its type and description verbatim', () => {
    renderOutput(root, {
      loaded: true,
      terminal: ['E', { type: 'invalid_destination', description: 'not a URL' }],
    });

    expect(root.textContent).toContain('invalid_destination');
    expect(root.textContent).toContain('not a URL');
  });

  it('adds the reset hint when loaded is false', () => {
    renderOutput(root, {
      loaded: false,
      terminal: ['E', { type: 'parse_error', description: 'bad record' }],
    });

    expect(root.textContent).toContain('Recover in Settings');
  });

  describe('setup instructions ("above the result list")', () => {
    // The page's URL is moved with `history.replaceState`, as `main.ts` moves it; happy-dom holds
    // it to the test origin, so the path stands in for the deployed `/thither/`.
    const PAGE = `${location.origin}/thither/`;

    beforeEach(() => {
      history.replaceState(null, '', PAGE);
    });

    it('an empty target set shows the instructions for this page, with no list beneath', () => {
      renderOutput(root, { loaded: true, terminal: everyTarget, state: emptySet });

      expect(root.textContent).toContain(`${PAGE}?q=%s`);
      expect(root.textContent).not.toContain(`${PAGE}#q=%s`);
      expect(root.textContent).not.toContain('No matches');
    });

    it('a target set holding only the client base state shows the instructions, then the list', () => {
      const base: State = ['S', { targets: { thither: [PAGE] }, focus: [], alias: {} }];
      const terminal: OutputRegister['terminal'] = [
        'R',
        {
          matches: [
            [PAGE, PAGE, 'thither', [], { argDelta: 0, on: 'key', positions: [], score: 0 }],
          ],
          inputs: [],
          args: [],
        },
      ];
      renderOutputOver(root, { loaded: true, terminal, state: base }, base);

      expect(root.textContent).toContain('No custom targets yet');
      // The summary bar stays directly beneath the field; the instructions sit between it and the rows.
      expect(
        [...root.children].map((child) => child.tagName.toLowerCase() + '.' + child.className),
      ).toEqual(['footer.', 'section.setup', 'ol.matches']);
      expect(root.querySelector('ol.matches a')?.getAttribute('href')).toBe(PAGE);
    });

    it('a search matching nothing in the base state lists no matches beneath the instructions', () => {
      const base: State = ['S', { targets: { thither: [PAGE] }, focus: [], alias: {} }];
      renderOutputOver(root, { loaded: true, terminal: everyTarget, state: base }, base);

      const text = root.textContent ?? '';
      expect(text.indexOf('?q=%s')).toBeLessThan(text.indexOf('No matches'));
    });

    it('"They are not shown when loaded is false": a corrupted record shows the E and the hint only', () => {
      renderOutput(root, {
        loaded: false,
        terminal: ['E', { type: 'parse_error', description: 'bad record' }],
      });

      expect(root.textContent).toContain('parse_error');
      expect(root.textContent).toContain('Recover in Settings');
      expect(root.textContent).not.toContain('?q=%s');
    });

    it('an E on an empty target set is shown beneath the field, the instructions still below it', () => {
      renderOutput(root, {
        loaded: true,
        terminal: ['E', { type: 'invalid_destination', description: 'not a URL' }],
        state: emptySet,
      });

      const text = root.textContent ?? '';
      expect(text).toContain('invalid_destination');
      expect(text.indexOf('invalid_destination')).toBeLessThan(text.indexOf('?q=%s'));
    });
  });

  it('replaces prior content on each render', () => {
    renderOutput(root, { loaded: true, terminal: everyTarget, state: oneTarget });
    renderOutput(root, {
      loaded: true,
      terminal: ['E', { type: 'parse_error', description: 'x' }],
    });

    expect(root.textContent).not.toContain('No matches');
    expect(root.textContent).toContain('parse_error');
  });
});

describe('renderBareError ("rendered as a bare error page")', () => {
  it('replaces the whole root with the failure message', () => {
    renderOutput(root, { loaded: true, terminal: everyTarget, state: oneTarget });
    renderBareError(root, new Error('localStorage is unavailable'));

    expect(root.textContent).toBe('localStorage is unavailable');
    expect(root.querySelector('a')).toBeNull();
  });

  it('shows a non-Error throw as text', () => {
    renderBareError(root, 'gone');

    expect(root.textContent).toBe('gone');
  });
});

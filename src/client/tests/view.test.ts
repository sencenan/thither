// @vitest-environment happy-dom

// browser-client.md "Fallback UI" — the skeleton render: matches as plain links in emitted order,
// an error as its type/description, the reset hint when the store could not be loaded, and the
// setup instructions in place of the list while the target set is empty.

import { beforeEach, describe, expect, it } from 'vitest';
import type { OutputRegister } from '../browser-env.ts';
import { renderBareError, renderView } from '../view.ts';

let root: HTMLElement;

beforeEach(() => {
  document.body.innerHTML = '<div id="app"></div>';
  const app = document.querySelector('#app');
  if (app === null) {
    throw new Error('missing #app');
  }
  root = app as HTMLElement;
});

describe('renderView', () => {
  it('renders R.matches as links in the order given, without sorting', () => {
    const register: OutputRegister = {
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
              { argDelta: 0, positions: [], score: 1 },
            ],
            [
              'https://a.example/',
              'https://a.example/',
              'alpha',
              [],
              { argDelta: 0, positions: [], score: 2 },
            ],
          ],
          inputs: [],
        },
      ],
    };
    renderView(root, register);

    const links = [...root.querySelectorAll('a')];
    expect(links.map((a) => a.getAttribute('href'))).toEqual([
      'https://b.example/',
      'https://a.example/',
    ]);
    expect(links[0]?.textContent).toContain('beta');
  });

  it('shows a no-matches line for an empty match set', () => {
    const register: OutputRegister = {
      loaded: true,
      terminal: ['R', { matches: [], inputs: [] }],
    };
    renderView(root, register);

    expect(root.querySelector('a')).toBeNull();
    expect(root.textContent).toContain('No matches');
  });

  it('renders an E as its type and description verbatim', () => {
    const register: OutputRegister = {
      loaded: true,
      terminal: ['E', { type: 'invalid_destination', description: 'not a URL' }],
    };
    renderView(root, register);

    expect(root.textContent).toContain('invalid_destination');
    expect(root.textContent).toContain('not a URL');
  });

  it('adds the reset hint when loaded is false', () => {
    const register: OutputRegister = {
      loaded: false,
      terminal: ['E', { type: 'parse_error', description: 'bad record' }],
    };
    renderView(root, register);

    expect(root.textContent).toContain('Settings reset');
  });

  it('renderBareError replaces the whole root with the failure message ("rendered as a bare error page")', () => {
    renderView(root, { loaded: true, terminal: ['R', { matches: [], inputs: [] }] });
    renderBareError(root, new Error('localStorage is unavailable'));

    expect(root.textContent).toBe('localStorage is unavailable');
    expect(root.querySelector('a')).toBeNull();
  });

  it('renderBareError shows a non-Error throw as text', () => {
    renderBareError(root, 'gone');

    expect(root.textContent).toBe('gone');
  });

  describe('setup instructions ("While the target set is empty \u2026 in place of the result list")', () => {
    // The page's URL is moved with `history.replaceState`, as `main.ts` moves it; happy-dom holds
    // it to the test origin, so the path stands in for the deployed `/thither/`.
    const PAGE = `${location.origin}/thither/`;
    const emptySet: OutputRegister['state'] = ['S', { targets: {}, focus: [] }];
    const oneTarget: OutputRegister['state'] = [
      'S',
      { targets: { home: ['https://example.com/'] }, focus: [] },
    ];
    const everyTarget: OutputRegister['terminal'] = ['R', { matches: [], inputs: [] }];

    beforeEach(() => {
      history.replaceState(null, '', PAGE);
    });

    it('an empty target set shows both shortcut templates and the example .set program', () => {
      renderView(root, { loaded: true, terminal: everyTarget, state: emptySet });

      expect(root.textContent).toContain(`${PAGE}?q=%s`);
      expect(root.textContent).toContain(`${PAGE}#q=%s`);
      expect(root.textContent).toContain('https://github.com/company/{} company git .set');
      expect(root.textContent).not.toContain('No matches');
    });

    it("the templates are the page's own URL with its query and fragment dropped", () => {
      history.replaceState(null, '', `${PAGE}?x=1#y=2`);
      renderView(root, { loaded: true, terminal: everyTarget, state: emptySet });

      expect(root.textContent).toContain(`${PAGE}?q=%s`);
      expect(root.textContent).toContain(`${PAGE}#q=%s`);
      expect(root.textContent).not.toContain('x=1');
    });

    it('a non-empty target set with no matches shows the no-matches line, not the instructions', () => {
      renderView(root, { loaded: true, terminal: everyTarget, state: oneTarget });

      expect(root.textContent).toContain('No matches');
      expect(root.textContent).not.toContain('?q=%s');
    });

    it('"They are not shown when loaded is false": a corrupted record shows the E and the hint only', () => {
      renderView(root, {
        loaded: false,
        terminal: ['E', { type: 'parse_error', description: 'bad record' }],
      });

      expect(root.textContent).toContain('parse_error');
      expect(root.textContent).toContain('Settings reset');
      expect(root.textContent).not.toContain('?q=%s');
    });

    it('an E on an empty target set is shown beneath the field, the instructions still below it', () => {
      renderView(root, {
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
    renderView(root, { loaded: true, terminal: ['R', { matches: [], inputs: [] }] });
    renderView(root, {
      loaded: true,
      terminal: ['E', { type: 'parse_error', description: 'x' }],
    });

    expect(root.textContent).not.toContain('No matches');
    expect(root.textContent).toContain('parse_error');
  });
});

// @vitest-environment happy-dom

// browser-client.md "Fallback UI" — the skeleton render: matches as plain links in emitted order,
// an error as its type/description, and the reset hint when the store could not be loaded.

import { beforeEach, describe, expect, it } from 'vitest';
import type { OutputRegister } from '../browser-env.ts';
import { renderView } from '../view.ts';

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
            ['https://b.example/', ['beta'], [], { argDelta: 0, positions: [], score: 1 }],
            ['https://a.example/', ['alpha'], [], { argDelta: 0, positions: [], score: 2 }],
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

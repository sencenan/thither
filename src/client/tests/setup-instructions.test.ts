// @vitest-environment happy-dom

// browser-client.md "Fallback UI and settings" — the setup instructions: when they apply (an
// empty target set on a loaded record) and what they show (the default shortcut template for this
// page, the example `.set` program, and an example fuzzy (fzf) search).

import { beforeEach, describe, expect, it } from 'vitest';
import type { OutputRegister } from '../browser-env.ts';
import { renderSetupInstructions, showsSetupInstructions } from '../setup-instructions.ts';

const emptySet: OutputRegister['state'] = ['S', { targets: {}, focus: [] }];
const oneTarget: OutputRegister['state'] = [
  'S',
  { targets: { home: ['https://example.com/'] }, focus: [] },
];
const everyTarget: OutputRegister['terminal'] = ['R', { matches: [], inputs: [] }];

describe('showsSetupInstructions ("While the target set is empty … They are not shown when loaded is false")', () => {
  it.each<[name: string, register: OutputRegister, shown: boolean]>([
    [
      'an empty target set on a loaded record',
      { loaded: true, terminal: everyTarget, state: emptySet },
      true,
    ],
    [
      'an E on an empty target set',
      {
        loaded: true,
        terminal: ['E', { type: 'invalid_destination', description: 'x' }],
        state: emptySet,
      },
      true,
    ],
    ['a non-empty target set', { loaded: true, terminal: everyTarget, state: oneTarget }, false],
    [
      'a corrupted record (loaded false, no state)',
      { loaded: false, terminal: ['E', { type: 'parse_error', description: 'x' }] },
      false,
    ],
    [
      'a run that left no state',
      { loaded: true, terminal: ['E', { type: 'missing_operation', description: 'x' }] },
      false,
    ],
  ])('%s', (_name, register, shown) => {
    expect(showsSetupInstructions(register)).toBe(shown);
  });
});

describe('renderSetupInstructions', () => {
  let root: HTMLElement;

  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
    const app = document.querySelector('#app');
    if (!(app instanceof HTMLElement)) {
      throw new Error('missing #app');
    }
    root = app;
  });

  it('shows the default shortcut template, the example .set program, and an example fuzzy search', () => {
    root.replaceChildren(renderSetupInstructions(document, 'https://host.example/thither/'));

    expect(root.textContent).toContain('https://host.example/thither/?q=%s');
    expect(root.textContent).toContain('https://github.com/company/{} company git .set');
    expect(root.textContent).toContain('cmpny gt . my-repo');
    expect(root.textContent).toContain('fzf');
  });

  it('shows only the ?q= template, not the #q= one, to save space', () => {
    root.replaceChildren(renderSetupInstructions(document, 'https://host.example/thither/'));

    expect(root.textContent).toContain('https://host.example/thither/?q=%s');
    expect(root.textContent).not.toContain('#q=%s');
  });

  it("the template is the page's own URL with its query and fragment dropped", () => {
    root.replaceChildren(
      renderSetupInstructions(document, 'https://host.example/thither/?x=1#y=2'),
    );

    expect(root.textContent).toContain('https://host.example/thither/?q=%s');
    expect(root.textContent).not.toContain('x=1');
  });

  it('a file: page keeps its full href as the base (its origin would be "null")', () => {
    root.replaceChildren(renderSetupInstructions(document, 'file:///Users/me/index.html'));

    expect(root.textContent).toContain('file:///Users/me/index.html?q=%s');
  });
});

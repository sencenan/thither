// @vitest-environment happy-dom

// browser-client.md "Fallback UI and settings" — the setup instructions: when they apply (an
// empty target set on a loaded record) and what they show (the default shortcut template for this
// page, the example `.set` program, and an example fuzzy (fzf) search).

import { beforeEach, describe, expect, it } from 'vitest';
import type { State } from '../../dsl/index.ts';
import type { OutputRegister } from '../browser-env.ts';
import { renderSetupInstructions, showsSetupInstructions } from '../setup-instructions.ts';

const emptySet: OutputRegister['state'] = ['S', { targets: {}, focus: [], alias: {} }];
const oneTarget: OutputRegister['state'] = [
  'S',
  { targets: { home: ['https://example.com/'] }, focus: [], alias: {} },
];
const everyTarget: OutputRegister['terminal'] = ['R', { matches: [], inputs: [], args: [] }];
const noBase: State = ['S', { targets: {}, focus: [], alias: {} }];

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
    expect(showsSetupInstructions(register, noBase)).toBe(shown);
  });

  // The client base state's targets are not the user's, so they do not end the empty state.
  const base: State = [
    'S',
    { targets: { thither: ['https://host.example/'] }, focus: [], alias: {} },
  ];
  const withBase = (targets: State[1]['targets']): OutputRegister => ({
    loaded: true,
    terminal: everyTarget,
    state: ['S', { targets, focus: [], alias: {} }],
  });

  it.each<[name: string, register: OutputRegister, shown: boolean]>([
    ['only the base target', withBase({ thither: ['https://host.example/'] }), true],
    ['the base target overridden', withBase({ thither: ['https://mine.example/'] }), true],
    ['the base target removed in this run', withBase({}), true],
    [
      "a target of the user's own beside the base one",
      withBase({ thither: ['https://host.example/'], home: ['https://example.com/'] }),
      false,
    ],
  ])('with a base state: %s', (_name, register, shown) => {
    expect(showsSetupInstructions(register, base)).toBe(shown);
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

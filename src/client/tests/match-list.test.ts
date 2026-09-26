// @vitest-environment happy-dom

// browser-client.md "Fallback UI and settings" — the match list: one row per match in emitted
// order, each a link carrying the shortcut digit, the key with its matched characters, the
// destination walked from the template, the argument balance, and the score; a footer with the
// count and key hints; and the readers a shortcut or Enter use to find a row's link.

import { beforeEach, describe, expect, it } from 'vitest';
import type { Hint, Match } from '../../dsl/index.ts';
import { renderMatchList, rowLink, shortcutLink } from '../match-list.ts';

let root: HTMLElement;

beforeEach(() => {
  document.body.innerHTML = '<div id="app"></div>';
  const app = document.querySelector('#app');
  if (!(app instanceof HTMLElement)) {
    throw new Error('missing #app');
  }
  root = app;
});

const exact: Hint = { argDelta: 0, positions: [], score: 0 };
const match = (
  destination: string,
  template: string,
  key: string,
  args: readonly string[] = [],
  hint: Partial<Hint> = {},
): Match => [destination, template, key, args, { ...exact, ...hint }];

const numbered = (count: number): Match[] =>
  Array.from({ length: count }, (_, i) =>
    match(`https://example.com/${i}`, `https://example.com/${i}`, `target ${i}`),
  );

const render = (matches: readonly Match[]): void => {
  root.replaceChildren(...renderMatchList(document, matches));
};

const rows = (): HTMLElement[] => [...root.querySelectorAll<HTMLElement>('li')];
const texts = (selector: string, within: ParentNode = root): string[] =>
  [...within.querySelectorAll(selector)].map((el) => el.textContent ?? '');

describe('renderMatchList ("Each row shows the target’s key, its destination, its argument balance, and hint.score")', () => {
  it('lists the rows in the order given, without sorting', () => {
    render([
      match('https://b.example/', 'https://b.example/', 'beta', [], { score: 1 }),
      match('https://a.example/', 'https://a.example/', 'alpha', [], { score: 2 }),
    ]);

    expect(texts('.key')).toEqual(['beta', 'alpha']);
  });

  it('each row is one link to the match’s destination as rendered, unfilled {} included', () => {
    render([
      match('https://example.com/thither', 'https://example.com/{}', 'company git', ['thither']),
      match('https://example.com/{}', 'https://example.com/{}', 'company git', [], {
        argDelta: -1,
      }),
    ]);

    expect(rows()).toHaveLength(2);
    expect(rows().map((row) => row.querySelectorAll('a').length)).toEqual([1, 1]);
    expect(rows().map((row) => row.querySelector('a')?.getAttribute('href'))).toEqual([
      'https://example.com/thither',
      'https://example.com/{}',
    ]);
  });

  it('"display the digit beside each of those rows, and nothing beside the rest": 1–9, 0, then an empty badge', () => {
    render(numbered(12));

    expect(texts('kbd')).toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '', '']);
  });

  it('the key marks the matched characters from hint.positions: cg → [c]ompany [g]it', () => {
    render([
      match('https://example.com/', 'https://example.com/', 'company git', [], {
        positions: [0, 8],
        score: 40,
      }),
    ]);

    const key = root.querySelector('.key');
    expect(key?.textContent).toBe('company git');
    expect(texts('mark', key ?? root)).toEqual(['c', 'g']);
  });

  it('the destination is the template walked slot by slot: the argument marked, the unfilled {} a placeholder', () => {
    render([
      match(
        'https://example.com/thither/tree/{}',
        'https://example.com/{}/tree/{}',
        'company git',
        ['thither'],
        { argDelta: -1 },
      ),
    ]);

    const destination = root.querySelector('.destination');
    expect(destination?.textContent).toBe('https://example.com/thither/tree/{}');
    expect(texts('mark.argument', destination ?? root)).toEqual(['thither']);
    expect(texts('.placeholder', destination ?? root)).toEqual(['{}']);
  });

  it.each([
    [0, 'exact'],
    [1, '+1 extra'],
    [2, '+2 extra'],
    [-1, 'needs 1 more'],
    [-2, 'needs 2 more'],
  ])('the argument balance %i reads "%s"', (argDelta, label) => {
    render([match('https://example.com/', 'https://example.com/', 'home', [], { argDelta })]);

    expect(texts('.balance')).toEqual([label]);
  });

  it('shows the applied arguments after the key, one chip each', () => {
    render([
      match(
        'https://example.com/thither/tree/main',
        'https://example.com/{}/tree/{}',
        'company git',
        ['thither', 'main'],
      ),
    ]);

    expect(texts('.args .argument')).toEqual(['thither', 'main']);
  });

  it('prefixes the applied arguments with a `.` separator', () => {
    render([match('https://example.com/x', 'https://example.com/{}', 'home', ['x'])]);

    expect(texts('.args .sep')).toEqual(['.']);
    expect(root.querySelector('.args')?.textContent).toBe('.x');
  });

  it('shows no args block, and so no separator, when nothing was applied', () => {
    render([match('https://example.com/', 'https://example.com/', 'home', [])]);

    expect(root.querySelector('.args')).toBeNull();
    expect(root.querySelector('.sep')).toBeNull();
  });

  it('hint.score is shown on the row', () => {
    render([match('https://example.com/', 'https://example.com/', 'home', [], { score: 56 })]);

    expect(texts('.score')).toEqual(['score 56']);
  });

  it('"A row missing arguments reads visibly different": only argDelta < 0 is marked incomplete', () => {
    render([
      match('https://a.example/', 'https://a.example/', 'a', [], { argDelta: 0 }),
      match('https://b.example/x', 'https://b.example/{}', 'b', ['x'], { argDelta: 1 }),
      match('https://c.example/{}', 'https://c.example/{}', 'c', [], { argDelta: -1 }),
    ]);

    expect(rows().map((row) => row.classList.contains('incomplete'))).toEqual([false, false, true]);
  });

  it('shows a no-matches line and no footer for an empty match set', () => {
    render([]);

    expect(root.querySelector('a')).toBeNull();
    expect(root.querySelector('footer')).toBeNull();
    expect(root.textContent).toContain('No matches');
  });

  it('marks the list enter-armed only when Enter would open the first row', () => {
    render(numbered(2));
    expect(root.querySelector('ol')?.classList.contains('enter-armed')).toBe(false);

    root.replaceChildren(...renderMatchList(document, numbered(2), true));
    expect(root.querySelector('ol')?.classList.contains('enter-armed')).toBe(true);
  });

  it('the summary bar sits above the list, not after it', () => {
    render(numbered(2));

    const children = [...root.children];
    expect(children[0]?.tagName.toLowerCase()).toBe('footer');
    expect(children[1]?.tagName.toLowerCase()).toBe('ol');
  });

  it('the footer states the match count and the key hints', () => {
    render(numbered(2));

    const footer = root.querySelector('footer')?.textContent ?? '';
    expect(footer).toContain('2 matches');
    expect(footer).toContain('Ctrl');
    expect(footer).toContain('Enter');
    expect(footer).not.toContain('first ten');
  });

  it('"Every match is listed": past ten rows the footer notes that only the first ten have shortcuts', () => {
    render(numbered(11));

    expect(rows()).toHaveLength(11);
    const footer = root.querySelector('footer')?.textContent ?? '';
    expect(footer).toContain('11 matches');
    expect(footer).toContain('first ten');
  });

  it('a single match reads "1 match"', () => {
    render(numbered(1));

    expect(root.querySelector('footer')?.textContent).toContain('1 match');
    expect(root.querySelector('footer')?.textContent).not.toContain('1 matches');
  });
});

describe('rowLink', () => {
  it('is the nth row’s link, or undefined past the last row', () => {
    render(numbered(2));

    expect(rowLink(root, 0)?.getAttribute('href')).toBe('https://example.com/0');
    expect(rowLink(root, 1)?.getAttribute('href')).toBe('https://example.com/1');
    expect(rowLink(root, 2)).toBeUndefined();
  });
});

describe('shortcutLink ("Ctrl+1 through Ctrl+9, then Ctrl+0 for the tenth")', () => {
  const key = (init: KeyboardEventInit): KeyboardEvent => new KeyboardEvent('keydown', init);

  it.each([
    ['Digit1', 0],
    ['Digit9', 8],
    ['Digit0', 9],
    ['Numpad3', 2],
    ['Numpad0', 9],
  ])('Ctrl + %s names row %i', (code, row) => {
    render(numbered(11));

    expect(shortcutLink(root, key({ code, ctrlKey: true }))?.getAttribute('href')).toBe(
      `https://example.com/${row}`,
    );
  });

  it.each([
    ['a digit without Ctrl', { code: 'Digit1' }],
    ['Ctrl+Alt+digit', { code: 'Digit1', ctrlKey: true, altKey: true }],
    ['Ctrl+Meta+digit', { code: 'Digit1', ctrlKey: true, metaKey: true }],
    ['Ctrl with a letter', { code: 'KeyA', ctrlKey: true }],
  ])('%s names no row', (_name, init) => {
    render(numbered(11));

    expect(shortcutLink(root, key(init))).toBeUndefined();
  });

  it('a digit past the last row names no row', () => {
    render(numbered(2));

    expect(shortcutLink(root, key({ code: 'Digit3', ctrlKey: true }))).toBeUndefined();
  });
});

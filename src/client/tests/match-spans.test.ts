// browser-client.md "Fallback UI and settings" — the spans a row is rendered from: which
// characters of the key matched (`hint.positions`, coalesced into runs), and which `{}` of the
// template each applied argument filled (dsl.md §5's slot walk), without re-running the matcher
// or searching the rendered destination.

import { describe, expect, it } from 'vitest';
import { keySpans, templateSpans } from '../match-spans.ts';

describe('keySpans ("Indicate which characters of the key matched from hint.positions")', () => {
  it.each([
    [
      'a term spanning the boundary between two dimensions: cg → company git',
      'company git',
      [0, 8],
      [
        ['matched', 'c'],
        ['text', 'ompany '],
        ['matched', 'g'],
        ['text', 'it'],
      ],
    ],
    [
      'a run inside a word: git → di[git]al ocean',
      'digital ocean',
      [2, 3, 4],
      [
        ['text', 'di'],
        ['matched', 'git'],
        ['text', 'al ocean'],
      ],
    ],
    [
      'no positions (an empty query): the key as one plain span',
      'digital ocean',
      [],
      [['text', 'digital ocean']],
    ],
    [
      'a run reaching the end of the key',
      'home',
      [2, 3],
      [
        ['text', 'ho'],
        ['matched', 'me'],
      ],
    ],
    [
      'every character matched: one run, no empty text spans',
      'home',
      [0, 1, 2, 3],
      [['matched', 'home']],
    ],
  ])('%s', (_name, key, positions, spans) => {
    expect(keySpans(key, positions)).toEqual(spans);
  });
});

describe('templateSpans ("rendering the match’s destination template with its applied arguments slot by slot")', () => {
  it.each([
    [
      'a filled slot shows its argument',
      'https://example.com/{}',
      ['MyRepo'],
      [
        ['text', 'https://example.com/'],
        ['argument', 'MyRepo'],
      ],
    ],
    [
      'an unfilled slot stays visible as a placeholder',
      'https://example.com/{}/tree/{}',
      ['thither'],
      [
        ['text', 'https://example.com/'],
        ['argument', 'thither'],
        ['text', '/tree/'],
        ['placeholder', '{}'],
      ],
    ],
    [
      'no arguments: every slot is a placeholder',
      'https://example.com/{}',
      [],
      [
        ['text', 'https://example.com/'],
        ['placeholder', '{}'],
      ],
    ],
    [
      'a template without slots is one plain span',
      'https://example.com/',
      [],
      [['text', 'https://example.com/']],
    ],
    [
      'an argument that is itself {} is an argument, never re-read as a placeholder',
      'https://example.com/{}/tree/{}',
      ['{}', 'y'],
      [
        ['text', 'https://example.com/'],
        ['argument', '{}'],
        ['text', '/tree/'],
        ['argument', 'y'],
      ],
    ],
    [
      'a slot at the start of the template: no empty text span before it',
      '{}',
      ['x'],
      [['argument', 'x']],
    ],
    [
      'the argument text also occurs in the template: the slot, not the text, is marked',
      'https://example.com/thither/{}',
      ['thither'],
      [
        ['text', 'https://example.com/thither/'],
        ['argument', 'thither'],
      ],
    ],
  ])('%s', (_name, template, args, spans) => {
    expect(templateSpans(template, args)).toEqual(spans);
  });

  // dsl.md §5's table, with the applied arguments only (extra arguments are not in `args`).
  it.each([
    ['https://example.com/{}', ['MyRepo'], 'https://example.com/MyRepo'],
    ['https://example.com/{}', ['thither'], 'https://example.com/thither'],
    ['https://example.com/{}', ['a/b'], 'https://example.com/a/b'],
    ['https://example.com/{}/tree/{}', ['thither'], 'https://example.com/thither/tree/{}'],
    ['https://example.com/{}/tree/{}', ['{}', 'y'], 'https://example.com/{}/tree/y'],
    ['https://example.com/{}', [], 'https://example.com/{}'],
    ['https://example.com/', [], 'https://example.com/'],
  ])(
    '§5 the spans of %s with %j re-join to the rendered destination %s',
    (template, args, destination) => {
      expect(
        templateSpans(template, args)
          .map(([, text]) => text)
          .join(''),
      ).toBe(destination);
    },
  );
});

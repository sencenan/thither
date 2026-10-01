// browser-client.md "Execution flow" — the client base state: one target keyed `thither`, an
// arity-0 variant pointing at the page itself, its query and fragment dropped.

import { describe, expect, it } from 'vitest';
import { createInterpreter, defaultEnv } from '../../dsl/index.ts';
import { baseState } from '../base-state.ts';

describe('baseState', () => {
  it.each<[name: string, pageUrl: string, destination: string]>([
    ['the page URL as is', 'https://host.example/thither/', 'https://host.example/thither/'],
    [
      'the query and fragment are dropped',
      'https://host.example/thither/?q=git#q=docs',
      'https://host.example/thither/',
    ],
    [
      'a file: page keeps its path',
      'file:///tmp/thither/index.html',
      'file:///tmp/thither/index.html',
    ],
    [
      'a {} in the path is percent-encoded, so the variant stays arity 0',
      'https://host.example/{}/',
      'https://host.example/%7B%7D/',
    ],
  ])('%s', (_name, pageUrl, destination) => {
    expect(baseState(pageUrl)).toEqual([
      'S',
      { targets: { thither: [destination] }, focus: [], alias: {} },
    ]);
  });

  it('is a valid state: it parses to itself', () => {
    const base = baseState('https://host.example/thither/?q=x');
    expect(createInterpreter(defaultEnv()).pushToken([], base)).toEqual([base]);
  });
});

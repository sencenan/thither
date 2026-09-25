// browser-client.md "Reading input" — input selection precedence, single-pass
// URLSearchParams decoding, whitespace tokenization, and stripping consumed input.

import { describe, expect, it } from 'vitest';
import { readInput, stripInput, tokenize } from '../input.ts';

const base = 'https://thither.app/';

type Case = readonly [name: string, url: string, tokens: readonly string[]];

const precedence: readonly Case[] = [
  ['query `q` present is used', `${base}?q=company+git`, ['company', 'git']],
  ['other query params do not shadow query `q`', `${base}?other=1&q=docs`, ['docs']],
  ['no query `q` falls back to the fragment `q`', `${base}#q=company+git`, ['company', 'git']],
  ['other query params do not prevent fragment fallback', `${base}?other=1#q=docs`, ['docs']],
  ['an empty `?q=` beats a populated fragment', `${base}?q=#q=docs`, []],
  ['when both hold `q`, only the query runs', `${base}?q=fromquery#q=fromfragment`, ['fromquery']],
  ['neither source holds `q` is empty input', base, []],
  ['a fragment without `q` is empty input', `${base}#foo=bar`, []],
];

const decoding: readonly Case[] = [
  ['query `+` decodes to a space', `${base}?q=a+b`, ['a', 'b']],
  ['query `%2B` decodes to one literal plus', `${base}?q=a%2Bb`, ['a+b']],
  ['fragment `+` decodes to a space', `${base}#q=a+b`, ['a', 'b']],
  ['fragment `%2B` decodes to one literal plus', `${base}#q=a%2Bb`, ['a+b']],
];

const multipleQ: readonly Case[] = [
  ['the first of multiple query `q` wins', `${base}?q=first&q=second`, ['first']],
  ['the first of multiple fragment `q` wins', `${base}#q=first&q=second`, ['first']],
];

const tokenization: readonly Case[] = [
  ['multiple spaces collapse between tokens', `${base}?q=a+++b`, ['a', 'b']],
  ['a tab separates tokens', `${base}?q=a%09b`, ['a', 'b']],
  ['leading and trailing whitespace is dropped', `${base}?q=+a+b+`, ['a', 'b']],
];

describe('readInput — selection precedence', () => {
  it.each(precedence)('%s', (_name, url, tokens) => {
    expect(readInput(url)).toEqual(tokens);
  });
});

describe('readInput — single-pass decoding', () => {
  it.each(decoding)('%s', (_name, url, tokens) => {
    expect(readInput(url)).toEqual(tokens);
  });
});

describe('readInput — repeated `q` parameters', () => {
  it.each(multipleQ)('%s', (_name, url, tokens) => {
    expect(readInput(url)).toEqual(tokens);
  });
});

describe('readInput — whitespace tokenization', () => {
  it.each(tokenization)('%s', (_name, url, tokens) => {
    expect(readInput(url)).toEqual(tokens);
  });
});

// browser-client.md "Fallback UI and settings" — the text field splits exactly as the URL does.
const fieldTokenization: ReadonlyArray<
  readonly [name: string, text: string, tokens: readonly string[]]
> = [
  ['single spaces separate tokens', 'company git', ['company', 'git']],
  ['runs of mixed whitespace collapse', ' company \t git\n', ['company', 'git']],
  ['an empty field is empty input', '', []],
  ['a whitespace-only field is empty input', '   ', []],
  ['a lone separator is a token', 'docs . x', ['docs', '.', 'x']],
];

describe('tokenize — the text field splits like the URL', () => {
  it.each(fieldTokenization)('%s', (_name, text, tokens) => {
    expect(tokenize(text)).toEqual(tokens);
  });
});

type StripCase = readonly [name: string, url: string, stripped: string];

const stripping: readonly StripCase[] = [
  ['query `q` is removed with its `?`', `${base}?q=company+git`, base],
  ['an empty `?q=` is removed', `${base}?q=`, base],
  ['other query params survive', `${base}?other=1&q=docs`, `${base}?other=1`],
  ['every repeated query `q` is removed', `${base}?q=first&q=second`, base],
  ['fragment `q` is removed with its `#`', `${base}#q=company+git`, base],
  ['other fragment params survive', `${base}#other=1&q=docs`, `${base}#other=1`],
  ['both sources are stripped', `${base}?q=fromquery#q=fromfragment`, base],
  ['a fragment without `q` is kept verbatim', `${base}?q=docs#section`, `${base}#section`],
  ['a URL without `q` is unchanged', `${base}?other=1#foo=bar`, `${base}?other=1#foo=bar`],
  ['the path is kept', `${base}launcher/?q=docs`, `${base}launcher/`],
];

describe('stripInput — consumed input leaves the URL', () => {
  it.each(stripping)('%s', (_name, url, stripped) => {
    expect(stripInput(url)).toBe(stripped);
  });

  it('strips what readInput reads', () => {
    expect(readInput(stripInput(`${base}?other=1&q=docs#q=more`))).toEqual([]);
  });
});

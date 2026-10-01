// @vitest-environment happy-dom

// browser-client.md "Fallback UI and settings" (ADR 0015) — a waiting program is shown token by
// token, each chip styled by what the parser made of it, its text as typed.

import { describe, expect, it } from 'vitest';
import { createInterpreter } from '../../dsl/index.ts';
import { createBrowserEnv } from '../browser-env.ts';
import type { StorageArea } from '../persistence.ts';
import { renderProgram } from '../program-view.ts';

const noStorage: StorageArea = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};
const interp = createInterpreter(createBrowserEnv(noStorage));

const chips = (tokens: readonly string[]) =>
  [...renderProgram(document, interp, tokens).querySelectorAll('li.token')].map((chip) => [
    chip.textContent,
    chip.className.replace('token ', ''),
  ]);

describe('renderProgram', () => {
  it.each<[string, string, string]>([
    ['ADR 0015 a bound operation', '.set', 'operation'],
    ['ADR 0015 a host operation is an operation too', '.load', 'operation'],
    ['dsl.md §2 an ordinary literal', 'home', 'literal'],
    ['dsl.md §2 a URL literal', 'https://example.com/{}', 'literal'],
    ['dsl.md §2 the standalone separator', '.', 'separator'],
    ['dsl.md §2 an alias', '~gh', 'alias'],
    ['dsl.md §2 a bare ~ is plain text', '~', 'literal'],
    ['dsl.md §2 an escaped ..set is a literal, shown as typed', '..set', 'literal'],
    ['dsl.md §2 an escaped .~gh is a literal, not an alias', '.~gh', 'literal'],
    ['dsl.md §6 an unbound operation name is a parse failure', '.s', 'error'],
    ['dsl.md §2 an operator-only token is a parse failure', '!', 'error'],
  ])('%s', (_name, token, kind) => {
    expect(chips([token])).toEqual([[token, kind]]);
  });

  it('ADR 0015 every token appears, in program order', () => {
    expect(chips(['.load', 'https://x/', 'x', '.set', '.$'])).toEqual([
      ['.load', 'operation'],
      ['https://x/', 'literal'],
      ['x', 'literal'],
      ['.set', 'operation'],
      ['.$', 'operation'],
    ]);
  });

  it('dsl.md §6 a parse failure carries its type and description on hover', () => {
    const chip = renderProgram(document, interp, ['.s']).querySelector('li.error');
    expect(chip?.getAttribute('title')).toContain('missing_operation');
  });
});

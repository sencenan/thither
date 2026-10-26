// browser-client.md "Execution flow" step 2 (ADR 0015) — a nontrivial program is read off the
// user's own tokens, and a run's search is rebuilt from its R as inputs, then `.` and args.

import { describe, expect, it } from 'vitest';
import { createInterpreter, type Result } from '../../dsl/index.ts';
import { createBrowserEnv } from '../browser-env.ts';
import type { StorageArea } from '../persistence.ts';
import { isNontrivial, keyTokens, searchTokens } from '../program.ts';

const noStorage: StorageArea = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};
const interp = createInterpreter(createBrowserEnv(noStorage));

describe('isNontrivial', () => {
  it.each<[string, readonly string[], boolean]>([
    ['ADR 0015 no tokens is a plain search', [], false],
    ['ADR 0015 literals alone are a plain search', ['company', 'git', '.', 'x'], false],
    ['ADR 0015 a .$ typed as the last token is what the closing .$ does', ['git', '.$'], false],
    ['ADR 0015 .set makes it nontrivial', ['https://x/', 'x', '.set'], true],
    ['ADR 0015 .rm makes it nontrivial', ['x', '.rm'], true],
    ['ADR 0015 .@ makes it nontrivial', ['x', '.@'], true],
    ['ADR 0015 .alias makes it nontrivial', ['h', 'home', '.alias'], true],
    ['ADR 0015 an operation anywhere counts, not only at the end', ['x', '.rm', 'y'], true],
    ['ADR 0015 a .$ before the end makes it nontrivial', ['git', '.$', 'docs'], true],
    ['ADR 0015 a host operation the user typed counts', ['.save'], true],
    ['dsl.md §2 an escaped ..set is a literal, not an operation', ['x', '..set'], false],
    ['dsl.md §2 an escaped .~x is a literal', ['.~x'], false],
    ['dsl.md §6 a half-typed .s is a missing_operation, not an operation', ['x', '.s'], false],
  ])('%s', (_name, tokens, nontrivial) => {
    expect(isNontrivial(interp, tokens)).toBe(nontrivial);
  });
});

describe('keyTokens', () => {
  it.each<[string, string, readonly string[]]>([
    ['dsl.md \u00a73 a key splits into its dimensions', 'company git', ['company', 'git']],
    ['dsl.md \u00a72 a dimension stored from ..git is escaped again', '.git x', ['..git', 'x']],
    ['dsl.md \u00a72 a dimension stored from .~x is escaped again', '~x', ['.~x']],
    ['dsl.md \u00a72 a bare ~ is plain text and stays as it is', '~', ['~']],
  ])('%s', (_name, key, tokens) => {
    expect(keyTokens(key)).toEqual(tokens);
  });

  it('dsl.md \u00a72 the tokens parse as literals, never as an operation', () => {
    expect(isNontrivial(interp, keyTokens('.rm .set'))).toBe(false);
  });
});

describe('searchTokens', () => {
  const result = (inputs: readonly string[], args: readonly string[]): Result => [
    'R',
    { matches: [], inputs, args },
  ];

  it.each<[string, Result, readonly string[]]>([
    ['dsl.md §4.4 inputs alone', result(['jira'], []), ['jira']],
    [
      'dsl.md §4.4 inputs, the separator, then the args',
      result(['jira'], ['PROJ']),
      ['jira', '.', 'PROJ'],
    ],
    ['dsl.md §4.4 a run with nothing to search rebuilds as nothing', result([], []), []],
    ['dsl.md §4.4 args with no inputs keep their separator', result([], ['x']), ['.', 'x']],
    [
      'dsl.md §2 escapes are kept in accumulated form',
      result(['..git'], ['..x']),
      ['..git', '.', '..x'],
    ],
  ])('%s', (_name, terminal, tokens) => {
    expect(searchTokens(terminal)).toEqual(tokens);
  });
});

// dsl.md §2 "Search operators", §3, §4.1, §4.3, §6 — where fzf's operators apply and where they
// are refused, one matrix through the public surface: every operator × every place it can land.

import { describe, expect, it } from 'vitest';
import { createInterpreter, defaultEnv, type Program, type Stack, type Target } from '../index.ts';

const run = (items: readonly unknown[]): Stack => {
  const interp = createInterpreter(defaultEnv());
  const program: Program = [];
  for (const item of items) {
    interp.pushToken(program, item);
  }
  return interp.execute(program);
};

const companyGit: Target = [['company', 'git'], 'https://github.com/company/{}'];
const companyDocs: Target = [['company', 'docs'], 'https://docs.company.com/{}'];
const docs: Target = [['docs'], 'https://docs.example.com/'];
const personalGit: Target = [['git', 'personal'], 'https://github.com/me/{}'];
const all = [companyGit, companyDocs, docs, personalGit];

const state = (targets: readonly Target[], focus: readonly string[] = []) => [
  'S',
  { targets: [...targets], focus },
];
const error = (type: string) => ['E', expect.objectContaining({ type })];

// The dimension lists a search result selected, in the order emitted.
const selectedDims = (stack: Stack): readonly (readonly string[])[] => {
  const top = stack[stack.length - 1];
  if (top?.[0] !== 'R') {
    throw new Error(`expected R on top, got ${JSON.stringify(top)}`);
  }
  return top[1].matches.map((match) => match[1]);
};

// operator → the query that exercises it → the targets it selects out of `all`
type Case = readonly [operator: string, terms: readonly string[], selects: readonly Target[]];

const cases: readonly Case[] = [
  ['AND (plain terms)', ['company', 'git'], [companyGit]],
  ['OR  `|`', ['docs', '|', 'personal'], [companyDocs, docs, personalGit]],
  ['NOT `!`', ['!personal'], [companyGit, companyDocs, docs]],
  ["exact `'`", ["'ompany"], [companyGit, companyDocs]],
  ['prefix `^`', ['^git'], [personalGit]],
  ['suffix `$`', ['git$'], [companyGit]],
  ['equal `^…$`', ['^docs$'], [docs]],
  ['NOT combined with AND', ['git', '!personal'], [companyGit]],
  ['OR combined with AND', ['company', 'git', '|', 'docs'], [companyGit, companyDocs]],
];

const same = (a: readonly Target[], b: readonly Target[]) =>
  expect([...a].map((t) => t[0]).sort()).toEqual([...b].map((t) => t[0]).sort());

describe('search operators apply in .$ (dsl.md §3, §4.4)', () => {
  it.each(cases)(
    '%s: %j selects the expected targets and reports the terms verbatim',
    (_op, terms, selects) => {
      const stack = run([state(all), ...terms, '.']);
      same(
        selectedDims(stack).map((dims) => [dims, ''] as const),
        selects,
      );
      expect(stack[stack.length - 1]?.[1]).toMatchObject({ inputs: terms });
      expect(stack[0]).toEqual(state(all));
    },
  );
});

describe('search operators apply in .rm (dsl.md §3, §4.2)', () => {
  it.each(cases)('%s: %j .rm removes exactly the selected targets', (_op, terms, selects) => {
    const stack = run([state(all), ...terms, '.rm']);
    expect(stack[0]).toEqual(state(all.filter((target) => !selects.includes(target))));
  });
});

// Every operator-bearing token, tested alone wherever a dimension would be stored.
const operatorTokens = ['|', '!personal', "'ompany", '^git', 'git$', '^docs$'];

describe('search operators are refused where a dimension is stored (dsl.md §4.1, §4.3, §6)', () => {
  it.each(operatorTokens)(
    '.set: %s https://x/ .set is invalid_dimension and stores nothing',
    (token) => {
      const stack = run([state(all), token, 'https://x/', '.set']);
      expect(stack).toEqual([state(all), error('invalid_dimension')]);
    },
  );

  it.each(operatorTokens)('.set: a plain dimension next to %s still fails as a whole', (token) => {
    const stack = run([state(all), 'home', token, 'https://x/', '.set']);
    expect(stack).toEqual([state(all), error('invalid_dimension')]);
  });

  it.each(operatorTokens)('.@: %s .@ is invalid_dimension and leaves focus unchanged', (token) => {
    const stack = run([state(all, ['company']), token, '.@']);
    expect(stack).toEqual([state(all, ['company']), error('invalid_dimension')]);
  });

  it.each(operatorTokens)('supplied S: %s as a target dimension is parse_error', (token) => {
    const stack = run([state([[[token], 'https://x/']])]);
    expect(stack).toEqual([error('parse_error')]);
  });

  it.each(operatorTokens)('supplied S: %s in focus is parse_error', (token) => {
    const stack = run([state([], [token])]);
    expect(stack).toEqual([error('parse_error')]);
  });
});

describe('operator-only tokens are parse errors everywhere (dsl.md §2)', () => {
  const operatorOnly = ['!', "'", '^', '^$', "'$"];

  it.each(operatorOnly)(
    '%s .rm does not wipe the target set: the token is E, .rm never runs',
    (token) => {
      const stack = run([state(all), token, '.rm']);
      expect(stack).toEqual([state(all), error('parse_error')]);
    },
  );

  it.each(operatorOnly)('%s .$ selects nothing: the token is E', (token) => {
    const stack = run([state(all), token]);
    expect(stack).toEqual([state(all), error('parse_error')]);
  });
});

describe('a bare $ is plain text, not an operator (dsl.md §2)', () => {
  it('$ can be stored as a dimension by .set and .@', () => {
    expect(run([state([]), '$', 'https://x/', '.set', '$', '.@', '.$'])[0]).toEqual(
      state([[['$'], 'https://x/']], ['$']),
    );
  });

  it('$ .$ fuzzy-matches the stored $ dimension', () => {
    const stack = run([state([[['$'], 'https://x/'], docs]), '$', '.']);
    expect(selectedDims(stack)).toEqual([['$']]);
  });
});

// dsl.md §4.1 — .set: insert or update a target

import { describe, expect, it } from 'vitest';
import { createInterpreter } from '../../interpreter.ts';
import type { InterpreterEnv, OpFn, Program, Stack, State, Target } from '../../types.ts';
import { set } from '../set.ts';

const identity: OpFn = (stack) => stack;
const env: InterpreterEnv = {
  symbols: new Map<string, OpFn>([
    ['.set', set],
    ['.$', identity],
  ]),
};

const run = (items: readonly unknown[]): Stack => {
  const interp = createInterpreter(env);
  const program: Program = [];
  for (const item of items) {
    interp.pushToken(program, item);
  }
  return interp.execute(program);
};

const state = (targets: readonly Target[], focus: readonly string[] = []): State => [
  'S',
  { targets: [...targets], focus },
];

const error = (type: string) => ['E', expect.objectContaining({ type })];

const companyGit: Target = [['company', 'git'], 'https://github.com/company/{}'];
const companyDocs: Target = [['company', 'docs'], 'https://docs.company.com/{}'];
const personalGit: Target = [['git', 'personal'], 'https://github.com/me/{}'];
const three = [companyGit, companyDocs, personalGit];
const companyGitLab: Target = [['company', 'git'], 'https://gitlab.com/company/{}'];
const explicitError = ['E', { type: 'unknown_error', description: 'boom' }];

type Case = readonly [name: string, program: readonly unknown[], stack: readonly unknown[]];

const cases: readonly Case[] = [
  // operand extraction
  [
    '§4.1 the last literal is the destination; the separator and its suffix play no part',
    [state([]), 'company', 'git', '.', 'ignored', 'https://github.com/company/{}', '.set'],
    [state([companyGit])],
  ],
  [
    '§4.1 a plain URL with zero placeholders is a valid destination',
    [state([]), 'home', 'https://example.com/', '.set'],
    [state([[['home'], 'https://example.com/']])],
  ],
  [
    '§2 stores the original template text, not the parser-normalized probe',
    [state([]), 'app', 'MyApp:Open/{}', '.set'],
    [state([[['app'], 'MyApp:Open/{}']])],
  ],
  [
    '§2 validation renders {} before parsing: a placeholder in the scheme is accepted',
    [state([]), 'proto', '{}://example.com', '.set'],
    [state([[['proto'], '{}://example.com']])],
  ],

  // cardinality
  [
    '§4.1 zero matches appends a target to the end with normalized combined dimensions',
    [state([companyDocs]), 'GIT', 'Company', 'git', 'https://github.com/company/{}', '.set'],
    [state([companyDocs, companyGit])],
  ],
  [
    '§4.1 exactly one match replaces only that destination, keeping dimensions and position',
    [state(three), 'comp', 'git', 'https://gitlab.com/company/{}', '.set'],
    [state([companyGitLab, companyDocs, personalGit])],
  ],
  [
    '§4.1 fuzzy updating does not rename dimensions: comp git keeps [company, git]',
    [state([companyGit]), 'comp', 'git', 'https://gitlab.com/company/{}', '.set'],
    [state([companyGitLab])],
  ],
  [
    '§4.1 more than one match is ambiguous_set and leaves the input state unchanged',
    [state(three), 'git', 'https://gitlab.com/{}', '.set'],
    [state(three), error('ambiguous_set')],
  ],

  // focus joins the query
  [
    '§3 focus is prepended to the explicit dimensions when matching',
    [state(three, ['company']), 'git', 'https://gitlab.com/company/{}', '.set'],
    [state([companyGitLab, companyDocs, personalGit], ['company'])],
  ],
  [
    '§4.1 an inserted target carries the combined focus and explicit dimensions',
    [state([companyDocs], ['personal']), 'docs', 'https://docs.me.com/{}', '.set'],
    [state([companyDocs, [['docs', 'personal'], 'https://docs.me.com/{}']], ['personal'])],
  ],
  [
    '§3 query order is irrelevant: git company selects the same target as company git',
    [state(three), 'git', 'company', 'https://gitlab.com/company/{}', '.set'],
    [state([companyGitLab, companyDocs, personalGit])],
  ],
  [
    '§3 the query is one sorted pattern: comp git updates [company, git]',
    [state([companyGit]), 'comp', 'git', 'https://gitlab.com/company/{}', '.set'],
    [state([companyGitLab])],
  ],
  [
    '§3 matching is diacritic-insensitive: cafe matches café',
    [state([[['café'], 'https://cafe.example/']]), 'cafe', 'https://cafe.example/menu', '.set'],
    [state([[['café'], 'https://cafe.example/menu']])],
  ],

  // missing_operand
  [
    '§6 S .set is missing_operand: no literal array',
    [state([]), '.set'],
    [state([]), error('missing_operand')],
  ],
  [
    '§6 S https://github.com/company/{} .set is missing_operand: no explicit dimension',
    [state([]), 'https://github.com/company/{}', '.set'],
    [state([]), error('missing_operand')],
  ],
  [
    '§6 S . ignored https://github.com/company/{} .set is missing_operand: the suffix is ignored',
    [state([]), '.', 'ignored', 'https://github.com/company/{}', '.set'],
    [state([]), error('missing_operand')],
  ],
  [
    '§4.1 focus cannot satisfy the explicit-dimension requirement',
    [state([], ['company']), 'https://github.com/company/{}', '.set'],
    [state([], ['company']), error('missing_operand')],
  ],
  [
    '§6 with no state anywhere on the stack the literal array is consumed and E is pushed',
    ['git', 'https://example.com/{}', '.set'],
    [error('missing_operand')],
  ],

  // invalid_destination
  [
    '§2 a scheme-bearing literal that fails render-then-parse is invalid_destination',
    [state([]), 'company', 'https://exa|mple.com/{}', '.set'],
    [state([]), error('invalid_destination')],
  ],
  [
    '§6 S company git .set is invalid_destination: the last literal is always the destination',
    [state([]), 'company', 'git', '.set'],
    [state([]), error('invalid_destination')],
  ],
  [
    '§4.1 does not search backward for a URL: a trailing dimension is an unusable destination',
    [state([]), 'company', 'https://github.com/company/{}', 'git', '.set'],
    [state([]), error('invalid_destination')],
  ],

  // state preservation
  [
    '§6 failure retains the nearest state: [S0, L0, S1, L1] .set -> [S0, L0, S1, E]',
    [state([]), 'stray', state(three), 'git', 'https://gitlab.com/{}', '.set'],
    [state([]), ['L', ['stray']], state(three), error('ambiguous_set')],
  ],
  [
    '§1 on a sealed stack .set produces nothing that survives',
    [state([]), 'git', explicitError, 'company', 'https://example.com/{}', '.set'],
    [state([]), ['L', ['git']], explicitError],
  ],
];

describe('.set (dsl.md §4.1)', () => {
  it.each(cases)('%s', (_name, program, stack) => {
    expect(run(program)).toEqual(stack);
  });
});

// The evaluator never leaves anything but a state (or nothing) beneath a literal
// array, so this contract is only observable by calling the operation directly.
describe('.set — operand contract', () => {
  it('§6 consumes only its literal array: a non-state value beneath it is left in place', () => {
    const stack: Stack = [
      ['L', ['stray']],
      ['L', ['git', 'https://example.com/{}']],
    ];
    expect(set(stack)).toEqual([['L', ['stray']], error('missing_operand')]);
  });
});

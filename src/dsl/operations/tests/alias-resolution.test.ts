// dsl.md §2 "Aliases", §4.1–§4.4 — ~short resolves in focus-setting and search, and is
// refused by target-setting and removal.

import { describe, expect, it } from 'vitest';
import { alias } from '../alias.ts';
import { at } from '../at.ts';
import { rm } from '../rm.ts';
import { search } from '../search.ts';
import { set } from '../set.ts';
import { type Case, error, runWith, state, type TargetSpec } from './harness.ts';

const run = runWith({ '.alias': alias, '.@': at, '.$': search, '.set': set, '.rm': rm });

const github: TargetSpec = [['github'], 'https://github.com/{}'];
const definitions = { gh: 'github', me: 'sencenan', dot: '..set' };
const withDefinitions = state([github], [], definitions);

// One row for the github target: the rendered destination, its template, key, and arguments.
const row = (dest: string, args: readonly string[]) => [
  dest,
  'https://github.com/{}',
  'github',
  args,
  expect.objectContaining({ argDelta: 0 }),
];

const cases: readonly Case[] = [
  // .@ resolves before storing
  [
    '§4.3 ~gh .@ stores the defined literal as focus, never the alias',
    [withDefinitions, '~gh', '.@'],
    [state([github], ['github'], definitions)],
  ],
  [
    '§2 the short form is looked up lowercased: ~GH finds gh',
    [withDefinitions, '~GH', '.@'],
    [state([github], ['github'], definitions)],
  ],
  [
    '§2 an alias with no definition stays as typed',
    [withDefinitions, '~ZZ', '.@'],
    [state([github], ['~ZZ'], definitions)],
  ],
  [
    '§2 a bare ~ has no short form and is plain text',
    [withDefinitions, '~', '.@'],
    [state([github], ['~'], definitions)],
  ],
  [
    '§2 an escaped .~gh is never looked up; it is kept as accumulated, like ..git',
    [withDefinitions, '.~gh', '.@'],
    [state([github], ['.~gh'], definitions)],
  ],
  [
    '§2 the defined literal is used once, not resolved again: its own escape is kept',
    [withDefinitions, '~dot', '.@'],
    [state([github], ['..set'], definitions)],
  ],
  [
    '§4.3 only the matching portion is resolved and stored; the suffix is ignored as before',
    [withDefinitions, '~gh', '.', '~me', '.@'],
    [state([github], ['github'], definitions)],
  ],
  [
    '§2 an alias defined earlier in the same program resolves',
    [state([github]), 'gh', 'github', '.alias', '~gh', '.@'],
    [state([github], ['github'], { gh: 'github' })],
  ],

  // .$ resolves its whole literal array, arguments included
  [
    '§4.4 ~gh ~me .$ searches github with the argument sencenan; R.inputs is the resolved spelling',
    [withDefinitions, '~gh', '~me', '.$'],
    [
      withDefinitions,
      ['R', { matches: [row('https://github.com/sencenan', ['sencenan'])], inputs: ['github'] }],
    ],
  ],
  [
    '§4.4 an argument after the separator is resolved too',
    [withDefinitions, '~gh', '.', '~me', '.$'],
    [
      withDefinitions,
      ['R', { matches: [row('https://github.com/sencenan', ['sencenan'])], inputs: ['github'] }],
    ],
  ],

  // .set and .rm refuse aliases anywhere in L
  [
    '§4.1 .set refuses an alias as a dimension, keeping the state',
    [withDefinitions, 'https://x.example/', '~gh', '.set'],
    [withDefinitions, error('invalid_dimension')],
  ],
  [
    '§4.1 .set refuses an alias even when it has no definition',
    [withDefinitions, 'https://x.example/', '~zz', '.set'],
    [withDefinitions, error('invalid_dimension')],
  ],
  [
    '§4.1 .set refuses an alias after the separator',
    [withDefinitions, 'https://x.example/', 'x', '.', '~gh', '.set'],
    [withDefinitions, error('invalid_dimension')],
  ],
  [
    '§4.1 .set refuses an alias as the destination before URL validation',
    [withDefinitions, '~home', 'x', '.set'],
    [withDefinitions, error('invalid_dimension')],
  ],
  [
    '§4.1 an escaped .~x is plain text: .set stores the dimension ~x',
    [withDefinitions, 'https://x.example/', '.~x', '.set'],
    [state([github, [['~x'], 'https://x.example/']], [], definitions)],
  ],
  [
    '§4.2 .rm refuses an alias as a dimension, keeping the state',
    [withDefinitions, '~gh', '.rm'],
    [withDefinitions, error('invalid_dimension')],
  ],
  [
    '§4.2 .rm refuses an alias in its arity suffix',
    [withDefinitions, 'github', '.', '~me', '.rm'],
    [withDefinitions, error('invalid_dimension')],
  ],
  [
    '§4.2 an escaped .~x is plain text: .rm removes the target keyed ~x',
    [state([github, [['~x'], 'https://x.example/']], [], definitions), '.~x', '.rm'],
    [withDefinitions],
  ],
];

describe('alias resolution (dsl.md §2, §4.1–§4.4)', () => {
  it.each(cases)('%s', (_name, program, stack) => {
    expect(run(program)).toEqual(stack);
  });
});

// dsl.md §4.8 — .done: remove a todo item

import { describe, expect, it } from 'vitest';
import { done } from '../done.ts';
import { search } from '../search.ts';
import { type Case, error, explicitError, runWith, state, three } from './harness.ts';

const run = runWith({ '.done': done, '.$': search });

const a = 'https://a.com';
const b = 'https://b.com';
const c = 'https://c.com';
const withTodo = (...items: string[]) => state(three, [], {}, items);
const d = (...items: string[]) => ['D', { todo: items }];

const cases: readonly Case[] = [
  [
    '§4.8 removes the URL, the others keeping their order',
    [withTodo(a, b, c), b, '.done'],
    [withTodo(a, c), d(a, c)],
  ],
  [
    '§4.8 removing the last item leaves an empty list',
    [withTodo(a), a, '.done'],
    [withTodo(), d()],
  ],
  [
    '§4.8 a URL not held is a no-op that still shows the list',
    [withTodo(a), b, '.done'],
    [withTodo(a), d(a)],
  ],
  [
    '§4.8 URLs compare as text: a trailing slash does not match',
    [withTodo(a), `${a}/`, '.done'],
    [withTodo(a), d(a)],
  ],
  [
    '§4.8 focus plays no part and is kept',
    [state(three, ['company'], {}, [a]), a, '.done'],
    [state(three, ['company'], {}, []), d()],
  ],
  ['§1 D is terminal: a later .$ is absorbed', [withTodo(a), a, '.done', '.$'], [withTodo(), d()]],

  // invalid_destination
  [
    '§4.8 a template is invalid_destination',
    [withTodo(a), 'https://a.com/{}', '.done'],
    [withTodo(a), error('invalid_destination')],
  ],
  [
    '§4.8 an alias is not resolved: it is not a URL',
    [state(three, [], { a }, [a]), '~a', '.done'],
    [state(three, [], { a }, [a]), error('invalid_destination')],
  ],

  // missing_operand
  [
    '§4.8 more than one literal is missing_operand',
    [withTodo(a), a, b, '.done'],
    [withTodo(a), error('missing_operand')],
  ],
  [
    '§4.8 no literal array is missing_operand, the state put back',
    [withTodo(a), '.done'],
    [withTodo(a), error('missing_operand')],
  ],
  ['§6 no state beneath L is missing_operand', [a, '.done'], [error('missing_operand')]],
  ['§6 an empty stack is missing_operand', ['.done'], [error('missing_operand')]],
  [
    '§6 a sealed stack absorbs .done',
    [withTodo(a), explicitError, a, '.done'],
    [withTodo(a), explicitError],
  ],
];

describe('.done', () => {
  it.each(cases)('%s', (_name, program, expected) => {
    expect(run(program)).toEqual(expected);
  });
});

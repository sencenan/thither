// dsl.md §4.7 — .todo: add a todo item, or show the todo list

import { describe, expect, it } from 'vitest';
import { search } from '../search.ts';
import { todo } from '../todo.ts';
import { type Case, error, explicitError, runWith, state, three } from './harness.ts';

const run = runWith({ '.todo': todo, '.$': search });

const a = 'https://a.com';
const b = 'https://b.com';
const withTodo = (...items: string[]) => state(three, [], {}, items);
const d = (...items: string[]) => ['D', { todo: items }];

const cases: readonly Case[] = [
  // add
  ['§4.7 appends the URL to an empty todo list', [withTodo(), a, '.todo'], [withTodo(a), d(a)]],
  ['§4.7 appends to the end', [withTodo(a), b, '.todo'], [withTodo(a, b), d(a, b)]],
  [
    '§4.7 a URL already held leaves the list unchanged, in place',
    [withTodo(a, b), a, '.todo'],
    [withTodo(a, b), d(a, b)],
  ],
  [
    '§4.7 URLs compare as text: a trailing slash is another item',
    [withTodo(a), `${a}/`, '.todo'],
    [withTodo(a, `${a}/`), d(a, `${a}/`)],
  ],
  [
    '§4.7 focus plays no part and is kept',
    [state(three, ['company'], {}, []), a, '.todo'],
    [state(three, ['company'], {}, [a]), d(a)],
  ],
  [
    '§4.7 any scheme is a URL',
    [withTodo(), 'mailto:x@y.z', '.todo'],
    [withTodo('mailto:x@y.z'), d('mailto:x@y.z')],
  ],

  // show
  [
    '§4.7 without a literal array shows the list unchanged',
    [withTodo(a), '.todo'],
    [withTodo(a), d(a)],
  ],
  ['§4.7 an empty list shows as an empty D', [withTodo(), '.todo'], [withTodo(), d()]],

  // terminal
  ['§1 D is terminal: a later .$ is absorbed', [withTodo(), a, '.todo', '.$'], [withTodo(a), d(a)]],
  [
    '§1 D is terminal: later literals are absorbed',
    [withTodo(), '.todo', 'git'],
    [withTodo(), d()],
  ],

  // invalid_destination
  [
    '§4.7 a template is not a todo item',
    [withTodo(), 'https://a.com/{}', '.todo'],
    [withTodo(), error('invalid_destination')],
  ],
  [
    '§4.7 a non-URL literal is invalid_destination',
    [withTodo(), 'later', '.todo'],
    [withTodo(), error('invalid_destination')],
  ],
  [
    '§4.7 an alias is not resolved: it is not a URL',
    [state(three, [], { a }, []), '~a', '.todo'],
    [state(three, [], { a }, []), error('invalid_destination')],
  ],
  [
    '§4.7 an escaped literal is not a URL either',
    [withTodo(), '..a', '.todo'],
    [withTodo(), error('invalid_destination')],
  ],

  // missing_operand
  [
    '§4.7 more than one literal is missing_operand',
    [withTodo(), a, 'later', '.todo'],
    [withTodo(), error('missing_operand')],
  ],
  [
    '§4.7 the separator is one more literal',
    [withTodo(), a, '.', '.todo'],
    [withTodo(), error('missing_operand')],
  ],
  ['§6 no state beneath L is missing_operand', [a, '.todo'], [error('missing_operand')]],
  ['§6 an empty stack is missing_operand', ['.todo'], [error('missing_operand')]],
  [
    '§6 a sealed stack absorbs .todo',
    [withTodo(), explicitError, a, '.todo'],
    [withTodo(), explicitError],
  ],
];

describe('.todo', () => {
  it.each(cases)('%s', (_name, program, expected) => {
    expect(run(program)).toEqual(expected);
  });
});

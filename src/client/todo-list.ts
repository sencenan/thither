// browser-client.md "Fallback UI and settings" — the todo view a run ending in a `D` shows in
// place of the match list: one row per todo item in stored order, never sorted, each a link to
// its URL. The rows share the match list's row shape, so the selection, the arrows, Enter, and
// the `Ctrl+digit` shortcuts reach them unchanged; Right reads the selected row's URL from here.

import { type KeyHint, renderKeyHints, SHORTCUT_DIGITS } from './match-list.ts';

const EXAMPLE = 'https://example.com .todo';

const TODO_HINTS: readonly KeyHint[] = [
  [
    ['key', '\u2191'],
    ['key', '\u2193'],
    ['text', ' select'],
  ],
  [
    ['key', '\u2192'],
    ['text', ' edit URL'],
  ],
  [
    ['key', 'Enter'],
    ['text', ' open'],
  ],
  [
    ['key', 'Ctrl'],
    ['text', '+'],
    ['key', '1\u20130'],
    ['text', ' open row'],
  ],
  [
    ['key', 'Esc'],
    ['text', ' clear'],
  ],
];

// The bar names the view, so a todo list is never read as a search result.
const renderFooter = (doc: Document, count: number): Element => {
  const footer = doc.createElement('footer');
  footer.className = 'todo-view';
  const label = doc.createElement('span');
  label.className = 'view-label';
  label.textContent = 'Todo list';
  const summary = doc.createElement('span');
  summary.className = 'count';
  summary.textContent = `${count} ${count === 1 ? 'item' : 'items'}`;
  const title = doc.createElement('span');
  title.append(label, summary);
  footer.append(title, renderKeyHints(doc, TODO_HINTS));
  return footer;
};

const renderRow = (doc: Document, url: string, index: number): Element => {
  const badge = doc.createElement('kbd');
  badge.textContent = SHORTCUT_DIGITS[index] ?? '';

  const destination = doc.createElement('span');
  destination.className = 'destination';
  destination.textContent = url;

  const link = doc.createElement('a');
  link.href = url;
  link.append(badge, destination);

  const row = doc.createElement('li');
  row.className = 'match todo';
  row.dataset.todo = url;
  row.appendChild(link);
  return row;
};

const renderEmpty = (doc: Document): Element => {
  const empty = doc.createElement('p');
  empty.className = 'todo-empty';
  const example = doc.createElement('code');
  example.textContent = EXAMPLE;
  empty.append('No todos. Keep a page for later with ', example, '.');
  return empty;
};

// The summary bar, then the rows or the empty notice. Nothing starts selected.
export const renderTodoList = (doc: Document, todo: readonly string[]): readonly Node[] => {
  if (todo.length === 0) {
    return [renderFooter(doc, 0), renderEmpty(doc)];
  }
  const list = doc.createElement('ol');
  list.className = 'matches todos';
  list.append(...todo.map((url, index) => renderRow(doc, url, index)));
  return [renderFooter(doc, todo.length), list];
};

// The selected todo row's URL, or undefined while no todo row is selected.
export const selectedTodo = (region: Element): string | undefined =>
  region.querySelector<HTMLElement>('li.match.todo.selected')?.dataset.todo;

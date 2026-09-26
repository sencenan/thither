// browser-client.md "Fallback UI and settings" — the match list: one row per match in the order
// the core emits (the client never sorts), each row a link to its rendered destination carrying
// the shortcut digit, the key with its matched characters, the destination as the template
// filled slot by slot, the argument balance, and the score; then a footer with the count and the
// key hints. The list also answers which row a shortcut names, so the digit ↔ row mapping lives
// in one place.

import type { Match } from '../dsl/index.ts';
import { type KeySpan, keySpans, type TemplateSpan, templateSpans } from './match-spans.ts';

// The first ten rows carry `Ctrl+1`–`Ctrl+9`, then `Ctrl+0`; the rest have no shortcut and an
// empty badge.
const SHORTCUT_DIGITS: readonly string[] = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];
const KEY_HINTS = 'Enter opens the first match of a query · Ctrl+1–9, Ctrl+0 open a row';

const balanceLabel = (argDelta: number): string => {
  if (argDelta === 0) {
    return 'exact';
  }
  return argDelta > 0 ? `+${argDelta} extra` : `needs ${-argDelta} more`;
};

const renderSpans = (
  doc: Document,
  className: string,
  spans: readonly (KeySpan | TemplateSpan)[],
): Element => {
  const container = doc.createElement('span');
  container.className = className;
  for (const [kind, text] of spans) {
    if (kind === 'text') {
      container.append(text);
    } else {
      const marked = doc.createElement(kind === 'placeholder' ? 'span' : 'mark');
      marked.className = kind;
      marked.textContent = text;
      container.appendChild(marked);
    }
  }
  return container;
};

const renderRow = (doc: Document, match: Match, index: number): Element => {
  const [destination, template, key, args, hint] = match;

  const badge = doc.createElement('kbd');
  badge.textContent = SHORTCUT_DIGITS[index] ?? '';

  const balance = doc.createElement('span');
  balance.className = 'balance';
  balance.textContent = balanceLabel(hint.argDelta);

  const score = doc.createElement('span');
  score.className = 'score';
  score.textContent = `score ${hint.score}`;

  const link = doc.createElement('a');
  link.href = destination;
  link.append(
    badge,
    renderSpans(doc, 'key', keySpans(key, hint.positions)),
    renderSpans(doc, 'destination', templateSpans(template, args)),
    balance,
    score,
  );

  const row = doc.createElement('li');
  row.className = hint.argDelta < 0 ? 'match incomplete' : 'match';
  row.appendChild(link);
  return row;
};

const renderFooter = (doc: Document, count: number): Element => {
  const footer = doc.createElement('footer');
  const summary = doc.createElement('span');
  summary.textContent =
    `${count} ${count === 1 ? 'match' : 'matches'}` +
    (count > SHORTCUT_DIGITS.length ? ' · shortcuts on the first ten' : '');
  const hints = doc.createElement('span');
  hints.textContent = KEY_HINTS;
  footer.append(summary, hints);
  return footer;
};

export const renderMatchList = (doc: Document, matches: readonly Match[]): readonly Node[] => {
  if (matches.length === 0) {
    const empty = doc.createElement('p');
    empty.textContent = 'No matches.';
    return [empty];
  }

  const list = doc.createElement('ol');
  list.className = 'matches';
  list.append(...matches.map((match, index) => renderRow(doc, match, index)));
  return [list, renderFooter(doc, matches.length)];
};

// The link the nth row opens when clicked; a shortcut or Enter follows the same link.
export const rowLink = (region: Element, index: number): HTMLAnchorElement | undefined =>
  region.querySelectorAll<HTMLAnchorElement>('li.match > a')[index];

// browser-client.md "Fallback UI and settings" — the row a `Ctrl+digit` names, read by `code` so
// the numpad counts and a shifted or dead-key layout cannot change the digit; undefined for any
// other key, or a digit past the last row.
export const shortcutLink = (
  region: Element,
  event: KeyboardEvent,
): HTMLAnchorElement | undefined => {
  if (!event.ctrlKey || event.metaKey || event.altKey) {
    return undefined;
  }
  const digit = /^(?:Digit|Numpad)(\d)$/.exec(event.code)?.[1];
  const row = digit === undefined ? -1 : SHORTCUT_DIGITS.indexOf(digit);
  return row === -1 ? undefined : rowLink(region, row);
};

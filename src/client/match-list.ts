// browser-client.md "Fallback UI and settings" — the match list: one row per match in the order
// the core emits (the client never sorts), each row a link to its rendered destination carrying
// the shortcut digit, the key with its matched characters, the destination as the template
// filled slot by slot, the argument balance, and the score; above the list a summary bar with the
// count and the key hints, sticky so it stays in view while a long list scrolls. The list also
// holds the selected row — the one Enter opens, moved by the arrow keys — and answers which row a
// shortcut names, so the digit ↔ row mapping lives in one place.

import type { Match } from '../dsl/index.ts';
import { type KeySpan, keySpans, type TemplateSpan, templateSpans } from './match-spans.ts';

// The first ten rows carry `Ctrl+1`–`Ctrl+9`, then `Ctrl+0`; the rest have no shortcut and an
// empty badge.
const SHORTCUT_DIGITS: readonly string[] = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];

// Each hint is a run of key chips and plain text, so the bar reads as keyboard shortcuts.
type HintPart = readonly ['key' | 'text', string];
const KEY_HINTS: readonly (readonly HintPart[])[] = [
  [
    ['key', '\u2191'],
    ['key', '\u2193'],
    ['text', ' select'],
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

const SELECTED = 'selected';

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
  const onDestination = hint.on === 'destination';

  const badge = doc.createElement('kbd');
  badge.textContent = SHORTCUT_DIGITS[index] ?? '';

  const balance = doc.createElement('span');
  balance.className = 'balance';
  balance.textContent = balanceLabel(hint.argDelta);

  const score = doc.createElement('span');
  score.className = 'score';
  score.textContent = `score ${hint.score}`;

  // The key cell holds the key with its matched characters, then the arguments applied to this
  // variant (dsl.md §5) so the row states what was filled in, not only how the URL reads.
  const keyLine = doc.createElement('span');
  keyLine.className = 'key-line';
  keyLine.append(renderSpans(doc, 'key', keySpans(key, onDestination ? [] : hint.positions)));
  if (args.length > 0) {
    const applied = doc.createElement('span');
    applied.className = 'args';
    // A leading `.` echoes dsl.md's separator between the matching portion and the arguments,
    // shown only when arguments were actually applied.
    const sep = doc.createElement('span');
    sep.className = 'sep';
    sep.textContent = '.';
    applied.appendChild(sep);
    for (const arg of args) {
      const chip = doc.createElement('mark');
      chip.className = 'argument';
      chip.textContent = arg;
      applied.appendChild(chip);
    }
    keyLine.appendChild(applied);
  }

  const link = doc.createElement('a');
  link.href = destination;
  link.append(
    badge,
    keyLine,
    renderSpans(
      doc,
      'destination',
      templateSpans(template, args, onDestination ? hint.positions : []),
    ),
    balance,
    score,
  );

  const row = doc.createElement('li');
  row.className = hint.argDelta < 0 ? 'match incomplete' : 'match';
  row.appendChild(link);
  return row;
};

const renderFooter = (doc: Document, count: number, onDestination: boolean): Element => {
  const footer = doc.createElement('footer');
  const summary = doc.createElement('span');
  summary.className = 'count';
  summary.textContent =
    `${count} ${count === 1 ? 'match' : 'matches'}` +
    (count > SHORTCUT_DIGITS.length ? ' · shortcuts on the first ten' : '');
  if (onDestination) {
    const note = doc.createElement('span');
    note.className = 'on-destination';
    note.textContent = ' · on URL';
    summary.append(note);
  }
  const hints = doc.createElement('span');
  hints.className = 'hints';
  KEY_HINTS.forEach((hint, index) => {
    if (index > 0) {
      hints.append(' \u00b7 ');
    }
    for (const [kind, text] of hint) {
      if (kind === 'key') {
        const chip = doc.createElement('kbd');
        chip.textContent = text;
        hints.appendChild(chip);
      } else {
        hints.append(text);
      }
    }
  });
  footer.append(summary, hints);
  return footer;
};

// `selectFirst` is true when the run searched a query (ADR 0009's test): the first row starts
// selected, so Enter opens it. Otherwise nothing is selected until an arrow key picks a row.
export const renderMatchList = (
  doc: Document,
  matches: readonly Match[],
  selectFirst = false,
): readonly Node[] => {
  if (matches.length === 0) {
    const empty = doc.createElement('p');
    empty.textContent = 'No matches.';
    return [empty];
  }

  const list = doc.createElement('ol');
  list.className = 'matches';
  list.append(...matches.map((match, index) => renderRow(doc, match, index)));
  if (selectFirst) {
    list.firstElementChild?.classList.add(SELECTED);
  }
  // A result is all key matches or all destination matches: destination search runs only when
  // no key matched (dsl.md §4.4).
  const onDestination = matches.some((match) => match[4].on === 'destination');
  // The summary sits above the list and sticks to the top of the viewport (style.css), so the
  // count and key hints stay visible while a long list scrolls under it.
  return [renderFooter(doc, matches.length, onDestination), list];
};

// The link the nth row opens when clicked; a shortcut or Enter follows the same link.
export const rowLink = (region: Element, index: number): HTMLAnchorElement | undefined =>
  region.querySelectorAll<HTMLAnchorElement>('li.match > a')[index];

// The link Enter opens: the selected row's, or undefined while nothing is selected.
export const selectedLink = (region: Element): HTMLAnchorElement | undefined =>
  region.querySelector<HTMLAnchorElement>(`li.match.${SELECTED} > a`) ?? undefined;

// Moves the selection one row down (`1`) or up (`-1`), stopping at either end. With nothing
// selected, down selects the first row and up does nothing. The row is scrolled into view; its
// scroll margin (style.css) keeps it clear of the sticky summary bar.
export const moveSelection = (region: Element, step: 1 | -1): void => {
  const rows = [...region.querySelectorAll('li.match')];
  const current = rows.findIndex((row) => row.classList.contains(SELECTED));
  if (current === -1 && step === -1) {
    return;
  }
  const next = rows[current === -1 ? 0 : Math.min(Math.max(current + step, 0), rows.length - 1)];
  if (next === undefined) {
    return;
  }
  rows[current]?.classList.remove(SELECTED);
  next.classList.add(SELECTED);
  next.scrollIntoView({ block: 'nearest' });
};

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

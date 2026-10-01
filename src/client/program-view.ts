// browser-client.md "Fallback UI and settings" (ADR 0015) — the program a waiting nontrivial
// program would run, shown in place of the list: every token of the composed program, in order,
// as the parser reads it. Parsing executes nothing, so this is what will run, not what it will do.

import type { Interpreter, State } from '../dsl/index.ts';

type TokenKind = 'operation' | 'literal' | 'separator' | 'alias' | 'error' | 'state';

interface ParsedToken {
  readonly kind: TokenKind;
  // Why a token is an error: its `type` and `description`, shown on hover.
  readonly title?: string;
}

// dsl.md §2 — `~` followed by a short form; a bare `~` is plain text. The core's own check is not
// on its public surface, so the client restates the rule for styling only.
const isAlias = (text: string): boolean => text.startsWith('~') && text.length > 1;

const parseToken = (interp: Interpreter, source: string): ParsedToken => {
  const token = interp.pushToken([], source)[0];
  if (token?.[0] === 'o') {
    return { kind: 'operation' };
  }
  if (token?.[0] === 'l') {
    if (token[1] === '.') {
      return { kind: 'separator' };
    }
    return { kind: isAlias(token[1]) ? 'alias' : 'literal' };
  }
  if (token?.[0] === 'E') {
    return { kind: 'error', title: `${token[1].type}: ${token[1].description}` };
  }
  return { kind: 'literal' };
};

// A supplied state, such as the client base state, is one `S` chip with its JSON on hover.
const stateChip = (state: State): ParsedToken & { readonly text: string } => ({
  kind: 'state',
  title: JSON.stringify(state),
  text: 'S',
});

// Each chip shows its source token as typed: an E does not carry the text that produced it.
export const renderProgram = (
  doc: Document,
  interp: Interpreter,
  items: readonly (string | State)[],
): Element => {
  const list = doc.createElement('ol');
  list.className = 'program';
  for (const item of items) {
    const { kind, title, text } =
      typeof item === 'string' ? { ...parseToken(interp, item), text: item } : stateChip(item);
    const chip = doc.createElement('li');
    chip.className = `token ${kind}`;
    chip.textContent = text;
    if (title !== undefined) {
      chip.title = title;
    }
    list.appendChild(chip);
  }
  return list;
};

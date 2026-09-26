// browser-client.md "Fallback UI" — the results region beneath the field: an `E` as its `type` and
// `description` verbatim, then either the setup instructions (while the target set is empty) or
// an `R`'s matches as plain links in the order the core emits (the client never sorts). When the
// stored data could not be loaded, add the settings-reset hint instead of the instructions.
// `renderBareError` is the other page: what an unavailable localStorage leaves, with no execution
// behind it.

import type { Result, ThitherError } from '../dsl/index.ts';
import type { OutputRegister } from './browser-env.ts';

const RESET_HINT = 'Recovery is through the Settings reset.';
const EXAMPLE_SET_PROGRAM = 'https://github.com/company/{} company git .set';

export const renderBareError = (root: Element, error: unknown): void => {
  const line = root.ownerDocument.createElement('p');
  line.textContent = error instanceof Error ? error.message : String(error);
  root.replaceChildren(line);
};

// The page's own URL, with any query and fragment dropped, is the base of both shortcut templates.
// `href` rather than `origin + pathname`: a `file:` URL's origin is the string "null".
const shortcutTemplates = (pageUrl: string): readonly [query: string, fragment: string] => {
  const base = new URL(pageUrl);
  base.search = '';
  base.hash = '';
  return [`${base.href}?q=%s`, `${base.href}#q=%s`];
};

const showsSetupInstructions = (register: OutputRegister): boolean =>
  register.loaded &&
  register.state !== undefined &&
  Object.keys(register.state[1].targets).length === 0;

const renderSetupInstructions = (doc: Document, pageUrl: string): Element => {
  const section = doc.createElement('section');
  section.className = 'setup';

  const heading = doc.createElement('h2');
  heading.textContent = 'No targets yet';

  const shortcuts = doc.createElement('p');
  shortcuts.textContent =
    'Add Thither as a search shortcut in your browser, using either of these URL templates:';

  const [query, fragment] = shortcutTemplates(pageUrl);
  const templates = doc.createElement('dl');
  for (const [template, note] of [
    [query, 'default'],
    [fragment, 'keeps the input out of request logs'],
  ] as const) {
    const term = doc.createElement('dt');
    const code = doc.createElement('code');
    code.textContent = template;
    term.appendChild(code);
    const detail = doc.createElement('dd');
    detail.textContent = note;
    templates.append(term, detail);
  }

  const program = doc.createElement('p');
  program.textContent =
    'Then set your first target: the URL, with {} for each argument, followed by its dimensions.';

  const example = doc.createElement('pre');
  const exampleCode = doc.createElement('code');
  exampleCode.textContent = EXAMPLE_SET_PROGRAM;
  example.appendChild(exampleCode);

  section.append(heading, shortcuts, templates, program, example);
  return section;
};

const renderError = (doc: Document, error: ThitherError): Node => {
  const [, { type, description }] = error;
  const line = doc.createElement('p');
  line.textContent = `${type}: ${description}`;
  return line;
};

const renderMatches = (doc: Document, matches: Result[1]['matches']): Node => {
  if (matches.length === 0) {
    const empty = doc.createElement('p');
    empty.textContent = 'No matches.';
    return empty;
  }

  const list = doc.createElement('ul');
  for (const [destination, , key] of matches) {
    const item = doc.createElement('li');
    const link = doc.createElement('a');
    link.href = destination;
    link.textContent = key.length > 0 ? `${key} — ${destination}` : destination;
    item.appendChild(link);
    list.appendChild(item);
  }
  return list;
};

export const renderView = (root: Element, register: OutputRegister): void => {
  const doc = root.ownerDocument;
  const nodes: Node[] = [];

  const { terminal } = register;
  if (terminal?.[0] === 'E') {
    nodes.push(renderError(doc, terminal));
  }

  if (showsSetupInstructions(register)) {
    nodes.push(renderSetupInstructions(doc, location.href));
  } else if (terminal?.[0] === 'R') {
    nodes.push(renderMatches(doc, terminal[1].matches));
  }

  if (!register.loaded) {
    const hint = doc.createElement('p');
    hint.textContent = RESET_HINT;
    nodes.push(hint);
  }

  root.replaceChildren(...nodes);
};

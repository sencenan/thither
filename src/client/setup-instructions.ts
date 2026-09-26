// browser-client.md "Fallback UI and settings" — the setup instructions shown in place of the
// match list while the target set is empty: both search-shortcut URL templates for this page
// and one example `.set` program. Display only; they disappear once a target exists, and are not
// shown when the stored data could not be loaded.

import type { OutputRegister } from './browser-env.ts';

const EXAMPLE_SET_PROGRAM = 'https://github.com/company/{} company git .set';

export const showsSetupInstructions = (register: OutputRegister): boolean =>
  register.loaded &&
  register.state !== undefined &&
  Object.keys(register.state[1].targets).length === 0;

// The page's own URL, with any query and fragment dropped, is the base of both shortcut templates.
// `href` rather than `origin + pathname`: a `file:` URL's origin is the string "null".
const shortcutTemplates = (pageUrl: string): readonly [query: string, fragment: string] => {
  const base = new URL(pageUrl);
  base.search = '';
  base.hash = '';
  return [`${base.href}?q=%s`, `${base.href}#q=%s`];
};

export const renderSetupInstructions = (doc: Document, pageUrl: string): Element => {
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

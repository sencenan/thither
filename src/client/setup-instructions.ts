// browser-client.md "Fallback UI and settings" — the setup instructions shown in place of the
// match list while the target set is empty: the default search-shortcut URL template for this
// page, one example `.set` program, and one example fuzzy (fzf) search. Display only; they disappear once a
// target exists, and are not shown when the stored data could not be loaded. Help carries the
// fuller reference, including the `#q=` template.

import type { OutputRegister } from './browser-env.ts';

const EXAMPLE_SET_PROGRAM = 'https://github.com/company/{} company git .set';
const EXAMPLE_SEARCH = 'cmpny gt . my-repo';

export const showsSetupInstructions = (register: OutputRegister): boolean =>
  register.loaded &&
  register.state !== undefined &&
  Object.keys(register.state[1].targets).length === 0;

// The page's own URL, with any query and fragment dropped, is the base of both shortcut templates.
// `href` rather than `origin + pathname`: a `file:` URL's origin is the string "null".
export const shortcutTemplates = (pageUrl: string): readonly [query: string, fragment: string] => {
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
    'Add Thither as a search shortcut in your browser, using this URL template:';

  const [query] = shortcutTemplates(pageUrl);
  const shortcut = doc.createElement('pre');
  const shortcutCode = doc.createElement('code');
  shortcutCode.textContent = query;
  shortcut.appendChild(shortcutCode);

  const program = doc.createElement('p');
  program.textContent =
    'Then set your first target: the URL, with {} for each argument, followed by its dimensions.';

  const example = doc.createElement('pre');
  const exampleCode = doc.createElement('code');
  exampleCode.textContent = EXAMPLE_SET_PROGRAM;
  example.appendChild(exampleCode);

  const search = doc.createElement('p');
  const fzf = doc.createElement('span');
  fzf.className = 'fzf';
  fzf.textContent = 'fzf';
  search.append(
    doc.createTextNode('To go there, fuzzy-match the target with '),
    fzf,
    doc.createTextNode(
      ' \u2014 letters in order, no need to spell it out \u2014 then any argument values after a . separator:',
    ),
  );

  const searchExample = doc.createElement('pre');
  const searchExampleCode = doc.createElement('code');
  searchExampleCode.textContent = EXAMPLE_SEARCH;
  searchExample.appendChild(searchExampleCode);

  section.append(heading, shortcuts, shortcut, program, example, search, searchExample);
  return section;
};

// browser-client.md "Fallback UI and settings" — the Help modal: a comprehensive, always-available
// reference (unlike the setup instructions, which only show while the target set is empty). Three
// sections — how to use Thither, the language's basic rules, and how to set it up as a search
// shortcut. Display only; nothing here searches, navigates, or touches stored data.

import { shortcutTemplates } from './setup-instructions.ts';

export interface HelpDialog {
  readonly element: HTMLDialogElement;
  // Shows the dialog, refreshing the shortcut templates from the current page URL.
  open(pageUrl: string): void;
}

const EXAMPLE_SET_PROGRAM = 'https://github.com/company/{} company git .set';

// Each rule is a term and its explanation, rendered as a <dl>.
const USAGE: ReadonlyArray<readonly [string, string]> = [
  [
    'Search',
    'Type words that describe where you want to go; Thither fuzzy-matches them against your targets and lists the best fits.',
  ],
  [
    'Arguments',
    'Put a standalone . after the matching words, then the values that fill the target\u2019s {} placeholders: git company . my-branch',
  ],
  [
    'Open',
    'One complete match opens on its own. Otherwise press Enter for the first result, Ctrl+1\u2013Ctrl+9 / Ctrl+0 for a numbered row, or click a row.',
  ],
  ['Clear', 'Press Escape to empty the field and start over.'],
];

const RULES: ReadonlyArray<readonly [string, string]> = [
  [
    '.set',
    'Add or replace a target: the URL (with {} for each argument) first, then its dimensions. Replaces the variant of the same arity.',
  ],
  [
    '.rm',
    'Remove the matching targets, or with a . separator only the variant whose argument count the suffix names.',
  ],
  [
    '.@',
    'Set a focus: dimensions added to every search until you change it. Focus may carry search operators.',
  ],
  [
    '.$',
    'Search. It runs automatically at the end of what you type, so you rarely write it yourself.',
  ],
  [
    'Operators',
    'Matching supports fzf operators: \u2019exact, ^prefix, suffix$, !exclude, a | b (or). Matching is smart-case \u2014 an uppercase letter makes that term case-sensitive.',
  ],
  [
    'Escaping',
    'A literal that begins with a dot is written with an extra leading dot (..set is the text ".set"); a lone . is always the argument separator.',
  ],
];

const renderDefinitionList = (
  doc: Document,
  rows: ReadonlyArray<readonly [string, string]>,
): Element => {
  const list = doc.createElement('dl');
  for (const [term, detail] of rows) {
    const dt = doc.createElement('dt');
    const code = doc.createElement('code');
    code.textContent = term;
    dt.appendChild(code);
    const dd = doc.createElement('dd');
    dd.textContent = detail;
    list.append(dt, dd);
  }
  return list;
};

const renderSetup = (doc: Document, pageUrl: string): Element => {
  const wrap = doc.createElement('div');

  const intro = doc.createElement('p');
  intro.textContent =
    'Add Thither as a browser search shortcut, using either of these URL templates:';

  const [query, fragment] = shortcutTemplates(pageUrl);
  const templates = doc.createElement('dl');
  for (const [template, note] of [
    [query, 'default'],
    [fragment, 'keeps the input out of request logs'],
  ] as const) {
    const dt = doc.createElement('dt');
    const code = doc.createElement('code');
    code.textContent = template;
    dt.appendChild(code);
    const dd = doc.createElement('dd');
    dd.textContent = note;
    templates.append(dt, dd);
  }

  const then = doc.createElement('p');
  then.textContent = 'Then set your first target:';

  const example = doc.createElement('pre');
  const exampleCode = doc.createElement('code');
  exampleCode.textContent = EXAMPLE_SET_PROGRAM;
  example.appendChild(exampleCode);

  wrap.append(intro, templates, then, example);
  return wrap;
};

const section = (doc: Document, heading: string, body: Element): Element => {
  const wrap = doc.createElement('section');
  const h3 = doc.createElement('h3');
  h3.textContent = heading;
  wrap.append(h3, body);
  return wrap;
};

export const createHelpDialog = (doc: Document): HelpDialog => {
  const dialog = doc.createElement('dialog');
  dialog.className = 'help';

  const title = doc.createElement('h2');
  title.textContent = 'Thither \u2014 help';

  const close = doc.createElement('button');
  close.type = 'button';
  close.className = 'close';
  close.textContent = 'Close';
  close.addEventListener('click', () => dialog.close());

  const header = doc.createElement('header');
  header.append(title, close);

  const body = doc.createElement('div');
  body.className = 'help-body';

  const setupRegion = doc.createElement('section');

  const render = (pageUrl: string): void => {
    const h3 = doc.createElement('h3');
    h3.textContent = 'Setup';
    setupRegion.replaceChildren(h3, renderSetup(doc, pageUrl));
  };

  body.append(
    section(doc, 'Usage', renderDefinitionList(doc, USAGE)),
    section(doc, 'Basic rules', renderDefinitionList(doc, RULES)),
    setupRegion,
  );

  dialog.append(header, body);

  return {
    element: dialog,
    open: (pageUrl: string): void => {
      render(pageUrl);
      dialog.showModal();
    },
  };
};

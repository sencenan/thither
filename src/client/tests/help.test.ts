// @vitest-environment happy-dom

// browser-client.md "Fallback UI and settings" — the Help modal: an always-available reference
// with Usage, Basic rules, and Setup sections; the Setup section carries this page's two search
// shortcut templates. Display only.

import { beforeEach, describe, expect, it } from 'vitest';
import { createHelpDialog } from '../help.ts';

let root: HTMLElement;

beforeEach(() => {
  document.body.innerHTML = '<div id="app"></div>';
  const app = document.querySelector('#app');
  if (!(app instanceof HTMLElement)) {
    throw new Error('missing #app');
  }
  root = app;
});

const headings = (dialog: HTMLDialogElement): string[] =>
  [...dialog.querySelectorAll('h3')].map((h) => h.textContent ?? '');

describe('createHelpDialog', () => {
  it('opens as a modal with Usage, Basic rules, and Setup sections', () => {
    const help = createHelpDialog(document);
    root.appendChild(help.element);
    expect(help.element.open).toBe(false);

    help.open('https://host.example/thither/');

    expect(help.element.open).toBe(true);
    expect(headings(help.element)).toEqual(['Usage', 'Basic rules', 'Setup']);
  });

  it('lists each of the four operations in the rules', () => {
    const help = createHelpDialog(document);
    root.appendChild(help.element);
    help.open('https://host.example/thither/');

    const rules = help.element.textContent ?? '';
    for (const op of ['.set', '.rm', '.@', '.$']) {
      expect(rules).toContain(op);
    }
  });

  it('the Setup section shows both shortcut templates for the current page URL', () => {
    const help = createHelpDialog(document);
    root.appendChild(help.element);

    help.open('https://host.example/thither/?q=old#frag');

    const codes = [...help.element.querySelectorAll('code')].map((c) => c.textContent ?? '');
    expect(codes).toContain('https://host.example/thither/?q=%s');
    expect(codes).toContain('https://host.example/thither/#q=%s');
  });

  it('re-renders the templates from the page URL given at each open', () => {
    const help = createHelpDialog(document);
    root.appendChild(help.element);

    help.open('https://one.example/');
    help.element.close();
    help.open('https://two.example/');

    const codes = [...help.element.querySelectorAll('code')].map((c) => c.textContent ?? '');
    expect(codes).toContain('https://two.example/?q=%s');
    expect(codes).not.toContain('https://one.example/?q=%s');
  });

  it('Close closes the dialog', () => {
    const help = createHelpDialog(document);
    root.appendChild(help.element);
    help.open('https://host.example/');

    const close = help.element.querySelector('.close');
    if (!(close instanceof HTMLButtonElement)) {
      throw new Error('no close button');
    }
    close.click();

    expect(help.element.open).toBe(false);
  });
});

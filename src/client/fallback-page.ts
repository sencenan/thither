// browser-client.md "Fallback UI and settings" — the page shown when the page-load run did not
// navigate: the text field seeded with that run's input, live execution of a plain search on a
// keystroke debounce, and the result list re-rendered from the register after each run. A
// nontrivial program (ADR 0015) never runs live: it waits, with no list, until Enter runs it, and
// a successful run puts the search it ended with back into the field. Nothing here consults the
// navigation rule; once the page is shown, navigation is by click, `Ctrl+digit`, or Enter on the
// selected row, and each of those is the row's own link being followed.

import type { Interpreter } from '../dsl/index.ts';
import { debounce } from '../lib/debounce.ts';
import type { BrowserEnv } from './browser-env.ts';
import { createHelpDialog } from './help.ts';
import { iconMarkup } from './icons.ts';
import { tokenize } from './input.ts';
import { moveSelection, selectedLink, shortcutLink } from './match-list.ts';
import { renderBareError, renderOutput, renderWaiting } from './output.ts';
import type { StorageArea } from './persistence.ts';
import { isNontrivial, searchTokens } from './program.ts';
import { renderProgram } from './program-view.ts';
import { compose, load, run } from './run.ts';
import { createSettingsDialog } from './settings.ts';

export const LIVE_EXECUTION_DEBOUNCE_MS = 60;

export interface FallbackPage {
  // Runs a pending debounce now, so the register reflects the field as typed; nothing pending,
  // nothing runs.
  flush(): void;
}

const isPrintable = (event: KeyboardEvent): boolean =>
  event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey;

const isEditable = (target: EventTarget | null): boolean =>
  target instanceof HTMLInputElement ||
  target instanceof HTMLTextAreaElement ||
  (target instanceof HTMLElement && target.isContentEditable);

export const mountFallbackPage = (
  root: Element,
  interp: Interpreter,
  env: BrowserEnv,
  storage: StorageArea,
  // The release tag the page was published from, shown in Settings; absent in dev and local builds.
  version?: string,
): FallbackPage => {
  const doc = root.ownerDocument;

  const field = doc.createElement('input');
  field.type = 'text';
  field.autocomplete = 'off';
  field.spellcheck = false;
  field.value = env.input.join(' ');

  const helpControl = doc.createElement('button');
  helpControl.type = 'button';
  helpControl.className = 'field-control help-control';
  helpControl.title = 'Help';
  helpControl.setAttribute('aria-label', 'Help');
  helpControl.innerHTML = iconMarkup('help');

  const settingsControl = doc.createElement('button');
  settingsControl.type = 'button';
  settingsControl.className = 'field-control settings-control';
  settingsControl.title = 'Settings';
  settingsControl.setAttribute('aria-label', 'Settings');
  settingsControl.innerHTML = iconMarkup('settings');

  const controls = doc.createElement('div');
  controls.className = 'controls';
  controls.append(helpControl, settingsControl);

  const fieldRow = doc.createElement('div');
  fieldRow.className = 'field';
  fieldRow.append(field, controls);

  // Lightweight text wordmark in the gap above the field: a terminal prompt chevron in the accent
  // colour, then the name. No asset, so it stays in the single-file bundle for free.
  const brand = doc.createElement('header');
  brand.className = 'brand';
  const brandMark = doc.createElement('span');
  brandMark.className = 'brand-mark';
  brandMark.textContent = '\u276f';
  const brandName = doc.createElement('span');
  brandName.className = 'brand-name';
  brandName.textContent = 'thither';
  const brandTag = doc.createElement('span');
  brandTag.className = 'brand-tag';
  brandTag.textContent = '\u2014 to that place';
  brand.append(brandMark, brandName, brandTag);

  const output = doc.createElement('div');
  output.className = 'output';

  // ADR 0015 — true while the field holds a nontrivial program that has not run since it was
  // edited. main.ts never runs one at page load, so a seeded nontrivial program starts waiting.
  let waiting = isNontrivial(interp, tokenize(field.value));

  const render = (): void => {
    if (waiting) {
      renderWaiting(output, env, renderProgram(doc, interp, compose(tokenize(field.value))));
    } else {
      renderOutput(output, env);
    }
  };

  // A run throws only when localStorage itself has gone; that ends the page, as at load.
  const guarded = (step: () => void): void => {
    try {
      step();
      render();
    } catch (error: unknown) {
      renderBareError(root, error);
    }
  };

  const runField = (): void => {
    guarded(() => {
      run(interp, tokenize(field.value));
    });
  };

  // Enter on a waiting program runs it. A run that searched leaves the field holding that search
  // (dsl.md §4.4: inputs, then the separator and args), so the field and the list agree; a run
  // that failed keeps the program as typed, beside its error, so it can be corrected.
  const runWaiting = (): void => {
    guarded(() => {
      waiting = false;
      run(interp, tokenize(field.value));
      if (env.terminal?.[0] === 'R') {
        field.value = searchTokens(env.terminal).join(' ');
      }
    });
  };

  // What a settings action re-runs: the field when it is a plain search, otherwise only the
  // stored world, so a waiting program still waits for Enter.
  const refresh = (): void => {
    if (waiting) {
      guarded(() => {
        load(interp);
      });
    } else {
      runField();
    }
  };

  const liveRun = debounce(runField, LIVE_EXECUTION_DEBOUNCE_MS);

  field.addEventListener('input', () => {
    waiting = isNontrivial(interp, tokenize(field.value));
    if (waiting) {
      liveRun.cancel();
      render();
    } else {
      liveRun.schedule();
    }
  });

  // browser-client.md "Fallback UI and settings" — after an action the dialog has closed and the
  // page re-runs the field's contents, so the list reflects the new current stack.
  const settings = createSettingsDialog(doc, interp, storage, refresh, version);
  settingsControl.addEventListener('click', () => {
    settings.open();
  });
  settings.element.addEventListener('close', () => {
    field.focus();
  });

  const help = createHelpDialog(doc);
  helpControl.addEventListener('click', () => {
    help.open(location.href);
  });
  help.element.addEventListener('close', () => {
    field.focus();
  });

  // One listener on the document, so the shortcuts work whether or not the field has focus. It
  // outlives the page once `renderBareError` has replaced it, so a detached field releases the
  // keyboard; while the settings dialog is open the keyboard is the dialog's. Focus moves during
  // keydown, so the browser inserts the character into the field.
  doc.addEventListener('keydown', (event) => {
    if (!field.isConnected || settings.element.open || help.element.open) {
      return;
    }

    // A waiting program has no rows: the row shortcuts, the arrows, and Enter-to-open are off.
    const shortcut = waiting ? undefined : shortcutLink(output, event);
    if (shortcut !== undefined) {
      event.preventDefault();
      shortcut.click();
      return;
    }

    // Escape resets the query: clear the field, refocus it, and re-run. The dialog guard above
    // means a native Escape still closes the Settings dialog rather than clearing the field.
    if (event.key === 'Escape') {
      event.preventDefault();
      field.value = '';
      field.focus();
      waiting = false;
      runField();
      return;
    }

    // Tab is blocked so focus never lands on a row link, where Enter would mean a different row
    // from the selected one. Inside an open dialog the guard above has already let it through.
    if (event.key === 'Tab') {
      event.preventDefault();
      return;
    }

    // The arrows move the selection over the rows already listed; they never touch the debounce,
    // since they do not change the search. A run that lands afterwards resets the selection.
    if (
      !waiting &&
      (event.key === 'ArrowDown' || event.key === 'ArrowUp') &&
      !event.shiftKey &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey &&
      (event.target === field || !isEditable(event.target))
    ) {
      event.preventDefault();
      moveSelection(output, event.key === 'ArrowDown' ? 1 : -1);
      return;
    }

    // The flush may re-render, which resets the selection to the new list's default: the first row
    // when the run searched a query (ADR 0009), otherwise none.
    if (event.key === 'Enter' && (event.target === field || !isEditable(event.target))) {
      event.preventDefault();
      if (waiting) {
        runWaiting();
        return;
      }
      liveRun.flush();
      selectedLink(output)?.click();
      return;
    }

    if (isPrintable(event) && !isEditable(event.target)) {
      field.focus();
    }
  });

  root.replaceChildren(brand, fieldRow, output, settings.element, help.element);
  render();

  field.focus();
  field.setSelectionRange(field.value.length, field.value.length);

  return { flush: liveRun.flush };
};

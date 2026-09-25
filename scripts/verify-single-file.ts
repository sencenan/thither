// ADR-0002 / browser-client.md "Source, build, and deployment": the release artifact is a
// single self-contained index.html. "Single-file" is about *deployment* — exactly one file to
// publish, with the app's own JS/CSS inlined — not about runtime isolation. Thither is a
// network-facing tool (it redirects to other sites), so the loaded page may reasonably fetch
// external resources it can expect to exist: public fonts, fonticons, CDN assets. The invariant
// this enforces is therefore: dist/ holds only index.html, and index.html references no *local*
// asset (a relative or root-relative src/href), because such a file would be missing once only
// index.html is deployed and would break file:// portability. Absolute and protocol-relative
// URLs (https://…, //…) are runtime resources and pass. Installing vite-plugin-singlefile does
// not by itself guarantee even the local-asset part — browser-client.md warns that arbitrary
// assets (e.g. Vite's public/ dir) are not inlined automatically — so the build must *verify* it
// and fail if it regresses. The pure helpers here are exercised by
// scripts/tests/verify-single-file.test.ts; verifySingleFilePlugin() wires them into `vite build`
// via closeBundle.
//
// Note: this cannot tell a CDN font from a CDN-loaded runtime library, so browser-client.md's
// "bundle runtime libraries rather than load from a CDN" rule stays a review discipline, not
// something this check holds.

import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import type { Plugin } from 'vite';

/**
 * True when a ref names a scheme (`https:`, `mailto:`, `data:`, …) or is protocol-relative
 * (`//host/…`). Such refs are runtime resources the loaded page may fetch — a public font, a CDN
 * icon set — and are allowed. Everything else is a local path the deploy would leave behind.
 */
function isExternalRef(ref: string): boolean {
  return ref.startsWith('//') || /^[a-z][a-z0-9+.-]*:/i.test(ref);
}

/**
 * Local asset references in a built HTML document: any <script src> or <link href> pointing at a
 * relative or root-relative path (`./chunk.js`, `../x`, `/style.css`, `chunk.js`). These are the
 * app's own JS/CSS emitted as separate files — exactly what single-file deployment must not
 * produce, and what breaks file:// portability. Absolute and protocol-relative URLs pass.
 */
export function findLocalAssetReferences(html: string): string[] {
  const refs: string[] = [];
  const patterns: RegExp[] = [
    /<script\b[^>]*\bsrc\s*=\s*["']?([^"'>\s]+)/gi,
    /<link\b[^>]*\bhref\s*=\s*["']?([^"'>\s]+)/gi,
  ];
  for (const pattern of patterns) {
    for (const match of html.matchAll(pattern)) {
      const ref = match[1];
      if (ref !== undefined && !isExternalRef(ref)) {
        refs.push(ref);
      }
    }
  }
  return refs;
}

/** Every file under dir, as paths relative to dir (POSIX-ish separators from join). */
function listFiles(dir: string): string[] {
  const out: string[] = [];
  const walk = (current: string): void => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else {
        out.push(full);
      }
    }
  };
  walk(dir);
  return out.map((full) => relative(dir, full));
}

/**
 * Inspect a built output directory. Returns a list of human-readable problems; an empty list
 * means the output deploys as a single index.html. Never throws for a normal directory —
 * the caller decides whether problems should fail the build.
 */
export function verifyDist(distDir: string): string[] {
  const problems: string[] = [];

  const files = listFiles(distDir).sort();
  const extras = files.filter((f) => f !== 'index.html');
  if (!files.includes('index.html')) {
    problems.push(`no index.html in ${distDir}`);
  }
  if (extras.length > 0) {
    problems.push(
      `deployable output must contain only index.html, but also found: ${extras.join(', ')}`,
    );
  }

  if (files.includes('index.html')) {
    const html = readFileSync(join(distDir, 'index.html'), 'utf8');
    const local = findLocalAssetReferences(html);
    if (local.length > 0) {
      problems.push(
        `index.html references local assets that would not be deployed: ${local.join(', ')}`,
      );
    }
  }

  return problems;
}

/** Vite plugin that fails `vite build` when the emitted output is not a single self-contained file. */
export function verifySingleFilePlugin(distDir: string): Plugin {
  return {
    name: 'verify-single-file',
    // closeBundle runs after everything (including vite-plugin-singlefile) has been written.
    closeBundle() {
      const problems = verifyDist(distDir);
      if (problems.length > 0) {
        throw new Error(
          `single-file verification failed:\n  - ${problems.join('\n  - ')}\n` +
            'ADR-0002 requires the build to emit exactly one self-contained index.html.',
        );
      }
    },
  };
}

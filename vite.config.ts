import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { verifySingleFilePlugin } from './scripts/verify-single-file.ts';

// ADR-0002 — the release artifact is one self-contained index.html.
// Ticket 21 adds the check that the output really is single-file.
const distDir = fileURLToPath(new URL('./dist', import.meta.url));

// ADR-0004 — a published page is a tag build: deploy.yml passes the tag as THITHER_VERSION, and
// the settings modal shows it beside its title. Dev servers and local builds leave it unset, so they
// show no version rather than a stale or made-up one.
const version = process.env.THITHER_VERSION?.trim() || null;

export default defineConfig({
  // index.html lives with the client it bootstraps. outDir is relative to
  // root, so point it back at the repo-level dist/.
  root: 'src/client',
  base: './',
  // No public/ directory: the single-file plugin would not inline it anyway.
  publicDir: false,
  // Replaced textually at build time; main.ts declares the global.
  define: { __THITHER_VERSION__: JSON.stringify(version) },
  // viteSingleFile inlines JS/CSS; verifySingleFilePlugin then proves it and fails the build
  // if any external asset survives or an extra file lands in dist/.
  plugins: [viteSingleFile(), verifySingleFilePlugin(distDir)],
  build: {
    outDir: '../../dist',
    emptyOutDir: true,
    target: 'es2022',
    assetsInlineLimit: Number.POSITIVE_INFINITY,
    cssCodeSplit: false,
  },
});

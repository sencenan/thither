import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// ADR-0002 — the release artifact is one self-contained index.html.
// Ticket 21 adds the check that the output really is single-file.
export default defineConfig({
  // index.html lives with the client it bootstraps. outDir is relative to
  // root, so point it back at the repo-level dist/.
  root: 'src/client',
  base: './',
  // No public/ directory: the single-file plugin would not inline it anyway.
  publicDir: false,
  plugins: [viteSingleFile()],
  build: {
    outDir: '../../dist',
    emptyOutDir: true,
    target: 'es2022',
    assetsInlineLimit: Number.POSITIVE_INFINITY,
    cssCodeSplit: false,
  },
});

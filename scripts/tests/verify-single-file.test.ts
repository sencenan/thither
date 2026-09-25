// Proves single-file verification catches a regression, per ticket 21: the build must fail on a
// deliberately externalized asset, not merely assume the plugin inlined everything.

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { findLocalAssetReferences, verifyDist } from '../verify-single-file.ts';

const INLINE_HTML = `<!doctype html><html><head><title>Thither</title></head>
<body><div id="app"></div><script type="module">console.log("inlined")</script></body></html>`;

describe('findLocalAssetReferences', () => {
  it('accepts a fully inlined document', () => {
    expect(findLocalAssetReferences(INLINE_HTML)).toEqual([]);
  });

  it('accepts data: URIs (inlined icon)', () => {
    const html = '<link rel="icon" href="data:image/png;base64,AAAA" />';
    expect(findLocalAssetReferences(html)).toEqual([]);
  });

  it('accepts a public font over https (runtime resource)', () => {
    const html = '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter" />';
    expect(findLocalAssetReferences(html)).toEqual([]);
  });

  it('accepts a protocol-relative CDN reference', () => {
    const html = '<link rel="stylesheet" href="//cdn.example.com/icons.css" />';
    expect(findLocalAssetReferences(html)).toEqual([]);
  });

  it('flags a local <script src> (relative)', () => {
    const html = '<script type="module" src="./index-abc.js"></script>';
    expect(findLocalAssetReferences(html)).toEqual(['./index-abc.js']);
  });

  it('flags a local stylesheet <link href> (root-relative)', () => {
    const html = '<link rel="stylesheet" href="/style.css" />';
    expect(findLocalAssetReferences(html)).toEqual(['/style.css']);
  });
});

describe('verifyDist', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'thither-dist-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('passes for a single self-contained index.html', () => {
    writeFileSync(join(dir, 'index.html'), INLINE_HTML);
    expect(verifyDist(dir)).toEqual([]);
  });

  it('passes for an inlined page that references an external font', () => {
    writeFileSync(
      join(dir, 'index.html'),
      `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter" />${INLINE_HTML}`,
    );
    expect(verifyDist(dir)).toEqual([]);
  });

  it('fails when a local asset survives inlining', () => {
    writeFileSync(join(dir, 'index.html'), '<script type="module" src="./index-abc.js"></script>');
    const problems = verifyDist(dir);
    expect(problems.some((p) => p.includes('local assets'))).toBe(true);
  });

  it('fails when an extra deployable file lands in dist/', () => {
    writeFileSync(join(dir, 'index.html'), INLINE_HTML);
    writeFileSync(join(dir, 'index-abc.js'), 'console.log("leaked")');
    const problems = verifyDist(dir);
    expect(problems.some((p) => p.includes('only index.html'))).toBe(true);
  });

  it('fails when index.html is missing', () => {
    writeFileSync(join(dir, 'stray.txt'), 'nope');
    const problems = verifyDist(dir);
    expect(problems.some((p) => p.includes('no index.html'))).toBe(true);
  });
});

/**
 * Import direction, per docs/code-standards.md "Layout":
 *   client -> dsl, client -> lib, dsl -> lib; lib imports neither.
 *   Root files are an area's public surface; lib/, tests/, and the core's
 *   operations/ are internal.
 *   src/dsl has exactly one entry point, index.ts.
 *
 * dependency-cruiser cannot use typescript@7 yet (it accepts >=2 <7), so
 * @swc/core is its parser instead. swc keeps `import type` statements in the
 * AST, so type-only edges are still cruised. The tsConfig and
 * tsPreCompilationDeps options are deliberately absent: both are inert without
 * a usable tsc, and setting them only triggers dependency-cruiser's
 * missing-typescript-transpiler warning. Revisit when dependency-cruiser
 * supports typescript@7, or if this repo grows tsconfig path aliases.
 */
module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'error',
      comment: 'A cycle means the seam is in the wrong place.',
      from: {},
      to: { circular: true },
    },
    {
      name: 'core-imports-no-client',
      severity: 'error',
      comment: 'ADR-0001: the language core is client-agnostic.',
      from: { path: '^src/dsl/' },
      to: { path: '^src/client/' },
    },
    {
      name: 'lib-imports-nothing-local',
      severity: 'error',
      comment: 'src/lib knows about neither the core nor the client.',
      from: { path: '^src/lib/' },
      to: { path: '^src/(dsl|client)/' },
    },
    {
      name: 'dsl-entry-point-only',
      severity: 'error',
      comment: 'Outside the core, import it through src/dsl/index.ts only.',
      from: { path: '^src/(client|lib)/' },
      to: { path: '^src/dsl/', pathNot: '^src/dsl/index\\.ts$' },
    },
    {
      name: 'area-internals-are-private',
      severity: 'error',
      comment:
        "An area's lib/, tests/, and operations/ folders are not importable from another area.",
      from: { path: '^src/([^/]+)/' },
      to: { path: '^src/[^/]+/(lib|tests|operations)/', pathNot: '^src/$1/' },
    },
    {
      name: 'no-orphans',
      severity: 'warn',
      comment: 'An unimported, non-entry module is usually a leftover.',
      from: {
        orphan: true,
        pathNot: ['^src/client/main\\.ts$', '^src/dsl/index\\.ts$', '\\.d\\.ts$'],
      },
      to: {},
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    includeOnly: '^src/',
    parser: 'swc',
    enhancedResolveOptions: {
      extensions: ['.ts', '.js'],
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default'],
    },
    reporterOptions: {
      text: { highlightFocused: true },
    },
  },
};

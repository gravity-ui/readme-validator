// Public API for @gravity-ui/readme-validator.
//
// Two regimes over one Markdown-AST pass (see `readme-ast.ts`):
//   - parse*   — read-only extraction for llms.txt generators; never throws.
//   - validate* — contract enforcement for CI; returns errors/warnings.
export { extractMeta, parseComponentReadme, parsePackageReadme } from './readme-parse.js';
export { validateComponentReadme, validatePackageReadme } from './readme-validate.js';

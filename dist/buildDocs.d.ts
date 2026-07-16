export type DocsSourceKind = 'readme' | 'markdown';
export interface DocsSource {
    /** Section heading in the generated INDEX.md. */
    title: string;
    /** `readme` walks for README.md files; `markdown` takes every *.md. */
    kind: DocsSourceKind;
    /** Source directory, relative to `rootDir`. */
    baseDir: string;
    /** Output subdirectory under `outDir`. */
    outPrefix: string;
    /** Directory names to skip (in addition to story/test folders). */
    exclude?: string[];
    /** Name the index entry by the doc's heading instead of its path. */
    nameFromTitle?: boolean;
}
export interface DocsConfig {
    /** Repo root. Defaults to `process.cwd()`. */
    rootDir?: string;
    /** Directory to (re)generate. */
    outDir: string;
    /** Shown in the generated INDEX.md header. Defaults to `rootDir`'s package name. */
    packageName?: string;
    /** Doc sources; INDEX sections follow this order. */
    sources: DocsSource[];
}
export interface DocsIndexEntry {
    name: string;
    rel: string;
    summary: string;
}
export interface DocsSection {
    title: string;
    entries: DocsIndexEntry[];
}
export interface BuildDocsResult {
    sections: DocsSection[];
    total: number;
}
/**
 * Builds the config for the layout shared by gravity-ui packages: component and
 * hook READMEs plus any markdown under the repo-level docs/ folder. `legacy/` and
 * an empty docs/ are both harmless when a package lacks them, so the same config
 * drives every package (uikit, navigation, …).
 *
 * @param rootDir repo root; defaults to `process.cwd()`.
 * @param packageName INDEX.md header name; defaults to `rootDir`'s package name.
 * @returns the docs config to pass to {@link buildDocs}.
 */
export declare function createDefaultDocsConfig(rootDir?: string, packageName?: string): DocsConfig;
/**
 * Builds a package's docs output for AI agents from its markdown sources. The
 * output ships inside the npm tarball so an agent working in a consumer project
 * reads documentation matching the installed version.
 *
 * The package README's `For AI agents` section (if present) is cleaned and placed
 * at the top of the generated `INDEX.md`, and a `Documentation for AI agents`
 * pointer section is appended to that README (once) linking to the generated tree.
 *
 * @param config docs config; defaults to {@link createDefaultDocsConfig}().
 * @returns the generated sections and the total document count.
 */
export declare function buildDocs(config?: DocsConfig): BuildDocsResult;

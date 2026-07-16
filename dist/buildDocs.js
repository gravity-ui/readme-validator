import * as fs from 'node:fs';
import * as path from 'node:path';
import { parseComponentReadme, parsePackageReadme } from './readme-parse.js';
import { cleanMarkdown } from './cleanMarkdown.js';
// Story/test folders hold Storybook doc pages and fixtures, not API docs.
const DEFAULT_EXCLUDE = ['__stories__', '__tests__', '__mocks__', '__snapshots__'];
// Headings under which the package README's parsed sections are surfaced at the
// top of INDEX.md (canonical labels; readme-validator matches heading aliases).
const README_AI_SECTION = 'For AI agents';
const README_INSTALL_SECTION = 'Install';
const README_USAGE_SECTION = 'Usage';
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
export function createDefaultDocsConfig(rootDir = process.cwd(), packageName) {
    return {
        rootDir,
        packageName: packageName ?? readPackageName(rootDir),
        outDir: path.join(rootDir, 'build', 'docs'),
        sources: [
            {
                title: 'Guides',
                kind: 'markdown',
                baseDir: 'docs',
                outPrefix: 'guides',
                nameFromTitle: true,
            },
            {
                title: 'Components',
                kind: 'readme',
                baseDir: 'src/components',
                outPrefix: 'components',
                exclude: ['legacy'],
            },
            {
                title: 'Hooks',
                kind: 'readme',
                baseDir: 'src/hooks',
                outPrefix: 'hooks',
                exclude: ['private'],
            },
        ],
    };
}
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
export function buildDocs(config = createDefaultDocsConfig()) {
    const { outDir, sources } = config;
    const rootDir = config.rootDir ?? process.cwd();
    const packageName = config.packageName ?? readPackageName(rootDir);
    fs.rmSync(outDir, { recursive: true, force: true });
    // Resolve every source's items first, so links between docs can be rewritten
    // in the second pass regardless of processing order. README docs are also
    // keyed by their folder, so bare-folder links (`../Portal`) resolve too.
    const listed = sources.map(source => ({ source, items: listSource(rootDir, source) }));
    const docMap = new Map();
    for (const { source, items } of listed) {
        for (const item of items) {
            docMap.set(item.source, item.outRel);
            if (source.kind === 'readme') {
                docMap.set(path.dirname(item.source), item.outRel);
            }
        }
    }
    const sections = [];
    for (const { source, items } of listed) {
        const entries = [];
        for (const { source: file, name, outRel } of items) {
            // Title/summary come from readme-validator's AST parse of the source;
            // the shipped doc body is the same source run through cleanMarkdown.
            const raw = fs.readFileSync(file, 'utf8');
            const parsed = parseComponentReadme(raw);
            const cleaned = rewriteDocLinks(cleanMarkdown(raw), file, outRel, docMap);
            writeDoc(path.join(outDir, outRel), cleaned);
            entries.push({
                name: source.nameFromTitle ? parsed.title || name : name,
                rel: outRel,
                summary: collapseWhitespace(parsed.description ?? ''),
            });
        }
        sections.push({ title: source.title, entries });
    }
    const outRelToRoot = path.relative(rootDir, outDir).split(path.sep).join('/');
    const readmePath = path.join(rootDir, 'README.md');
    // Rewrite the overview's links too: README prose (Useful docs, Usage, …)
    // references docs by their repo path, but they were copied/flattened into
    // outDir. INDEX.md sits at the outDir root, so outRel is empty.
    const overview = rewriteDocLinks(readPackageOverview(readmePath), readmePath, '', docMap);
    writeDoc(path.join(outDir, 'INDEX.md'), renderIndex(packageName, outRelToRoot, sections, overview));
    const total = sections.reduce((sum, section) => sum + section.entries.length, 0);
    return { sections, total };
}
// Recursively collects README.md files under `dir`, skipping excluded segments.
function findReadmes(dir, exclude = []) {
    if (!fs.existsSync(dir)) {
        return [];
    }
    const skip = new Set([...DEFAULT_EXCLUDE, ...exclude]);
    const result = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (skip.has(entry.name)) {
                continue;
            }
            result.push(...findReadmes(fullPath, exclude));
        }
        else if (/^readme\.md$/i.test(entry.name)) {
            // Case-insensitive: some packages use `Readme.md` (e.g. navigation).
            result.push(fullPath);
        }
    }
    return result;
}
// Recursively collects *.md files under `dir`.
function findMarkdown(dir) {
    if (!fs.existsSync(dir)) {
        return [];
    }
    const result = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            result.push(...findMarkdown(fullPath));
        }
        else if (entry.name.endsWith('.md')) {
            result.push(fullPath);
        }
    }
    return result;
}
function readPackageName(rootDir) {
    const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
    return pkg.name ?? '';
}
function writeDoc(outPath, content) {
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, content);
}
// Lists a source's docs as items, mirroring the source folder layout so nested
// groups never collide (e.g. src/components/controls/TextInput/README.md →
// components/controls/TextInput.md, docs/theming.md → guides/theming.md).
function listSource(rootDir, { kind, baseDir, outPrefix, exclude }) {
    const absBase = path.join(rootDir, baseDir);
    if (kind === 'readme') {
        return (findReadmes(absBase, exclude)
            .map(source => {
            const name = path
                .relative(absBase, path.dirname(source))
                .split(path.sep)
                .join('/');
            return { source, name, outRel: path.posix.join(outPrefix, `${name}.md`) };
        })
            // Skip a README sitting directly at baseDir (empty name → blank entry).
            .filter(item => item.name !== ''));
    }
    return findMarkdown(absBase).map(source => {
        const rel = path.relative(absBase, source).split(path.sep).join('/');
        return { source, name: rel.replace(/\.md$/, ''), outRel: path.posix.join(outPrefix, rel) };
    });
}
// Rewrites repo-relative links so they resolve inside the docs output. A link to
// another shipped doc — by README path (../Popup/README.md) or by its folder
// (../Popup) — is recomputed relative to the current output file. Any other
// repo-relative link (a source file, an unshipped doc like legacy/) is unwrapped
// to plain text so no dead link remains. External URLs (http:, mailto:, …) and
// in-page anchors are left untouched.
function rewriteDocLinks(markdown, source, outRel, docMap) {
    return markdown.replace(/\[([^\]]*)\]\(([^)]+)\)/g, (whole, text, target) => {
        if (/^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith('#')) {
            return whole;
        }
        const hashIndex = target.indexOf('#');
        const relPath = hashIndex === -1 ? target : target.slice(0, hashIndex);
        const anchor = hashIndex === -1 ? '' : target.slice(hashIndex);
        // Resolve either a direct doc path or a bare folder to its shipped output.
        const absTarget = path.resolve(path.dirname(source), relPath);
        const targetOut = docMap.get(absTarget);
        if (!targetOut) {
            return text; // not a shipped doc — drop the link, keep its text
        }
        let relOut = path.posix.relative(path.posix.dirname(outRel), targetOut);
        if (!relOut.startsWith('.')) {
            relOut = `./${relOut}`;
        }
        return `[${text}](${relOut}${anchor})`;
    });
}
function renderSection(title, entries) {
    if (!entries.length) {
        return '';
    }
    const rows = entries
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(({ name, rel, summary }) => `- [${name}](./${rel})${summary ? ` — ${summary}` : ''}`)
        .join('\n');
    return `## ${title}\n\n${rows}\n`;
}
function renderIndex(packageName, outRelToRoot, sections, overview) {
    // e.g. node_modules/@gravity-ui/uikit/build/docs
    const installedPath = path.posix.join('node_modules', packageName, outRelToRoot);
    const header = [
        `# ${packageName} documentation`,
        '',
        `Documentation for the **installed** version of \`${packageName}\`.`,
        'Your training data may be outdated — these files are the source of truth.',
        '',
        `Paths are relative to this file (\`${installedPath}/\`).`,
        '',
    ].join('\n');
    return [header, overview, ...sections.map(({ title, entries }) => renderSection(title, entries))]
        .filter(Boolean)
        .join('\n');
}
// Parses the package README with readme-validator and renders its agent-facing
// overview (positioning + When to use/not/pitfalls) plus the Install and Usage
// sections, so they lead the generated INDEX. Each field is null when its source
// section is absent, so a README that has adopted only part of the template
// degrades section-by-section. Empty string when nothing is present — the INDEX
// just omits the overview.
function readPackageOverview(readmePath) {
    if (!fs.existsSync(readmePath)) {
        return '';
    }
    const { agentPositioning, agentProse, install, usage } = parsePackageReadme(fs.readFileSync(readmePath, 'utf8'));
    const parts = [];
    // agentProse already carries its own `###` subheadings (When to use, …).
    if (agentPositioning || agentProse) {
        parts.push(`## ${README_AI_SECTION}`);
        if (agentPositioning) {
            parts.push(agentPositioning);
        }
        if (agentProse) {
            parts.push(agentProse);
        }
    }
    if (install) {
        parts.push(`## ${README_INSTALL_SECTION}`, install);
    }
    if (usage) {
        parts.push(`## ${README_USAGE_SECTION}`, usage);
    }
    if (parts.length === 0) {
        return '';
    }
    // Keep cleanMarkdown's trailing newline so the INDEX join leaves a blank line
    // before the first doc section.
    return cleanMarkdown(parts.join('\n\n'));
}
// Collapses internal whitespace so a multi-line description paragraph stays on a
// single INDEX.md list line.
function collapseWhitespace(text) {
    return text.replace(/\s+/g, ' ').trim();
}

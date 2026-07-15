// Shared AST layer for the LLM-ready README template. Internal: the public
// entry points are `readme-parse.ts` (read-only extraction) and
// `readme-validate.ts` (contract enforcement), both built on this.
//
// Parsing is done on a real Markdown AST (remark/mdast), not regexes: headings,
// links, images and HTML comments are proper nodes, and node `position` offsets
// let us slice the original source verbatim.
import { toString } from 'mdast-util-to-string';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import { unified } from 'unified';
const processor = unified().use(remarkParse).use(remarkGfm);
export const parse = (content) => processor.parse(content);
// The agent-facing block opens at `## For AI agents` and runs to the next `##`
// (or the end of file). Positioning is its lead paragraph, before the first `###`.
export const AGENT_HEADING = 'For AI agents';
// Required top-level sections the generator inlines into the package llms.txt.
// Each entry is a set of accepted heading aliases.
export const INSTALL_HEADINGS = ['Install', 'Installation'];
export const USAGE_HEADINGS = ['Usage', 'Getting started', 'Quick start'];
export const LICENSE_HEADING = 'License';
// Recommended, not required. Peer dependencies are generated from package.json
// by the pipeline; required setup lives in the standard Usage section.
export const RECOMMENDED_HEADINGS = ['When to use', 'When not to use', 'Common pitfalls'];
export const SERVICE_MARKERS = ['<!--SANDBOX-->', '<!--GITHUB_BLOCK-->', '<!--/GITHUB_BLOCK-->'];
// Section-name comparison is case-insensitive: `## Getting Started` and
// `## getting started` match the same alias.
export const headingKey = (text) => text.trim().toLowerCase();
/** Case-insensitive membership of a heading's text in a set of accepted aliases. */
export const matchesHeading = (text, names) => names.some(n => headingKey(n) === headingKey(text));
const isAgentHeading = (node) => node.type === 'heading' && node.depth === 2 && matchesHeading(toString(node), [AGENT_HEADING]);
export const hasMainHeading = (main, names, depths = [2]) => main.some(n => n.type === 'heading' && depths.includes(n.depth) && matchesHeading(toString(n), names));
const sliceNodes = (content, nodes) => {
    const start = nodes[0]?.position?.start.offset;
    const end = nodes.at(-1)?.position?.end.offset;
    if (start === undefined || end === undefined)
        return '';
    return content.slice(start, end);
};
export const walk = (node, fn) => {
    fn(node);
    if ('children' in node) {
        for (const child of node.children)
            walk(child, fn);
    }
};
export const hasNodeOfType = (nodes, types) => {
    let found = false;
    const check = (n) => {
        if (types.includes(n.type))
            found = true;
    };
    for (const node of nodes) {
        if (found)
            break;
        walk(node, check);
    }
    return found;
};
/**
 * Parses the README once and locates the agent block, its lead (positioning)
 * nodes, and the raw text of both. Internal; `extractMeta` is the public view.
 */
export const analyze = (content) => {
    const main = parse(content).children;
    const agentHeadings = main.filter(isAgentHeading);
    if (agentHeadings.length === 0) {
        return { main, agent: null };
    }
    const startIdx = main.indexOf(agentHeadings[0]);
    const after = main.slice(startIdx + 1);
    const nextH2 = after.findIndex(n => n.type === 'heading' && n.depth <= 2);
    const blockNodes = nextH2 === -1 ? after : after.slice(0, nextH2);
    const firstSub = blockNodes.findIndex(n => n.type === 'heading' && n.depth >= 3);
    const leadNodes = firstSub === -1 ? blockNodes : blockNodes.slice(0, firstSub);
    const proseNodes = firstSub === -1 ? [] : blockNodes.slice(firstSub);
    return {
        main,
        agent: {
            headingCount: agentHeadings.length,
            blockNodes,
            leadNodes,
            block: sliceNodes(content, blockNodes),
            positioning: sliceNodes(content, leadNodes).trim() || null,
            prose: sliceNodes(content, proseNodes).trim() || null,
        },
    };
};
/**
 * Slices the verbatim body of a `## <heading>` (or, when `depths` allows it, a
 * `### <heading>`) section — from after the heading to the next heading of the
 * same or higher level (or EOF) — matching (case-insensitively) any accepted
 * alias. A `### Installation` nested under `## Getting Started` therefore yields
 * just its own body, not the rest of the parent section.
 *
 * Aliases are tried in priority order, not document order: given
 * `['Usage', 'Getting started']`, a `## Usage` section wins even if a
 * `## Getting Started` appears earlier. Returns null when no alias matches.
 */
export const sectionBody = (main, content, names, depths = [2]) => {
    for (const name of names) {
        const idx = main.findIndex(n => n.type === 'heading' &&
            depths.includes(n.depth) &&
            headingKey(toString(n)) === headingKey(name));
        if (idx === -1)
            continue;
        const depth = main[idx].depth;
        const after = main.slice(idx + 1);
        const nextSection = after.findIndex(n => n.type === 'heading' && n.depth <= depth);
        const bodyNodes = nextSection === -1 ? after : after.slice(0, nextSection);
        return sliceNodes(content, bodyNodes).trim() || null;
    }
    return null;
};
/**
 * Drops any subsection whose heading matches `exclude` (with all of its nested
 * content), returning the remaining nodes. Used to keep the focused
 * `### Installation` subsection out of the merged `usage` block.
 */
const dropSubsections = (nodes, exclude) => {
    const kept = [];
    let skipAboveDepth = null;
    for (const node of nodes) {
        if (skipAboveDepth !== null) {
            // Stay in skip mode until a heading climbs back to the excluded level or higher.
            if (node.type === 'heading' && node.depth <= skipAboveDepth) {
                skipAboveDepth = null;
            }
            else {
                continue;
            }
        }
        if (node.type === 'heading' && matchesHeading(toString(node), exclude)) {
            skipAboveDepth = node.depth;
            continue;
        }
        kept.push(node);
    }
    return kept;
};
/**
 * Like `sectionBody`, but concatenates the bodies of *every* section matching an
 * alias, in document order. Used for `usage`, where a `## Getting Started` guide
 * and a `## Usage` section should merge into one block (so prose that lives
 * outside the focused `### Installation` — e.g. prerequisites — is not lost).
 * Subsections matching `exclude` are dropped, so the install command that already
 * feeds the `install` field is not duplicated here.
 */
export const mergedSectionBodies = (main, content, names, depths = [2], exclude = []) => {
    const parts = [];
    main.forEach((node, idx) => {
        if (node.type !== 'heading' ||
            !depths.includes(node.depth) ||
            !matchesHeading(toString(node), names)) {
            return;
        }
        const after = main.slice(idx + 1);
        const nextSection = after.findIndex(n => n.type === 'heading' && n.depth <= node.depth);
        const bodyNodes = nextSection === -1 ? after : after.slice(0, nextSection);
        const kept = exclude.length ? dropSubsections(bodyNodes, exclude) : bodyNodes;
        // Slice each kept node verbatim and join, so a dropped subsection in the
        // middle doesn't drag its neighbours along with a single wide slice.
        for (const n of kept) {
            const body = sliceNodes(content, [n]).trim();
            if (body)
                parts.push(body);
        }
    });
    return parts.length ? parts.join('\n\n') : null;
};

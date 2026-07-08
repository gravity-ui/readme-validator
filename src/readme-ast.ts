// Shared AST layer for the LLM-ready README template. Internal: the public
// entry points are `readme-parse.ts` (read-only extraction) and
// `readme-validate.ts` (contract enforcement), both built on this.
//
// Parsing is done on a real Markdown AST (remark/mdast), not regexes: headings,
// links, images and HTML comments are proper nodes, and node `position` offsets
// let us slice the original source verbatim.

import type {Content, Root} from 'mdast';
import {toString} from 'mdast-util-to-string';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import {unified} from 'unified';

const processor = unified().use(remarkParse).use(remarkGfm);

export const parse = (content: string): Root => processor.parse(content) as Root;

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

export interface AgentBlock {
    headingCount: number;
    blockNodes: Content[];
    leadNodes: Content[];
    block: string;
    positioning: string | null;
    // The block's `###` sections (When to use / …) verbatim, positioning stripped.
    // Null when the block is positioning-only. This is what the package llms.txt inlines.
    prose: string | null;
}

export interface Analysis {
    main: Content[];
    agent: AgentBlock | null;
}

const isAgentHeading = (node: Content): boolean =>
    node.type === 'heading' && node.depth === 2 && toString(node).trim() === AGENT_HEADING;

export const hasMainHeading = (main: Content[], names: string[]): boolean =>
    main.some(n => n.type === 'heading' && n.depth === 2 && names.includes(toString(n).trim()));

const sliceNodes = (content: string, nodes: Content[]): string => {
    const start = nodes[0]?.position?.start.offset;
    const end = nodes.at(-1)?.position?.end.offset;
    if (start === undefined || end === undefined) return '';
    return content.slice(start, end);
};

export const walk = (node: Content, fn: (n: Content) => void): void => {
    fn(node);
    if ('children' in node) {
        for (const child of node.children as Content[]) walk(child, fn);
    }
};

export const hasNodeOfType = (nodes: Content[], types: string[]): boolean => {
    let found = false;
    const check = (n: Content): void => {
        if (types.includes(n.type)) found = true;
    };
    for (const node of nodes) {
        if (found) break;
        walk(node, check);
    }
    return found;
};

/**
 * Parses the README once and locates the agent block, its lead (positioning)
 * nodes, and the raw text of both. Internal; `extractMeta` is the public view.
 */
export const analyze = (content: string): Analysis => {
    const main = parse(content).children;

    const agentHeadings = main.filter(isAgentHeading);
    if (agentHeadings.length === 0) {
        return {main, agent: null};
    }

    const startIdx = main.indexOf(agentHeadings[0]!);
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
 * Slices the verbatim body of a top-level `## <heading>` section (from after the
 * heading to the next `##`/EOF), matching any of the accepted heading aliases.
 * Returns null when no matching heading is present.
 */
export const sectionBody = (main: Content[], content: string, names: string[]): string | null => {
    const idx = main.findIndex(
        n => n.type === 'heading' && n.depth === 2 && names.includes(toString(n).trim()),
    );
    if (idx === -1) return null;

    const after = main.slice(idx + 1);
    const nextH2 = after.findIndex(n => n.type === 'heading' && n.depth <= 2);
    const bodyNodes = nextH2 === -1 ? after : after.slice(0, nextH2);
    return sliceNodes(content, bodyNodes).trim() || null;
};

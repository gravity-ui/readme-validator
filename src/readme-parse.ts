// Read-only extraction from README files against the LLM-ready template.
// Intended for llms.txt generators to assemble the root catalog and per-package
// llms.txt. Never fails or judges — see `readme-validate.ts` for enforcement.

import {toString} from 'mdast-util-to-string';

import {analyze, INSTALL_HEADINGS, parse, sectionBody, USAGE_HEADINGS} from './readme-ast';

export interface MetaExtract {
    found: boolean;
    block: string | null;
    positioning: string | null;
}

/**
 * Everything `generate-llms.mjs` consumes from a package README, mirroring the
 * "What the generator consumes" table in docs/llm/readme-template.md.
 * Every field is null when its source section is absent, so the generator can
 * degrade gracefully (fall back to the catalog description, link the raw README).
 */
export interface PackageExtract {
    // Lead paragraph of `## For AI agents` → root catalog entry + top of package llms.txt.
    agentPositioning: string | null;
    // The block's `###` prose (When to use / not / pitfalls), positioning stripped → package llms.txt.
    agentProse: string | null;
    // Verbatim `## Install` / `## Installation` body → inlined into package llms.txt.
    install: string | null;
    // Verbatim `## Usage` / `## Getting started` / `## Quick start` body → inlined.
    usage: string | null;
}

export interface ComponentExtract {
    title: string | null;
    // First prose line after the title, taken verbatim into the component index.
    description: string | null;
}

/**
 * Extracts the agent-facing block and positioning sentence from a package README.
 * `block`/`positioning` are null when the section is absent.
 */
export const extractMeta = (content: string): MetaExtract => {
    const {agent} = analyze(content);
    if (!agent) {
        return {found: false, block: null, positioning: null};
    }
    return {found: true, block: agent.block, positioning: agent.positioning};
};

/**
 * Parses a package README into the structured extract the llms.txt generator
 * consumes. This is the read-only counterpart to `validatePackageReadme`: it
 * never fails or judges, it just returns what is present (null otherwise), so a
 * README that has not adopted the template yet degrades field-by-field.
 */
export const parsePackageReadme = (content: string): PackageExtract => {
    const {main, agent} = analyze(content);
    return {
        agentPositioning: agent?.positioning ?? null,
        agentProse: agent?.prose ?? null,
        install: sectionBody(main, content, INSTALL_HEADINGS),
        usage: sectionBody(main, content, USAGE_HEADINGS),
    };
};

/**
 * Parses a component README: its title and the one-sentence description that the
 * generator lifts verbatim into the component index (first prose line after the
 * title). Read-only; see `validateComponentReadme` for the enforced contract.
 */
export const parseComponentReadme = (content: string): ComponentExtract => {
    const main = parse(content).children;

    const titleNode = main.find(n => n.type === 'heading' && n.depth === 1);
    const searchFrom = titleNode ? main.indexOf(titleNode) + 1 : 0;
    const firstContent = main.slice(searchFrom).find(n => n.type !== 'html');

    return {
        title: titleNode ? toString(titleNode).trim() : null,
        description:
            firstContent?.type === 'paragraph' ? toString(firstContent).trim() || null : null,
    };
};

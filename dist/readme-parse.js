// Read-only extraction from README files against the LLM-ready template.
// Intended for llms.txt generators to assemble the root catalog and per-package
// llms.txt. Never fails or judges — see `readme-validate.ts` for enforcement.
import { toString } from 'mdast-util-to-string';
import { analyze, INSTALL_HEADINGS, mergedSectionBodies, parse, sectionBody, USAGE_HEADINGS, } from './readme-ast.js';
/**
 * Extracts the agent-facing block and positioning sentence from a package README.
 * `block`/`positioning` are null when the section is absent.
 */
export const extractMeta = (content) => {
    const { agent } = analyze(content);
    if (!agent) {
        return { found: false, block: null, positioning: null };
    }
    return { found: true, block: agent.block, positioning: agent.positioning };
};
/**
 * Parses a package README into the structured extract the llms.txt generator
 * consumes. This is the read-only counterpart to `validatePackageReadme`: it
 * never fails or judges, it just returns what is present (null otherwise), so a
 * README that has not adopted the template yet degrades field-by-field.
 */
export const parsePackageReadme = (content) => {
    const { main, agent } = analyze(content);
    return {
        agentPositioning: agent?.positioning ?? null,
        agentProse: agent?.prose ?? null,
        install: sectionBody(main, content, INSTALL_HEADINGS, [2, 3]),
        usage: mergedSectionBodies(main, content, USAGE_HEADINGS, [2], INSTALL_HEADINGS),
    };
};
/**
 * Parses a component README: its title and the one-sentence description that the
 * generator lifts verbatim into the component index (first prose line after the
 * title). Read-only; see `validateComponentReadme` for the enforced contract.
 */
export const parseComponentReadme = (content) => {
    const main = parse(content).children;
    const titleNode = main.find(n => n.type === 'heading' && n.depth === 1);
    const searchFrom = titleNode ? main.indexOf(titleNode) + 1 : 0;
    const firstContent = main.slice(searchFrom).find(n => n.type !== 'html');
    return {
        title: titleNode ? toString(titleNode).trim() : null,
        description: firstContent?.type === 'paragraph' ? toString(firstContent).trim() || null : null,
    };
};

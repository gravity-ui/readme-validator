// Contract enforcement for README files against the LLM-ready template.
// Meant to run in each package repo's CI. Read-only extraction (for generators)
// lives in `readme-parse.ts`.

import type {Content} from 'mdast';
import {toString} from 'mdast-util-to-string';

import type {AgentBlock} from './readme-ast';
import {
    AGENT_HEADING,
    analyze,
    hasMainHeading,
    hasNodeOfType,
    headingKey,
    INSTALL_HEADINGS,
    LICENSE_HEADING,
    parse,
    RECOMMENDED_HEADINGS,
    SERVICE_MARKERS,
    USAGE_HEADINGS,
    walk,
} from './readme-ast';

export interface PackageValidation {
    ok: boolean;
    errors: string[];
    warnings: string[];
    positioning: string | null;
}

export interface ComponentValidation {
    ok: boolean;
    errors: string[];
    warnings: string[];
    description: string | null;
}

const validatePositioning = (
    positioning: string | null,
    leadNodes: Content[],
    errors: string[],
): void => {
    if (!positioning) {
        errors.push('Positioning (the lead paragraph under "## For AI agents") is missing.');
        return;
    }
    if (positioning.includes('\n')) {
        errors.push('Positioning must be a single line.');
    }
    if (!positioning.endsWith('.')) {
        errors.push('Positioning must end with a period.');
    }
    if (hasNodeOfType(leadNodes, ['link', 'linkReference', 'image', 'imageReference'])) {
        errors.push('Positioning must not contain links, images or badges.');
    }
};

/**
 * Validates the `## For AI agents` block: single occurrence, well-formed
 * positioning, recommended-section hygiene, and no badges/images/service markers.
 */
const validateAgentBlock = (agent: AgentBlock, errors: string[], warnings: string[]): void => {
    if (agent.headingCount > 1) {
        errors.push(
            `Found ${agent.headingCount} "## ${AGENT_HEADING}" sections; there must be one.`,
        );
    }

    const {blockNodes, leadNodes, positioning} = agent;

    validatePositioning(positioning, leadNodes, errors);

    // Sections are recommended, not required. Collect the `###` headings and nudge
    // (never block) on vocabulary, coverage, and ordering.
    const sectionHeadings = blockNodes
        .filter(n => n.type === 'heading' && n.depth === 3)
        .map(n => toString(n).trim());

    const recommendedIdx = (h: string): number =>
        RECOMMENDED_HEADINGS.findIndex(r => headingKey(r) === headingKey(h));
    const known = sectionHeadings.filter(h => recommendedIdx(h) !== -1);
    for (const heading of sectionHeadings) {
        if (recommendedIdx(heading) === -1) {
            warnings.push(
                `Non-standard section "### ${heading}"; prefer ${RECOMMENDED_HEADINGS.map(
                    h => `"${h}"`,
                ).join(', ')}.`,
            );
        }
    }

    if (known.length === 0) {
        warnings.push(
            'The block has only positioning; consider adding "When to use" and/or "Common pitfalls".',
        );
    }

    const orderIdx = known.map(recommendedIdx);
    if (orderIdx.some((v, i) => i > 0 && v < orderIdx[i - 1]!)) {
        warnings.push(
            `Sections are out of the recommended order (${RECOMMENDED_HEADINGS.join(' → ')}).`,
        );
    }

    // No badges / images inside the block.
    let hasBadge = hasNodeOfType(blockNodes, ['image', 'imageReference']);
    const svcHits = new Set<string>();
    const scanHtml = (n: Content): void => {
        if (n.type !== 'html') return;
        if (/<img|shields\.io/i.test(n.value)) hasBadge = true;
        for (const svc of SERVICE_MARKERS) {
            if (n.value.includes(svc)) svcHits.add(svc);
        }
    };
    for (const node of blockNodes) {
        walk(node, scanHtml);
    }
    if (hasBadge) {
        errors.push('Badges and images are not allowed inside the block.');
    }
    for (const svc of svcHits) {
        errors.push(`Service marker ${svc} must not appear inside the block.`);
    }
};

/** Validates a package README against the template contract. */
export const validatePackageReadme = (content: string): PackageValidation => {
    const errors: string[] = [];
    const warnings: string[] = [];

    const {main, agent} = analyze(content);

    // Required top-level sections the generator inlines.
    if (!hasMainHeading(main, INSTALL_HEADINGS, [2, 3])) {
        errors.push('Missing "## Install" (or "Installation") section.');
    }
    if (!hasMainHeading(main, USAGE_HEADINGS)) {
        errors.push('Missing "## Usage" (or "Getting started" / "Quick start") section.');
    }
    if (!hasMainHeading(main, [LICENSE_HEADING])) {
        errors.push(
            `Missing "## ${LICENSE_HEADING}" section. Example:\n\n` +
                `## ${LICENSE_HEADING}\n\n` +
                'Distributed under the MIT License. See [LICENSE](LICENSE) for details.',
        );
    }

    if (!agent) {
        errors.push(`Missing "## ${AGENT_HEADING}" section.`);
        return {ok: false, errors, warnings, positioning: null};
    }

    validateAgentBlock(agent, errors, warnings);

    return {ok: errors.length === 0, errors, warnings, positioning: agent.positioning};
};

/**
 * Validates a component README: the first content after the title is a
 * one-sentence description, plus a Properties section and a code example.
 */
export const validateComponentReadme = (content: string): ComponentValidation => {
    const errors: string[] = [];
    const warnings: string[] = [];

    const main = parse(content).children;

    const title = main.find(n => n.type === 'heading' && n.depth === 1);
    const searchFrom = title ? main.indexOf(title) + 1 : 0;
    const firstContent = main.slice(searchFrom).find(n => n.type !== 'html');

    let description: string | null = null;
    if (!firstContent) {
        errors.push('Missing a one-sentence description after the title.');
    } else if (firstContent.type !== 'paragraph') {
        errors.push(`First content must be a one-sentence description, not ${firstContent.type}.`);
    } else {
        description = toString(firstContent).trim();
        if (!description.endsWith('.')) {
            warnings.push('Description should end with a period.');
        }
        if (description.length < 15) {
            warnings.push('Description looks too short to be a real sentence.');
        }
    }

    const hasProps = hasMainHeading(main, ['Properties', 'Props']);
    if (!hasProps) {
        errors.push('Missing "## Properties" section.');
    }

    if (!hasNodeOfType(main, ['code'])) {
        errors.push('Missing a code example.');
    }

    return {ok: errors.length === 0, errors, warnings, description};
};

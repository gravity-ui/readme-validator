import type { Content, Root } from 'mdast';
export declare const parse: (content: string) => Root;
export declare const AGENT_HEADING = "For AI agents";
export declare const INSTALL_HEADINGS: string[];
export declare const USAGE_HEADINGS: string[];
export declare const LICENSE_HEADING = "License";
export declare const RECOMMENDED_HEADINGS: string[];
export declare const SERVICE_MARKERS: string[];
export interface AgentBlock {
    headingCount: number;
    blockNodes: Content[];
    leadNodes: Content[];
    block: string;
    positioning: string | null;
    prose: string | null;
}
export interface Analysis {
    main: Content[];
    agent: AgentBlock | null;
}
export declare const headingKey: (text: string) => string;
/** Case-insensitive membership of a heading's text in a set of accepted aliases. */
export declare const matchesHeading: (text: string, names: string[]) => boolean;
export declare const hasMainHeading: (main: Content[], names: string[], depths?: number[]) => boolean;
export declare const walk: (node: Content, fn: (n: Content) => void) => void;
export declare const hasNodeOfType: (nodes: Content[], types: string[]) => boolean;
/**
 * Parses the README once and locates the agent block, its lead (positioning)
 * nodes, and the raw text of both. Internal; `extractMeta` is the public view.
 */
export declare const analyze: (content: string) => Analysis;
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
export declare const sectionBody: (main: Content[], content: string, names: string[], depths?: number[]) => string | null;
/**
 * Like `sectionBody`, but concatenates the bodies of *every* section matching an
 * alias, in document order. Used for `usage`, where a `## Getting Started` guide
 * and a `## Usage` section should merge into one block (so prose that lives
 * outside the focused `### Installation` — e.g. prerequisites — is not lost).
 * Subsections matching `exclude` are dropped, so the install command that already
 * feeds the `install` field is not duplicated here.
 */
export declare const mergedSectionBodies: (main: Content[], content: string, names: string[], depths?: number[], exclude?: string[]) => string | null;

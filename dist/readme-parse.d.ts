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
    agentPositioning: string | null;
    agentProse: string | null;
    install: string | null;
    usage: string | null;
}
export interface ComponentExtract {
    title: string | null;
    description: string | null;
}
/**
 * Extracts the agent-facing block and positioning sentence from a package README.
 * `block`/`positioning` are null when the section is absent.
 */
export declare const extractMeta: (content: string) => MetaExtract;
/**
 * Parses a package README into the structured extract the llms.txt generator
 * consumes. This is the read-only counterpart to `validatePackageReadme`: it
 * never fails or judges, it just returns what is present (null otherwise), so a
 * README that has not adopted the template yet degrades field-by-field.
 */
export declare const parsePackageReadme: (content: string) => PackageExtract;
/**
 * Parses a component README: its title and the one-sentence description that the
 * generator lifts verbatim into the component index (first prose line after the
 * title). Read-only; see `validateComponentReadme` for the enforced contract.
 */
export declare const parseComponentReadme: (content: string) => ComponentExtract;

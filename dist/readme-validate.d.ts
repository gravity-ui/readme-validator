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
/** Validates a package README against the template contract. */
export declare const validatePackageReadme: (content: string) => PackageValidation;
/**
 * Validates a component README: the first content after the title is a
 * one-sentence description, plus a Properties section and a code example.
 */
export declare const validateComponentReadme: (content: string) => ComponentValidation;

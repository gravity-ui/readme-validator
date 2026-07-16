/**
 * Prepares a source README for shipping inside the npm tarball (e.g. build/docs/),
 * where it is consumed by AI agents rather than rendered on GitHub or Storybook.
 *
 * Commented-out `SANDBOX`/`LANDING_BLOCK` markers (their code duplicates the plain
 * fenced example shown right after) are dropped entirely; `GITHUB_BLOCK` wrappers
 * are unwrapped, keeping their content. Badges and images are stripped.
 *
 * @param content raw markdown source.
 * @returns the cleaned markdown, terminated by a single newline.
 */
export declare function cleanMarkdown(content: string): string;

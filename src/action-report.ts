// Pure helpers for the GitHub Action's PR comment. Kept out of action.ts so
// they can be unit-tested without triggering the action's top-level run().

export type Type = 'package' | 'component';

export interface FileResult {
    file: string;
    ok: boolean;
    errors: string[];
    warnings: string[];
}

// Hidden marker so we can find and update our own comment instead of stacking
// a new one on every push.
export const MARKER = '<!-- gravity-readme-validator -->';

/** Builds the sticky PR comment body for a run's results. */
export const buildComment = (type: Type, results: FileResult[]): string => {
    const failures = results.filter(r => !r.ok);
    const header = `${MARKER}\n### README validation`;

    if (failures.length === 0) {
        return `${header}\n\n✅ All ${results.length} file(s) match the \`${type}\` template.`;
    }

    const blocks = failures.map(r => {
        const lines = [...r.errors.map(e => `✗ ${e}`), ...r.warnings.map(w => `⚠ ${w}`)].join('\n');
        // Fenced so multi-line errors (which themselves contain Markdown) render
        // literally instead of injecting headings into the comment.
        return `<details open>\n<summary><code>${r.file}</code> — ${r.errors.length} error(s)</summary>\n\n\`\`\`\n${lines}\n\`\`\`\n</details>`;
    });

    return [
        header,
        '',
        `❌ **${failures.length} of ${results.length} file(s)** failed the \`${type}\` template check.`,
        '',
        ...blocks,
    ].join('\n');
};

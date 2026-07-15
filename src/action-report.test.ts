// Tests for the pure PR-comment builder.
import {buildComment, MARKER} from './action-report.js';

describe('buildComment', () => {
    test('carries the marker so the comment can be found and updated', () => {
        expect(buildComment('package', []).startsWith(MARKER)).toBe(true);
    });

    test('reports success when nothing failed', () => {
        const body = buildComment('package', [
            {file: 'README.md', ok: true, errors: [], warnings: []},
        ]);
        expect(body).toContain('✅');
        expect(body).not.toContain('✗');
    });

    test('lists every failing file with its errors', () => {
        const body = buildComment('package', [
            {file: 'a/README.md', ok: true, errors: [], warnings: []},
            {
                file: 'b/README.md',
                ok: false,
                errors: ['Missing "## License" section.'],
                warnings: ['Non-standard section "### Notes".'],
            },
        ]);
        expect(body).toContain('1 of 2 file(s)');
        expect(body).toContain('<code>b/README.md</code>');
        expect(body).toContain('✗ Missing "## License" section.');
        expect(body).toContain('⚠ Non-standard section "### Notes".');
        // The clean file is not listed among failures.
        expect(body).not.toContain('<code>a/README.md</code>');
    });
});

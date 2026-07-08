// Tests for the README template validators.
// Package-README cases are file fixtures in examples/valid|invalid; each fixture
// may declare `<!-- expect: <substr> -->` (invalid) or `<!-- warn: <substr> -->`
// (valid) on its first line to assert a specific message.
import {readFileSync, readdirSync} from 'node:fs';

import {validateComponentReadme, validatePackageReadme} from './readme-validate';

interface Fixture {
    name: string;
    content: string;
    directive: [kind: string, substring: string] | null;
}

const loadFixtures = (kind: 'valid' | 'invalid'): Fixture[] => {
    const dir = new URL(`./examples/${kind}/`, import.meta.url);
    return readdirSync(dir)
        .filter(f => f.endsWith('.md'))
        .sort()
        .map(name => {
            const content = readFileSync(new URL(name, dir), 'utf8');
            const m = content.match(/^<!--\s*(expect|warn):\s*(.+?)\s*-->/m);
            return {name, content, directive: m ? [m[1]!, m[2]!] : null};
        });
};

const hasError = (errors: string[], sub: string): boolean => errors.some(e => e.includes(sub));
const hasWarning = (warnings: string[], sub: string): boolean =>
    warnings.some(w => w.includes(sub));

// --- validatePackageReadme (file fixtures) -------------------------------

describe('validatePackageReadme · valid fixtures', () => {
    for (const {name, content, directive} of loadFixtures('valid')) {
        test(name, () => {
            const result = validatePackageReadme(content);
            expect(result.errors).toEqual([]);
            if (directive?.[0] === 'warn') {
                expect(hasWarning(result.warnings, directive[1])).toBe(true);
            }
        });
    }
});

describe('validatePackageReadme · invalid fixtures', () => {
    for (const {name, content, directive} of loadFixtures('invalid')) {
        test(name, () => {
            const result = validatePackageReadme(content);
            expect(result.ok).toBe(false);
            if (directive?.[0] === 'expect') {
                expect(hasError(result.errors, directive[1])).toBe(true);
            }
        });
    }
});

// --- License requirement -------------------------------------------------

describe('validatePackageReadme · License', () => {
    const withoutLicense = [
        '# Foo',
        '',
        '## Install',
        '',
        '```shell',
        'npm i foo',
        '```',
        '',
        '## Usage',
        '',
        '```tsx',
        'foo();',
        '```',
        '',
        '## For AI agents',
        '',
        'Foo is the base thing for Gravity UI apps, distinct from its neighbors.',
    ].join('\n');

    test('fails when "## License" is missing, with example content in the error', () => {
        const result = validatePackageReadme(withoutLicense);
        expect(result.ok).toBe(false);
        expect(
            result.errors.some(e =>
                e.includes(
                    'Distributed under the MIT License. See [LICENSE](LICENSE) for details.',
                ),
            ),
        ).toBe(true);
    });

    test('passes once a "## License" section is added', () => {
        const result = validatePackageReadme(`${withoutLicense}\n\n## License\n\nMIT\n`);
        expect(result.ok).toBe(true);
    });
});

// --- shipped templates ---------------------------------------------------

describe('shipped templates stay valid', () => {
    const read = (name: string) => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');

    test('TEMPLATE.md passes --package', () => {
        expect(validatePackageReadme(read('TEMPLATE.md')).errors).toEqual([]);
    });

    test('TEMPLATE.component.md passes --component', () => {
        expect(validateComponentReadme(read('TEMPLATE.component.md')).errors).toEqual([]);
    });
});

// --- validateComponentReadme ---------------------------------------------

describe('validateComponentReadme', () => {
    const component = [
        '# Button',
        '',
        'Buttons trigger an action or event.',
        '',
        '## Properties',
        '',
        '| Name | Type | Default | Description |',
        '| ---- | ---- | ------- | ----------- |',
        '| view | string | normal | visual style |',
        '',
        '## Example',
        '',
        '```tsx',
        '<Button view="action" />;',
        '```',
    ].join('\n');

    test('accepts a well-formed component README', () => {
        const result = validateComponentReadme(component);
        expect(result.ok).toBe(true);
        expect(result.description).toBe('Buttons trigger an action or event.');
    });

    test('accepts the "Props" heading alias', () => {
        const result = validateComponentReadme(component.replace('## Properties', '## Props'));
        expect(result.ok).toBe(true);
    });

    test('fails when the first content is code, not a description', () => {
        const readme = '# Button\n\n```tsx\n<Button />;\n```\n\n## Properties\n\n| a | b |';
        const result = validateComponentReadme(readme);
        expect(result.ok).toBe(false);
        expect(hasError(result.errors, 'description')).toBe(true);
    });

    test('fails when the Properties section is missing', () => {
        const readme = '# Button\n\nButtons trigger an action.\n\n```tsx\n<Button />;\n```';
        const result = validateComponentReadme(readme);
        expect(hasError(result.errors, 'Properties')).toBe(true);
    });

    test('fails when there is no code example', () => {
        const readme = '# Button\n\nButtons trigger an action.\n\n## Properties\n\n| a | b |';
        const result = validateComponentReadme(readme);
        expect(hasError(result.errors, 'code example')).toBe(true);
    });

    test('warns when the description is not a proper sentence', () => {
        const readme = component.replace('Buttons trigger an action or event.', 'Buttons');
        const result = validateComponentReadme(readme);
        expect(hasWarning(result.warnings, 'period') || hasWarning(result.warnings, 'short')).toBe(
            true,
        );
    });
});

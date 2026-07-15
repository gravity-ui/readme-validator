// Tests for the read-only README extraction.
import {extractMeta, parseComponentReadme, parsePackageReadme} from './readme-parse.js';

// --- extractMeta ---------------------------------------------------------

describe('extractMeta', () => {
    test('returns found=false when there is no AI section', () => {
        expect(extractMeta('# Foo\n\n## Install\n\nstuff\n')).toEqual({
            found: false,
            block: null,
            positioning: null,
        });
    });

    test('extracts positioning and the block, stopping at the next ##', () => {
        const readme = [
            '# Foo',
            '',
            '## For AI agents',
            '',
            'Foo is a base thing for Gravity UI apps.',
            '',
            '### When to use',
            '',
            '- x',
            '',
            '## License',
            '',
            'MIT',
            '',
        ].join('\n');
        const result = extractMeta(readme);
        expect(result.found).toBe(true);
        expect(result.positioning).toBe('Foo is a base thing for Gravity UI apps.');
        expect(result.block?.includes('### When to use')).toBe(true);
        expect(result.block?.includes('MIT')).toBe(false);
    });
});

// --- parsePackageReadme --------------------------------------------------

describe('parsePackageReadme', () => {
    const readme = [
        '# Foo',
        '',
        '## Install',
        '',
        '```shell',
        'npm install @gravity-ui/foo',
        '```',
        '',
        '## Usage',
        '',
        'Wrap the app in `<ThemeProvider>`.',
        '',
        '## For AI agents',
        '',
        'Foo is a base thing for Gravity UI apps.',
        '',
        '### When to use',
        '',
        '- x',
        '',
        '## License',
        '',
        'MIT',
        '',
    ].join('\n');

    test('extracts every field the generator consumes', () => {
        const result = parsePackageReadme(readme);
        expect(result.agentPositioning).toBe('Foo is a base thing for Gravity UI apps.');
        expect(result.agentProse).toBe('### When to use\n\n- x');
        expect(result.install?.includes('npm install @gravity-ui/foo')).toBe(true);
        expect(result.usage).toBe('Wrap the app in `<ThemeProvider>`.');
        // Section bodies stop before the next `##`.
        expect(result.usage?.includes('For AI agents')).toBe(false);
        expect(result.agentProse?.includes('MIT')).toBe(false);
    });

    test('positioning-only block yields null agentProse', () => {
        const result = parsePackageReadme('# Foo\n\n## For AI agents\n\nFoo does a thing.\n');
        expect(result.agentPositioning).toBe('Foo does a thing.');
        expect(result.agentProse).toBe(null);
    });

    test('honors the Installation / Getting started aliases', () => {
        const result = parsePackageReadme(
            '# Foo\n\n## Installation\n\ninstall body\n\n## Getting started\n\nusage body\n',
        );
        expect(result.install).toBe('install body');
        expect(result.usage).toBe('usage body');
    });

    test('extracts a `### Installation` nested under `## Getting Started`', () => {
        const readme = [
            '# Foo',
            '',
            '## Getting Started',
            '',
            '### Prerequisites',
            '',
            'React 18 must be installed.',
            '',
            '### Installation',
            '',
            '```shell',
            'npm install @gravity-ui/foo',
            '```',
            '',
            '## Usage',
            '',
            'Import components directly.',
            '',
        ].join('\n');
        const result = parsePackageReadme(readme);
        // install stops at the next same-or-higher heading, so it is just its own body.
        expect(result.install).toBe('```shell\nnpm install @gravity-ui/foo\n```');
        expect(result.install?.includes('Prerequisites')).toBe(false);
        expect(result.install?.includes('Usage')).toBe(false);
        // The `## Getting Started` body (incl. its prerequisites prose) merges into usage
        // alongside the dedicated `## Usage` section, so nothing outside install is lost...
        expect(result.usage?.includes('React 18 must be installed.')).toBe(true);
        expect(result.usage?.includes('Import components directly.')).toBe(true);
        // ...but the `### Installation` subsection is dropped from usage (it feeds install).
        expect(result.usage?.includes('npm install @gravity-ui/foo')).toBe(false);
        expect(result.usage?.includes('### Installation')).toBe(false);
    });

    test('matches section aliases case-insensitively', () => {
        const result = parsePackageReadme(
            '# Foo\n\n## INSTALLATION\n\ninstall body\n\n## Getting Started\n\nusage body\n',
        );
        expect(result.install).toBe('install body');
        expect(result.usage).toBe('usage body');
    });

    test('returns all-null for a README without the template sections', () => {
        expect(parsePackageReadme('# Foo\n\nsome prose\n')).toEqual({
            agentPositioning: null,
            agentProse: null,
            install: null,
            usage: null,
        });
    });
});

// --- parseComponentReadme ------------------------------------------------

describe('parseComponentReadme', () => {
    test('takes the title and the first prose line as the description', () => {
        const result = parseComponentReadme(
            '# Button\n\nButtons trigger an action or event.\n\n## Properties\n',
        );
        expect(result).toEqual({
            title: 'Button',
            description: 'Buttons trigger an action or event.',
        });
    });

    test('skips leading service HTML before the description', () => {
        const result = parseComponentReadme(
            '# Button\n\n<!--GITHUB_BLOCK-->\n\nButtons trigger an action.\n',
        );
        expect(result.description).toBe('Buttons trigger an action.');
    });

    test('description is null when the first content is not prose', () => {
        const result = parseComponentReadme('# Button\n\n```tsx\n<Button />;\n```\n');
        expect(result.title).toBe('Button');
        expect(result.description).toBe(null);
    });
});

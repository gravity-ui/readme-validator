import {mkdtempSync, readFileSync, writeFileSync, existsSync, mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';

import {buildDocs, createDefaultDocsConfig} from './buildDocs.js';

const fixture = fileURLToPath(new URL('./buildDocs-fixtures/pkg/', import.meta.url));

function build() {
    const outDir = mkdtempSync(join(tmpdir(), 'readme-validator-docs-'));
    const result = buildDocs({...createDefaultDocsConfig(fixture), outDir});
    const read = (rel: string) => readFileSync(join(outDir, rel), 'utf8');
    return {outDir, result, read};
}

describe('buildDocs', () => {
    test('rewrites README-path and bare-folder links to shipped docs', () => {
        const alpha = build().read('components/Alpha.md');

        // ../Beta/README.md#props → ./Beta.md#props
        expect(alpha).toMatch(/\[Beta\]\(\.\/Beta\.md#props\)/);
        // bare folder ../Beta → ./Beta.md
        expect(alpha).toMatch(/\[Beta folder\]\(\.\/Beta\.md\)/);
    });

    test('unwraps links to non-shipped targets, leaving no dead link', () => {
        const alpha = build().read('components/Alpha.md');

        expect(alpha).not.toMatch(/types\.ts/); // ./types.ts#L1 dropped
        expect(alpha).toMatch(/a type/); // link text kept
    });

    test('keeps external URLs and strips service markers', () => {
        const alpha = build().read('components/Alpha.md');

        expect(alpha).toMatch(/\(https:\/\/example\.com\)/);
        expect(alpha).toMatch(/^# Alpha$/m);
        expect(alpha).not.toMatch(/SANDBOX|GITHUB_BLOCK/);
    });

    test('excludes legacy and indexes every shipped doc', () => {
        const {outDir, result, read} = build();

        expect(existsSync(join(outDir, 'components', 'legacy'))).toBe(false);

        const index = read('INDEX.md');
        expect(index).toMatch(/\[Alpha\]\(\.\/components\/Alpha\.md\)/);
        expect(index).toMatch(/\[Beta\]\(\.\/components\/Beta\.md\)/);
        expect(index).toMatch(/\[Theming guide\]\(\.\/guides\/guide\.md\)/); // named by heading

        expect(result.total).toBe(3); // Alpha, Beta, guide (legacy excluded)
    });

    // A throwaway package with a writable README, so the pointer-writing behavior
    // never mutates the shared fixture. Returns the root and readers.
    function buildTempPackage(readmeBody?: string) {
        const root = mkdtempSync(join(tmpdir(), 'readme-validator-pkg-'));
        writeFileSync(join(root, 'package.json'), JSON.stringify({name: '@demo/widgets'}));
        mkdirSync(join(root, 'docs'), {recursive: true});
        writeFileSync(join(root, 'docs', 'theming.md'), '# Theming\n\nHow to theme.\n');
        mkdirSync(join(root, 'src', 'components', 'Button'), {recursive: true});
        writeFileSync(
            join(root, 'src', 'components', 'Button', 'README.md'),
            '# Button\n\nA button.\n',
        );
        if (readmeBody !== undefined) {
            writeFileSync(join(root, 'README.md'), readmeBody);
        }

        const run = () => buildDocs(createDefaultDocsConfig(root));
        const readIndex = () => readFileSync(join(root, 'build', 'docs', 'INDEX.md'), 'utf8');
        const readReadme = () => readFileSync(join(root, 'README.md'), 'utf8');
        return {root, run, readIndex, readReadme};
    }

    test('places the README "For AI agents" section at the top of INDEX.md', () => {
        const pkg = buildTempPackage(
            [
                '# @demo/widgets',
                '',
                '![badge](https://img.shields.io/x.svg)',
                '',
                '## For AI agents',
                '',
                'Widget primitives for dashboards.',
                '',
                '### When to use',
                '',
                '- Building a grid.',
            ].join('\n'),
        );

        pkg.run();
        const index = pkg.readIndex();

        // The section, cleaned of the badge, leads the generated doc sections, with
        // positioning and the When-to-use prose both surfaced.
        expect(index).toMatch(/## For AI agents/);
        expect(index).toMatch(/Widget primitives for dashboards\./);
        expect(index).toMatch(/### When to use/);
        expect(index).toMatch(/Building a grid\./);
        expect(index).not.toMatch(/shields\.io/);
        expect(index.indexOf('## For AI agents')).toBeLessThan(index.indexOf('## Components'));
    });

    test('surfaces the README Install and Usage sections in INDEX.md', () => {
        const pkg = buildTempPackage(
            [
                '# @demo/widgets',
                '',
                '## Installation',
                '',
                '```sh',
                'npm install @demo/widgets',
                '```',
                '',
                '## Usage',
                '',
                'Wrap your app in the provider.',
            ].join('\n'),
        );

        pkg.run();
        const index = pkg.readIndex();

        // `## Installation` is normalized to the canonical `## Install` label.
        expect(index).toMatch(/## Install\b/);
        expect(index).toMatch(/npm install @demo\/widgets/);
        expect(index).toMatch(/## Usage/);
        expect(index).toMatch(/Wrap your app in the provider\./);
        expect(index.indexOf('## Usage')).toBeLessThan(index.indexOf('## Components'));
    });

    test('rewrites README overview links to their copied doc locations', () => {
        // buildTempPackage ships docs/theming.md → guides/theming.md. A README prose
        // link to the repo path must be rewritten relative to INDEX.md (outDir root),
        // not left pointing at the no-longer-present ./docs/theming.md.
        const pkg = buildTempPackage(
            [
                '# @demo/widgets',
                '',
                '## For AI agents',
                '',
                'Primitives.',
                '',
                '### Useful docs',
                '',
                '- [Theming](./docs/theming.md)',
            ].join('\n'),
        );

        pkg.run();
        const index = pkg.readIndex();

        expect(index).toMatch(/\[Theming\]\(\.\/guides\/theming\.md\)/);
        expect(index).not.toMatch(/docs\/theming\.md/);
    });

    test('summarizes a component index entry from its intro paragraph', () => {
        const pkg = buildTempPackage('# @demo/widgets\n\n## For AI agents\n\nPrimitives.\n');

        pkg.run();

        // Button/README.md is "# Button\n\nA button." → the paragraph becomes the summary.
        expect(pkg.readIndex()).toMatch(/\[Button\]\(\.\/components\/Button\.md\) — A button\./);
    });
});

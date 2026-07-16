import {cleanMarkdown} from './cleanMarkdown.js';

describe('cleanMarkdown', () => {
    test('drops SANDBOX and LANDING blocks but keeps GITHUB_BLOCK content', () => {
        const out = cleanMarkdown(
            [
                '<!--GITHUB_BLOCK-->',
                '# Button',
                '<!--/GITHUB_BLOCK-->',
                '',
                '<!--SANDBOX',
                'render(<Button />)',
                'SANDBOX-->',
                '',
                '<!--LANDING_BLOCK',
                'landing only',
                'LANDING_BLOCK-->',
                '',
                'Body text.',
                '',
            ].join('\n'),
        );

        expect(out).toMatch(/^# Button$/m);
        expect(out).toMatch(/^Body text\.$/m);
        expect(out).not.toMatch(/SANDBOX|LANDING_BLOCK|GITHUB_BLOCK/);
    });

    test('strips badges and images', () => {
        const out = cleanMarkdown('# X\n\n![badge](https://img.shields.io/x.svg)\n\nBody.\n');

        expect(out).not.toMatch(/shields\.io/);
        expect(out).toMatch(/^Body\.$/m);
    });
});

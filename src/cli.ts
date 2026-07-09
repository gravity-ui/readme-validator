#!/usr/bin/env node
// Validates README files against the LLM-ready template.
//
// Usage:
//   gravity-readme --package path/to/README.md
//   gravity-readme --component path/to/Component/README.md

import fs from 'node:fs/promises';
import process from 'node:process';

import {validateComponentReadme, validatePackageReadme} from './readme-validate';

const USAGE = `Usage:
  gravity-readme --package <README.md | URL>
  gravity-readme --component <README.md | URL>`;

const isUrl = (target: string): boolean => /^https?:\/\//i.test(target);

const load = async (target: string): Promise<string> => {
    if (isUrl(target)) {
        const response = await fetch(target);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status} ${response.statusText}`);
        }
        return response.text();
    }
    return fs.readFile(target, 'utf8');
};

interface Reportable {
    ok: boolean;
    errors: string[];
    warnings: string[];
}

const report = (label: string, result: Reportable): boolean => {
    for (const warning of result.warnings) {
        console.warn(`  ⚠ ${warning}`);
    }
    if (result.ok) {
        console.log(`✓ ${label}`);
        return true;
    }
    console.error(`✗ ${label}`);
    for (const error of result.errors) {
        console.error(`  • ${error}`);
    }
    return false;
};

const main = async (): Promise<void> => {
    const [mode, target] = process.argv.slice(2);

    if ((mode !== '--package' && mode !== '--component') || !target) {
        console.error(USAGE);
        process.exit(2);
    }

    let content: string;
    try {
        content = await load(target);
    } catch (error) {
        console.error(`Cannot read ${target}: ${(error as Error).message}`);
        process.exit(2);
    }

    if (mode === '--package') {
        const result = validatePackageReadme(content);
        const ok = report(target, result);
        if (ok) console.log(`  positioning: "${result.positioning}"`);
        process.exit(ok ? 0 : 1);
    } else {
        const result = validateComponentReadme(content);
        const ok = report(target, result);
        process.exit(ok ? 0 : 1);
    }
};

main();

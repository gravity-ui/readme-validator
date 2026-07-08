// GitHub Action entry point. Validates the matched README files against the
// LLM-ready template, annotates failures inline, and — when run from a pull
// request — posts a single sticky comment listing every problem.
//
// Bundled self-contained into dist/action.cjs (all deps inlined) because a
// JS action runs straight from the repo, without `npm install`.
import {readFile} from 'node:fs/promises';
import {relative} from 'node:path';

import * as core from '@actions/core';
import * as github from '@actions/github';
import * as glob from '@actions/glob';

import type {FileResult, Type} from './action-report';
import {buildComment, MARKER} from './action-report';
import type {ComponentValidation, PackageValidation} from './readme-validate';
import {validateComponentReadme, validatePackageReadme} from './readme-validate';

const validators: Record<Type, (content: string) => PackageValidation | ComponentValidation> = {
    package: validatePackageReadme,
    component: validateComponentReadme,
};

const upsertComment = async (token: string, body: string, hasFailures: boolean): Promise<void> => {
    const prNumber = github.context.payload.pull_request?.number;
    if (!prNumber) {
        return; // not a pull request — nothing to comment on
    }

    const octokit = github.getOctokit(token);
    const {owner, repo} = github.context.repo;

    const comments = await octokit.paginate(octokit.rest.issues.listComments, {
        owner,
        repo,
        issue_number: prNumber,
        per_page: 100,
    });
    const existing = comments.find(c => c.body?.includes(MARKER));

    // Don't spam a clean PR: only post on failure, or update an existing comment
    // (e.g. to flip it to green once the errors are fixed).
    if (!existing && !hasFailures) {
        return;
    }

    if (existing) {
        await octokit.rest.issues.updateComment({owner, repo, comment_id: existing.id, body});
    } else {
        await octokit.rest.issues.createComment({owner, repo, issue_number: prNumber, body});
    }
};

const run = async (): Promise<void> => {
    const type = (core.getInput('type') || 'package') as Type;
    if (!validators[type]) {
        core.setFailed(`Unknown "type": "${type}". Expected "package" or "component".`);
        return;
    }

    const patterns = core.getInput('paths') || 'README.md';
    const globber = await glob.create(patterns.split(/\s+/).filter(Boolean).join('\n'));
    const matches = await globber.glob();

    if (matches.length === 0) {
        core.setFailed(`No files matched "${patterns}".`);
        return;
    }

    const results: FileResult[] = [];
    for (const match of matches) {
        const file = relative(process.cwd(), match);
        const {ok, errors, warnings} = validators[type](await readFile(match, 'utf8'));

        for (const warning of warnings) {
            core.warning(warning, {file});
        }
        if (ok) {
            core.info(`✓ ${file}`);
        } else {
            for (const error of errors) {
                core.error(error, {file});
            }
        }
        results.push({file, ok, errors, warnings});
    }

    const failed = results.filter(r => !r.ok).length;

    if (core.getInput('comment') !== 'false') {
        const token = core.getInput('github-token');
        try {
            if (token) {
                await upsertComment(token, buildComment(type, results), failed > 0);
            }
        } catch (error) {
            // A read-only token (e.g. a fork PR) can't comment — don't mask the
            // real validation result over it.
            core.warning(`Could not post the PR comment: ${(error as Error).message}`);
        }
    }

    core.info(`Validated ${results.length} file(s) as "${type}".`);
    if (failed > 0) {
        core.setFailed(`${failed} README file(s) failed validation.`);
    }
};

run().catch(error => {
    core.setFailed(error instanceof Error ? error.message : String(error));
});

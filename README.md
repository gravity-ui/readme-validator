# @gravity-ui/readme-validator

Parse and validate `README.md` files against the Gravity UI **LLM-ready template** — the shape that keeps a README pleasant for humans while staying machine-parseable for `llms.txt` generators.

## Install

```shell
npm install --save-dev @gravity-ui/readme-validator
```

## Usage

### CLI

```shell
gravity-readme --package   path/to/README.md
gravity-readme --component path/to/Component/README.md
```

### API

```ts
import {
    parsePackageReadme,
    parseComponentReadme,
    validatePackageReadme,
    validateComponentReadme,
} from '@gravity-ui/readme-validator';

const {agentPositioning, agentProse, install, usage} = parsePackageReadme(readme);
const {ok, errors, warnings} = validatePackageReadme(readme);
```

## GitHub Action

Validate READMEs in CI and get inline annotations on the pull request:

```yaml
# .github/workflows/readme.yml
name: Validate README

on:
  workflow_dispatch:
  pull_request:
    paths:
      - README.md

permissions:
  contents: read
  pull-requests: write

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - name: Generate token
        id: generate-token
        uses: actions/create-github-app-token@v2
        with:
          app-id: ${{ secrets.GRAVITY_UI_APP_ID }}
          private-key: ${{ secrets.GRAVITY_UI_APP_PRIVATE_KEY }}
      - uses: actions/checkout@v4
      - uses: gravity-ui/readme-validator@v1
        with:
          type: package
          github-token: ${{ steps.generate-token.outputs.token }}
```

The first step mints a short-lived token from the Gravity UI GitHub App (same pattern as the [uikit release workflow](https://github.com/gravity-ui/uikit/blob/main/.github/workflows/release.yml)); the app's comments show up under its own identity and can post on PRs from forks. If you don't need that, drop the token step — `github-token` defaults to `${{ github.token }}`, which is enough for same-repo PRs with `pull-requests: write`.

| Input          | Default            | Description                                                    |
| -------------- | ------------------ | -------------------------------------------------------------- |
| `paths`        | `README.md`        | Newline- or space-separated globs of README files to validate. |
| `type`         | `package`          | Template to validate against: `package` or `component`.        |
| `comment`      | `true`             | Post a summary comment on the PR. Set to `false` to disable.   |
| `github-token` | `${{ github.token }}` | Token used to comment; needs `pull-requests: write`.        |

### What gets checked

With `type: package` (the default) the action **fails** the job unless the README has all of:

- `## Install` (or `## Installation`) — accepted at `##` or `###`
- `## Usage` (or `## Getting started` / `## Quick start`)
- `## License`
- exactly one `## For AI agents` whose lead paragraph is a single well-formed sentence — one line, ends with a period, no links/images/badges. Badges, images and service markers (`<!--SANDBOX-->`, `<!--GITHUB_BLOCK-->`) must stay out of the block.

The `### When to use` / `### When not to use` / `### Common pitfalls` headings inside the block are **recommended, not required** — a missing, non-standard or out-of-order heading only produces a warning.

With `type: component` the action **fails** unless the README has all of:

- a one-sentence description as the first content after the title
- a `## Properties` (or `## Props`) section
- at least one code example

## The valid templates

Start from the filled, self-documenting templates in this repo — copy one, replace the example content, and delete the guidance comments:

- **[`TEMPLATE.md`](TEMPLATE.md)** — a package README (validated with `--package`).
- **[`TEMPLATE.component.md`](TEMPLATE.component.md)** — a component README (validated with `--component`).

## Development

```shell
npm install
npm test        # jest (ts-jest, ESM) over src/*.test.ts
npm run lint    # eslint (@gravity-ui/eslint-config + prettier)
npm run typecheck  # tsc --noEmit
npm run build   # lint + typecheck, then esbuild → dist/
```

Sources are plain `.ts`; `tsc` only type-checks (`noEmit`) and **esbuild** bundles into `dist/`:

| Output           | Format | Deps     | Consumer                                    |
| ---------------- | ------ | -------- | ------------------------------------------- |
| `dist/index.js`  | ESM    | external | `import` from the package (npm)             |
| `dist/cli.js`    | ESM    | external | the `gravity-readme` bin                    |
| `dist/action.cjs`| CJS    | bundled  | the GitHub Action (runs without `npm i`)    |

**`dist/` is committed** — a JS GitHub Action runs straight from the repo with no install step, so the bundled `dist/action.cjs` (with all deps inlined) must be checked in. Run `npm run build` and commit `dist/` alongside any `src/` change; the `check-dist` workflow fails the PR if they drift.

## License

Distributed under the MIT License. See [LICENSE](LICENSE) for details.

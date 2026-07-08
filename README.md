# @gravity-ui/readme-validator

Parse and validate `README.md` files against the Gravity UI **LLM-ready template** — the shape that keeps a README pleasant for humans while staying machine-parseable for `llms.txt` generators.

Two regimes over a single Markdown-AST pass:

- **`parse*`** — read-only extraction for generators. Never throws or judges; returns whatever is present (`null` otherwise), so a README that has not adopted the template yet degrades field-by-field.
- **`validate*`** — contract enforcement for CI. Returns `{ok, errors, warnings}`.

## Install

```shell
npm install --save-dev @gravity-ui/readme-validator
```

## CLI

```shell
gravity-readme --package   path/to/README.md
gravity-readme --component path/to/Component/README.md
```

## GitHub Action

Validate READMEs in CI and get inline annotations on the pull request:

```yaml
# .github/workflows/readme.yml
name: README
on: [pull_request]
permissions:
  contents: read
  pull-requests: write # needed to post the summary comment
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

Errors become `::error` annotations on the offending file and fail the job; recommendations become `::warning` annotations and never fail. To validate component READMEs, run a second step with `type: component`.

When the run is triggered by a pull request, the action also posts a **single sticky comment** listing every problem across all files, and updates that same comment on each push (flipping it to ✅ once everything passes) instead of stacking new ones. It needs `pull-requests: write`; on fork PRs the token is read-only, so commenting is skipped with a warning while annotations and the job status still work.

## API

```ts
import {
    parsePackageReadme,
    parseComponentReadme,
    validatePackageReadme,
    validateComponentReadme,
} from '@gravity-ui/readme-validator';

// Extraction for an llms.txt generator.
const {agentPositioning, agentProse, install, usage} = parsePackageReadme(readme);

// Enforcement in CI.
const {ok, errors, warnings} = validatePackageReadme(readme);
```

`parsePackageReadme` returns exactly what a generator inlines: the `## For AI agents` positioning line, the block's `###` prose (positioning stripped), and the verbatim `## Install` / `## Usage` bodies (heading aliases accepted). `parseComponentReadme` returns a component's title and its one-sentence description.

## The template

Start from the filled, self-documenting templates in this repo — copy one, replace the example content, and delete the guidance comments:

- **[`TEMPLATE.md`](TEMPLATE.md)** — a package README (validated with `--package`).
- **[`TEMPLATE.component.md`](TEMPLATE.component.md)** — a component README (validated with `--component`).

The agent-facing block is delimited by a fixed heading — no markers:

```md
## For AI agents

<One sentence: what this package does and when to reach for it instead of a neighbor.>

### When to use
### When not to use
### Common pitfalls
```

Hard rules (validation fails): `## Install` (or `Installation`), `## Usage` (or `Getting started` / `Quick start`), `## License`, and exactly one `## For AI agents` whose lead paragraph is a single well-formed sentence (one line, no links/images/badges, ends with a period). Badges/images and service markers must stay out of the block. The `###` section vocabulary is recommended, not required — non-standard headings only warn.

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

Fixtures live in `src/examples/{valid,invalid}`; an invalid fixture may assert a specific message via a first-line `<!-- expect: <substr> -->` directive (`<!-- warn: … -->` for valid ones).

## License

Distributed under the MIT License. See [LICENSE](LICENSE) for details.

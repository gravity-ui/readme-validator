<!--
  ============================================================================
  IDEAL PACKAGE README — a filled, self-documenting template.

  HOW TO USE THIS FILE
    1. Copy it to your package as README.md.
    2. Replace every value with your own. It is filled with content for a
       FICTIONAL `@gravity-ui/table` package so you can see what "good" looks
       like — it is an example, not real documentation.
    3. Delete these guidance comments (the blocks like this one) when you are done.

  WHY IT MATTERS
    The README is the single source of truth. The `## For AI agents` block and
    the `## Install` / `## Usage` sections are lifted VERBATIM into the generated
    llms.txt that coding agents read. Write them for someone who has only this
    file open.

  VALIDATION
    This template passes `gravity-readme --package README.md`. Hard rules that
    fail CI: `## Install`, `## Usage`, and exactly one `## For AI agents`, whose
    first paragraph is a single sentence ending in a period with no links or
    images. Keep them.

  PLACEMENT
    Put the `## For AI agents` block at the very BOTTOM, after the human-facing
    sections. It must never push down what a person reads first.
  ============================================================================
-->

# @gravity-ui/table &middot; [![npm](https://img.shields.io/npm/v/@gravity-ui/table.svg)](https://www.npmjs.com/package/@gravity-ui/table)

<!--
  HEADER (optional, human-facing). Title, badges, and a one-line tagline.
  Badges and images are allowed ONLY here, above the `## For AI agents` block —
  never inside it.
-->

Accessible, virtualized data-grid components for Gravity UI applications.

## Install

<!--
  INSTALL (required). Just the install command — nothing else. It is inlined
  verbatim into the package llms.txt, so keep it copy-pasteable. The heading
  `## Installation` is also accepted.
-->

```shell
npm install @gravity-ui/table
```

## Usage

<!--
  USAGE (required). Open with a MINIMAL, RUNNABLE example, then add example
  subsections for the tasks users actually hit. Include the setup an agent gets
  wrong on its own: the style import, required providers/wrappers, and init
  order. Do NOT hand-list peer dependencies — the pipeline generates them from
  package.json. Accepted heading aliases: `## Getting started`, `## Quick start`.

  This whole section (down to the next `##`) is inlined verbatim into the package
  llms.txt, so every `###` example below travels with it — write them for a
  reader who has only this file.

  STRUCTURE THIS SECTION AS:
    1. the minimal example (below);
    2. a few `### <task>` subsections, each the shortest snippet that answers one
       common "how do I …" question (see "Controlled selection" / "Loading rows
       from a server" below);
    3. a `### More examples` list linking the long tail to runnable recipes —
       docs pages, Storybook stories, or files under examples/.
-->

```tsx
import {ThemeProvider} from '@gravity-ui/uikit';
import {Table} from '@gravity-ui/table';
import '@gravity-ui/table/styles/styles.css'; // required: the grid is unstyled without it

export function App() {
    return (
        <ThemeProvider theme="light">
            <Table data={rows} columns={columns} />
        </ThemeProvider>
    );
}
```

### Controlled selection

<!--
  An inline how-to: the shortest snippet that answers ONE common task. Add a
  handful of these for the tasks users reach for first — controlled state,
  async data, custom rendering — and push the rest to "More examples" below.
-->

```tsx
const [selected, setSelected] = React.useState<string[]>([]);

<Table data={rows} columns={columns} selected={selected} onSelect={setSelected} />;
```

### Loading rows from a server

<!--
  Show the wiring for the second-most-common task. Keep it to the essentials —
  no error handling, no styling — so the pattern is obvious at a glance.
-->

```tsx
const {data, isLoading} = useQuery('rows', fetchRows);

<Table data={data ?? []} columns={columns} loading={isLoading} />;
```

### More examples

<!--
  Link the long tail here, one bullet per real question. Point each link at a
  runnable how-to `.md` file kept in this repo (e.g. docs/how-to-connect.md), so
  the recipe is versioned with the code and travels in the npm tarball. Use
  relative repo paths, not site URLs. Phrase each bullet as the question users ask.
-->

- [How to connect the table in a Create React App project](docs/how-to-connect.md)
- [How to enable row virtualization for large datasets](docs/how-to-virtualize.md)
- [How to render custom cell and header content](docs/how-to-custom-cells.md)
- [How to persist column sizing and order](docs/how-to-persist-state.md)

Full API and live examples: https://gravity-ui.com/components/table

## Development

<!--
  Any other human-facing sections (Development, Contributing, …) go here,
  between Usage and the AI block. The generator does not parse them.
-->

```shell
npm ci
npm test
```

## License

<!--
  LICENSE (required). One line pointing at the LICENSE file. Keep it as a
  top-level `## License` section — the validator fails the build without it.
  Match the license in your package.json and the LICENSE file.
-->

Distributed under the MIT License. See [LICENSE](LICENSE) for details.

<!--
  THE AI BLOCK STARTS BELOW. Read this before editing it:
    • The heading is exactly `## For AI agents` — do not rename or localize it.
    • The FIRST thing after the heading must be the positioning paragraph.
      Do not put a comment, list, or image between the heading and it — the
      generator lifts everything up to the first `###` as the positioning.
    • POSITIONING (required): ONE sentence, one line, ends with a period, no
      links / images / badges. Say what the package does AND when to reach for
      it instead of a neighbor — that distinction is the whole point.
-->

## For AI agents

The data-grid layer for Gravity UI — reach for it to render sortable, selectable, virtualized tables instead of composing raw `<table>` markup on top of `@gravity-ui/uikit` primitives.

### When to use

<!--
  WHEN TO USE (recommended). Bullet the patterns this package is the RIGHT tool
  for. Concrete tasks, not adjectives.
-->

- Rendering large, scrollable datasets that need row virtualization.
- Column sorting, resizing, reordering, and pinning.
- Row selection (single or multi) driven by a controlled selection model.

### When not to use

<!--
  WHEN NOT TO USE (recommended). The highest-value section for an agent: for
  each case this package is wrong for, point to the correct NEIGHBOR with a
  one-line reason and a link. This is where you stop a model reaching for the
  wrong tool.
-->

- For a plain static list, use the `List` component from [`@gravity-ui/uikit`](https://gravity-ui.com/components/list) — virtualization here is overhead you do not need.
- For inline-editable, spreadsheet-like cells, this package is read-focused; use a dedicated editable-grid library instead.

### Common pitfalls

<!--
  COMMON PITFALLS / HALLUCINATION TRAPS (recommended). List the names models
  invent and the real ones, plus import / SSR / theming gotchas. Format each
  line as: the wrong thing, then the right thing.
-->

- **Hallucinated prop `rows`** — the data prop is `data`, not `rows`.
- **Hallucinated component `<DataGrid>`** — the export is `<Table>`.
- Omitting `import '@gravity-ui/table/styles/styles.css'` renders an unstyled grid.

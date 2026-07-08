<!--
  ============================================================================
  IDEAL COMPONENT README — a filled, self-documenting template.

  For component packages (uikit and friends), every component has its own
  README.md. Copy this file next to the component, replace the FICTIONAL
  `Table` content with your own, and delete these guidance comments.

  WHY IT MATTERS
    The generator builds the component index from the FIRST prose line of each
    component README, taken verbatim. Everything here stays short and factual.

  VALIDATION
    Passes `gravity-readme --component README.md`. Hard rules: a one-sentence
    description as the first content after the title, a `## Properties` section,
    and at least one code example.
  ============================================================================
-->

# Table

<!--
  DESCRIPTION (required). The FIRST prose line after the title. Make it ONE real
  sentence (ends with a period), not a fragment or a table cell — the generator
  lifts it verbatim into the component index. A comment like this one may sit
  between the title and the description; the parser skips it.
-->

A virtualized data grid with column sorting, row selection, and pinned columns.

## Properties

<!--
  PROPERTIES (required). Props as a table with the columns
  `Name | Type | Default | Description`. The heading `## Props` is also accepted.
  Backtick the prop names and types. Use `—` for a required prop with no default.
-->

| Name       | Type                      | Default | Description                       |
| ---------- | ------------------------- | ------- | --------------------------------- |
| `data`     | `Row[]`                   | —       | Rows to render.                   |
| `columns`  | `Column[]`                | —       | Column definitions.               |
| `selected` | `string[]`                | `[]`    | Ids of the currently selected rows. |
| `onSelect` | `(ids: string[]) => void` | —       | Called when the selection changes. |

## Example

<!--
  EXAMPLE (required). ONE minimal, runnable snippet — the shortest code that
  renders the component. No verbose "for the designer" walkthroughs.
-->

```tsx
import {Table} from '@gravity-ui/table';

<Table data={rows} columns={columns} />;
```

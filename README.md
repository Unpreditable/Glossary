# Smart Glossary

Highlight the acronyms and terms your glossary defines wherever a note mentions them, and read the
definition on hover. Keep the glossary itself in ordinary Markdown tables, and edit them in a
table view.

---

## Features

- **Highlights in the editor**: acronyms and full terms from your glossary notes are marked in
  Live Preview and Source mode. Plurals of acronyms count too ("APIs" for "API").
- **Definition on hover**: the term, its full form, the description, and the glossary note it
  comes from.
- **Glossary View**: a glossary note opens as editable tables, with search and resizable columns.
- **Add to glossary**: right-click a word in any note to add it as a term.
- **Matching options**: case sensitivity for full terms, fuzzy matching for near-spellings,
  exclusion lists, and folders to include or skip.
- **11 highlight styles**: ten gradients or a solid underline in a color you choose.

---

## Writing a glossary

A glossary is any note whose frontmatter tags include `glossary`:

```markdown
---
tags: [glossary]
---

| Acronym | Full term | Description |
|---|---|---|
| API | Application Programming Interface | A contract between programs |
| CPU | Central Processing Unit | Executes instructions |
```

- **Three columns**: acronym, full term, description. Either the acronym or the full term may be
  empty.
- **Two columns**: acronym and description.
- A note can hold several tables, and the vault can hold several glossary notes. A term defined in
  more than one place shows the first definition, with a count of the others.
- Write a `|` inside a cell as `\|`.
- Tables with any other number of columns are ignored.

Acronyms always match with exact case. Full terms ignore case unless you turn on **Case
sensitive**.

---

## The Glossary View

A glossary note opens as tables instead of Markdown.

- Click a cell to edit it. **Tab** and the arrow keys move between cells, and **Enter** moves to the
  next row. Changes are saved to the note when you leave the cell.
- **+ Add term** adds a row. New terms are written to the note in alphabetical order and appear
  there in the view the next time you open it.
- Drag a column border to resize. The widths are saved in the note, as a
  `%%glossary_column_width=…%%` comment above the table.
- **Search terms** filters the rows.
- **View source** switches the tab to the Markdown editor. **Open as Glossary View** above the
  editor switches back.

---

## Adding a term from a note

Select a word, or put the cursor on it, then right-click and choose **Add to glossary**.

- Fill in at least two of acronym, full term, and description.
- Pick the glossary note when you have more than one.
- Existing entries with the same acronym or full term are listed before you add.

The term goes into the first table with the right number of columns, in alphabetical order. A note
with no such table gets a new one at the end.

---

## Settings

| Setting | What it does |
|---|---|
| Match by | Highlight acronyms, full terms, or both, from 3-column tables. 2-column tables always match by acronym. |
| Case sensitive | Match full terms with exact case. |
| Fuzzy matching | Also match near-spellings of single-word full terms. |
| Exclude acronyms / Exclude terms | Comma-separated entries never to highlight. |
| Highlight style | Ten gradients or a solid underline. |
| Highlight color | The underline color for the solid style. |
| Include folders | Only highlight notes in these folders. Empty means all folders. |
| Exclude folders | Never highlight notes in these folders. |

The **Refresh glossary index** command re-reads every glossary note at once. It normally happens by
itself a few seconds after a glossary changes.

---

## Scope

- Highlighting works in the editor (Live Preview and Source mode), not in Reading view.
- Text inside inline code and fenced code blocks is not highlighted.
- Glossary notes themselves are not highlighted.

---

## Installation

Smart Glossary is not in the community plugin directory yet. To install it by hand, copy `main.js`,
`manifest.json` and `styles.css` from a release into `<vault>/.obsidian/plugins/glossary/`, then turn
it on under **Settings → Community plugins**.

---

## Development

```bash
npm install
npm run dev        # watch mode
npm run build      # typecheck + production bundle
npm test           # unit tests
npm run test:e2e   # end-to-end tests in a sandboxed Obsidian; see e2e/README.md
```

---

## More plugins by the author

- **[Kalendae](https://community.obsidian.md/plugins/kalendae)** — Change a date or a time already in your note with a calendar, a clock, or Ctrl/Option + ↑/↓, instead of retyping it.
- **[GTD Tasks](https://community.obsidian.md/plugins/gtd-tasks)** — Gather tasks from across your notes into one sidebar, sorted into the Getting Things Done horizons: Today, This Week, Next Week, This Month and Someday. Works with the Tasks plugin.
- **[Littera Nexa](https://community.obsidian.md/plugins/littera-nexa)** — Link to a note by typing its name, with no `[[` needed. It suggests notes and aliases as you type.
- **[LeapFrog](https://community.obsidian.md/plugins/leapfrog)** — Jump to the top or bottom of a note in one click, with floating buttons or commands, and back again.

---

## License

[GPL-3.0-only](LICENSE)

# End-to-end tests

These tests drive a real Obsidian and check what a person using the plugin would see and what ends
up in the note. They run on your own machine only; they are not part of CI.

The code that runs them is not here. It is the ObsidianE2EHarness repo, checked out in the folder
beside this one (`../ObsidianE2EHarness`) with `npm install` run in it once. Its README has the
helpers a spec can use and what to look at when a test fails (`e2e/.output/`).

```bash
npm run test:e2e                          # build the plugin, then run every spec
npm run test:e2e -- --spec glossaryView   # only the spec files whose path contains "glossaryView"
npm run test:all                          # the unit tests, then every spec
```

An Obsidian window opens and takes the keyboard until the run ends, so leave the machine alone
meanwhile.

## What is here

| Path | What |
|---|---|
| `e2e.config.json` | The Obsidian version the specs run with; no third-party plugins |
| `vault/Glossary.md` | A glossary note with two tables; the second has an empty row in the middle |
| `vault/Notes.md` | A note that mentions a defined acronym |
| `specs/glossaryView.e2e.ts` | The Glossary View: editing, adding a term, column widths, staying open on reload, switching to and from the Markdown editor |
| `specs/highlight.e2e.ts` | Terms highlighted in the editor |
| `specs/matching.e2e.ts` | Plurals, full terms, and the matching settings (match by, case, fuzzy, exclusions) seen in the editor |
| `specs/scope.e2e.ts` | Which notes get highlights (included and excluded folders, not glossary notes) and not in code |
| `specs/tooltip.e2e.ts` | The definition shown on hovering a highlight |
| `specs/addTerm.e2e.ts` | "Add to glossary" in the editor's right-click menu and the form it opens |
| `specs/settings.e2e.ts` | The settings tab. Settings open in a window of their own, so specs reach it through `app.setting.activeTab.containerEl`, not `document` |
| `tsconfig.json` | Type-checks the specs |
| `harness.d.ts` | The harness's declarations of everything a spec can use. A copy: do not edit it |

The spec files have no imports, and must stay that way: `describe`, `it`, `expect`, `browser` and
the helpers are globals the harness provides. Obsidian's plugin review reads every TypeScript file
in this repo as plugin code, and objects to an import of anything that is not a dependency of the
plugin.

A run refuses to start while `harness.d.ts` differs from the harness's own; refresh it with
`node ../ObsidianE2EHarness/bin/obsidian-e2e.mjs --update-types`.

Things the specs work around:

- The harness's reset closes notes, not custom views, so `openGlossary()` closes Glossary View tabs
  itself first. It doesn't close modals either: the add-term spec presses Escape after each test.
- `setPluginSettings` only saves. Specs that change a matching setting then call
  `buildGlossaryIndex`, as the settings tab does.
- Hovering and right-clicking are mouse events dispatched at the text's position: CodeMirror's
  hover tooltip reads `mousemove`, Obsidian's editor menu reads `contextmenu`.
- WebDriver's `setValue` blurs an input after clearing it, which ends a cell edit; cells are typed
  into with `browser.keys`.
- The harness's `togglePlugin` turns the plugin off as Settings does, and Obsidian then closes its
  views. The reload test uses `plugins.disablePlugin`/`enablePlugin`, as Hot Reload and updates do.

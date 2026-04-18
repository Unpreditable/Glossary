# Glossary Plugin — Full Design Spec

**Date:** 2026-04-18  
**Status:** Approved

## Background

This project is a modular rewrite of a monolithic Obsidian plugin (`reference/main.js`). The rewrite already has a better architecture (per-file modules, per-line cache, dual code-block detection) but is missing three features from the reference: a Settings Tab, a hover tooltip, and file-filtering correctness. After reaching parity, three new features are added.

---

## Phase 1 — Fix `shouldProcessFile` bug

**Problem:** `GlossaryViewPlugin.buildDecorations()` never checks whether the currently active file is in an included/excluded folder. All markdown files get decorated regardless of settings.

**Fix:** At the top of `buildDecorations()`, call `this.plugin.matcher.shouldProcessFile(app, activeFile)`. Return `Decoration.none` early if false. Also clear the line cache on early return.

**Files changed:** `src/decorations/glossaryViewPlugin.ts` (1–2 lines).

---

## Phase 2 — Settings Tab UI

**New file:** `src/settings/settingsTab.ts` — `GlossarySettingTab extends PluginSettingTab`.

**Controls:**
| Setting | Control |
|---|---|
| `matchBy` | Dropdown: Acronym only / Term only / Acronym and Term |
| `caseSensitive` | Toggle |
| `fuzzyMatching` | Toggle |
| `excludeAcronyms` | Text input (comma-separated), shown when matchBy includes acronym |
| `excludeTerms` | Text input (comma-separated), shown when matchBy includes term |
| `includeFolders` | Text input (comma-separated) |
| `excludeFolders` | Text input (comma-separated) |
| `highlightStyle` | Dropdown: 10 gradients + Solid |
| `highlightColor` | Color picker, shown only when highlightStyle === 'solid' |
| Preview | Live `.glossary-preview` span reflecting current style |

**On any change:** `plugin.saveSettings()` → `plugin.refreshStyles()` → `plugin.buildGlossaryIndex()`.

**Registration:** `this.addSettingTab(new GlossarySettingTab(this.app, this))` in `main.ts`.

---

## Phase 3 — Hover Tooltip

**New file:** `src/decorations/tooltipExtension.ts`.

Uses `hoverTooltip` from `@codemirror/view`. On hover over a decorated range:
1. Retrieves `data-terms` JSON from the decoration attribute
2. Renders a tooltip DOM node with: term/acronym (bold), description, source file (muted small text)
3. Shows "(+N more definitions)" if multiple terms share the match

**Style:** Uses Obsidian CSS variables. Exact visual style (minimal-native / callout-card / definition-hierarchy) to be decided at implementation time — three options documented in the tooltip extension file header.

**Registration:** Added to `registerEditorExtension([viewPlugin, tooltipExtension])` in `main.ts`.

---

## Phase 4 — Quick-Add (REVIEW REQUIRED before implementation)

**Trigger:** `editor-menu` event in `main.ts`. Menu item "Add to glossary" appears only when editor has a selection.

**New file:** `src/glossary/addTermModal.ts` — `AddTermModal extends Modal`.

**Modal fields:**
- Acronym (text input)
- Full term (text input)
- Description (text input)
- Target file (dropdown of all glossary-tagged files; pre-populated if only one exists)

**Pre-fill logic:** Selected text → if all-caps and ≤ 6 chars, pre-fill Acronym; otherwise pre-fill Full term.

**On submit:** 
- Reads target file content
- Finds last `|`-delimited table row; appends new row after it
- If no table exists: creates header + separator + row (3-col if Full term populated, 2-col otherwise)
- Calls `plugin.buildGlossaryIndex()` (immediate, not debounced)

**Clarify at implementation:** field validation, duplicate detection, success feedback (Notice).

---

## Phase 5 — Custom Glossary View

**New file:** `src/glossary/glossaryView.ts` — `GlossaryItemView extends ItemView`.

**Registration:** `this.registerView(GLOSSARY_VIEW_TYPE, ...)` in `main.ts`. When a glossary-tagged file is opened, route it to this view.

**UI:**
- Search/filter bar (filters cards by any field in real time)
- Scrollable card list: each card shows acronym, full term, description, source file chip
- "Add term" button → opens `AddTermModal`
- "View source" button → reopens the file in standard markdown editor

**Data source:** Reads from `plugin.termIndex` directly (no extra parsing). Refreshes when index rebuilds.

**Clarify at implementation:** sort order (alpha by acronym? by file?), edit-in-place vs modal for existing entries, multi-file grouping display.

---

## Phase 6 — Reading View Support (nice to have)

**Mechanism:** `this.registerMarkdownPostProcessor(...)` in `main.ts`.

**Logic:**
- Walk rendered HTML subtree
- Find text nodes; run `TermMatcher.findTermsInText()` against each
- Wrap matches in `<span class="cm-glossary-highlight" data-terms="...">` 
- Attach tooltip via DOM `mouseover` listener (CodeMirror `hoverTooltip` is not available in reading view)
- Skip `<code>` and `<pre>` elements

**Shares:** `TermMatcher` instance from the plugin — no duplication of matching logic.

**Clarify at implementation:** performance on large notes, whether to reuse tooltip DOM from Phase 3 or build a simpler standalone version.

---

## File structure after all phases

```
src/
  main.ts
  settings.ts
  settings/
    settingsTab.ts          (Phase 2)
  index/
    glossaryDetector.ts
    tableParser.ts
    termIndex.ts
  matcher/
    termMatcher.ts
    codeBlockDetector.ts
  decorations/
    glossaryViewPlugin.ts
    cssInjector.ts
    tooltipExtension.ts     (Phase 3)
  glossary/
    addTermModal.ts         (Phase 4)
    glossaryView.ts         (Phase 5)
reference/
  main.js                   (read-only feature reference)
docs/
  superpowers/specs/
    2026-04-18-glossary-plugin-design.md
```

---

## Key constraints (unchanged)

- All `@codemirror/*`, `@lezer/*`, `obsidian` packages are external — never bundled
- `baseUrl: "src"` in tsconfig — root-relative imports within `src/`
- Minimum Obsidian version: 1.9.12 (CM6 only)
- After every code change: run `npm run build`
- Phase 4 requires explicit review checkpoint before implementation begins

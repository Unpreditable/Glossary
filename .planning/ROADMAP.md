# Roadmap: Smart Glossary

## Overview

A bottom-up rebuild of an Obsidian plugin that highlights glossary terms in notes and shows definitions on hover. The build follows the strict data dependency chain: scaffold first, then settings types, then glossary detection and index pipeline, then match logic and code block exclusion, then CM6 decorations and styles, then hover tooltip, and finally the settings UI that ties everything together.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Scaffold** - TypeScript + esbuild project compiles, plugin skeleton loads in Obsidian, hot-reload works (completed 2026-03-21)
- [x] **Phase 2: Settings Data Model** - All settings types and defaults defined, loadData/saveData persistence verified (completed 2026-03-21)
- [x] **Phase 3: Glossary File Detection** - isGlossaryFile works, vault event listeners registered, index rebuilds on save (completed 2026-03-22)
- [x] **Phase 4: Table Parsing + Term Index** - parseGlossaryFile handles 2-col and 3-col tables, plural handling, exclude lists (completed 2026-03-22)
- [x] **Phase 5: Match Logic + Code Block Detection** - findTermsInText, fuzzy/edit-distance, overlap deduplication, code block exclusion via syntaxTree (completed 2026-03-24)
- [ ] **Phase 6: Decorations + Highlight Styles** - GlossaryViewPlugin CM6 ViewPlugin, RangeSetBuilder, gradient + solid highlight CSS injection
- [ ] **Phase 7: Hover Tooltip** - createTooltipExtension, tooltip DOM, data-terms reading, +N more, source file display
- [ ] **Phase 8: Settings Tab UI** - GlossarySettingTab, all controls, conditional rendering, live preview, back button, refresh command

## Phase Details

### Phase 1: Scaffold
**Goal**: A compilable TypeScript + esbuild project that loads as a valid Obsidian plugin with a working settings object
**Depends on**: Nothing (first phase)
**Requirements**: FOUND-01
**Success Criteria** (what must be TRUE):
  1. `npm run build` produces `main.js` in CJS format with all @codemirror/* packages externalized (not bundled)
  2. Obsidian loads the plugin without errors and shows it in the community plugins list
  3. The plugin's ribbon icon or notice confirms onload() ran successfully
**Plans**: 1 plan

Plans:
- [x] 01-01-PLAN.md — Build toolchain + plugin skeleton (package.json, esbuild config, tsconfig, ESLint, src/main.ts)

### Phase 2: Settings Data Model
**Goal**: All settings types, field names, and defaults exist in code and survive a plugin reload via Obsidian's loadData/saveData
**Depends on**: Phase 1
**Requirements**: FOUND-02
**Success Criteria** (what must be TRUE):
  1. All nine settings fields (matchBy, caseSensitive, fuzzyMatching, excludeAcronyms, excludeTerms, includeFolders, excludeFolders, highlightStyle, highlightColor) exist as typed properties with correct default values
  2. Changing a setting, reloading Obsidian, and re-opening settings shows the persisted value (not the default)
  3. A fresh install with no saved data applies all defaults without error
**Plans**: 1 plan

Plans:
- [x] 02-01-PLAN.md — Settings types + defaults (src/settings.ts) and persistence wiring (src/main.ts)

### Phase 3: Glossary File Detection
**Goal**: The plugin correctly identifies glossary files, waits for Obsidian's metadata cache to be ready before building the initial index, and rebuilds automatically when glossary files change
**Depends on**: Phase 2
**Requirements**: INDX-01, INDX-05, INDX-06, INDX-07
**Success Criteria** (what must be TRUE):
  1. A file with `tags: glossary` (or `tags: [glossary, ...]`) in frontmatter is identified as a glossary file; a file without that tag is not
  2. On vault load, the index is not empty — the initial build fires after onLayoutReady, not before
  3. Saving a glossary file triggers an automatic index rebuild within ~300ms (debounced)
  4. Running "Refresh glossary index" from the command palette triggers a manual rebuild and shows a notice
**Plans**: 1 plan

Plans:
- [x] 03-01-PLAN.md — GlossaryTerm interface, termIndex, isGlossaryFile(), debounced modify listener, onLayoutReady initial build, refresh command (src/main.ts)

### Phase 4: Table Parsing + Term Index
**Goal**: Glossary markdown tables are fully parsed into a usable term index, including 2-col and 3-col formats, automatic plural variants, and per-entry exclusion filtering
**Depends on**: Phase 3
**Requirements**: INDX-02, INDX-03, INDX-04, MATC-05, MATC-06
**Success Criteria** (what must be TRUE):
  1. A 2-column table row (acronym | description) produces an index entry with acronym and description populated
  2. A 3-column table row (acronym | full term | description) produces an index entry with all three fields populated
  3. An acronym "API" in any glossary table also matches "APIs" (plural auto-indexed as a separate entry)
  4. An acronym listed in excludeAcronyms is not present in the built index
  5. A term listed in excludeTerms is not present in the built index
**Plans**: 2 plans

Plans:
- [x] 04-01-PLAN.md — Create src/index/ module files (termIndex.ts, glossaryDetector.ts, tableParser.ts)
- [x] 04-02-PLAN.md — Wire main.ts to use src/index/ modules, verify parsing behaviors in Obsidian

### Phase 5: Match Logic + Code Block Detection
**Goal**: The matching engine correctly finds terms in editor text — respecting matchBy, case sensitivity, fuzzy threshold, overlap rules, and code block boundaries — and emits sorted, deduplicated match ranges
**Depends on**: Phase 4
**Requirements**: MATC-01, MATC-02, MATC-03, MATC-04, HIGH-02, HIGH-03, FOLD-01, FOLD-02
**Success Criteria** (what must be TRUE):
  1. With matchBy=acronym only acronyms are matched; with matchBy=term only full terms; with matchBy=both, both are matched
  2. Terms inside inline code spans and fenced code blocks are never included in match results
  3. Glossary files themselves produce no matches (the file being edited is checked against isGlossaryFile)
  4. When an acronym and a full-term match overlap at the same position, only one decoration is emitted (acronym wins)
  5. Notes inside includeFolders paths receive highlighting; notes inside excludeFolders paths do not
  6. Fuzzy matching (when enabled) finds full terms within the configured edit-distance threshold; exact matching (when disabled) does not produce fuzzy hits
**Plans**: 2 plans

Plans:
- [ ] 05-01-PLAN.md — Jest test infrastructure + TermMatcher class (src/matcher/termMatcher.ts) via TDD
- [ ] 05-02-PLAN.md — codeBlockDetector.ts (CM6 syntax tree) + main.ts matcher wiring + Obsidian verification

### Phase 6: Decorations + Highlight Styles
**Goal**: Matched terms are visibly decorated in the CodeMirror editor using the correct highlight style, with CSS injected correctly and styles updating when settings change
**Depends on**: Phase 5
**Requirements**: HIGH-01, HIGH-04, HIGH-05
**Success Criteria** (what must be TRUE):
  1. Matched terms in an open note are visually highlighted (gradient or solid style visible) without any console errors
  2. All 10 gradient styles (gradient1–gradient10) are selectable and each produces a distinct visible appearance
  3. The solid style uses the custom color from the color picker and updates within one keystroke of changing the color
  4. Decorations cover only the visible viewport ranges, not the full document
**Plans**: 2 plans

Plans:
- [ ] 06-01-PLAN.md — cssInjector.ts TDD (buildStylesheet pure function, 10 gradient values, solid style)
- [ ] 06-02-PLAN.md — GlossaryViewPlugin (incremental cache) + main.ts wiring + Obsidian verification

### Phase 7: Hover Tooltip
**Goal**: Hovering a highlighted term shows a well-formed tooltip with the term's full data and handles multi-definition terms correctly
**Depends on**: Phase 6
**Requirements**: TOOL-01, TOOL-02, TOOL-03
**Success Criteria** (what must be TRUE):
  1. Hovering a highlighted term shows a tooltip containing the acronym, full term (if present), and description
  2. The tooltip displays the source glossary file's name
  3. When multiple glossary entries define the same term, the tooltip shows the first entry plus a "+N more" indicator for the remaining count
  4. Hovering unhighlighted text shows no tooltip
**Plans**: 2 plans

Plans:
- [ ] 07-01-PLAN.md — TBD
- [ ] 07-02-PLAN.md — TBD

### Phase 8: Settings Tab UI
**Goal**: The settings tab exposes all plugin configuration with correct labels, conditional visibility, a live highlight preview, and a back button that returns to the main settings list
**Depends on**: Phase 7
**Requirements**: SETT-01, SETT-02, SETT-03
**Success Criteria** (what must be TRUE):
  1. Every setting (matchBy, caseSensitive, fuzzyMatching, excludeAcronyms, excludeTerms, includeFolders, excludeFolders, highlightStyle, highlightColor) is visible in the settings tab with a label and description
  2. The excludeAcronyms control is only shown when matchBy includes acronyms; the excludeTerms control is only shown when matchBy includes terms
  3. Changing the highlight style in settings immediately updates the live preview swatch without requiring a plugin reload
  4. The settings tab includes a back button that returns focus to Obsidian's main settings list
**Plans**: 2 plans

Plans:
- [ ] 08-01-PLAN.md — TBD
- [ ] 08-02-PLAN.md — TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Scaffold | 1/1 | Complete   | 2026-03-21 |
| 2. Settings Data Model | 1/1 | Complete   | 2026-03-21 |
| 3. Glossary File Detection | 1/1 | Complete   | 2026-03-22 |
| 4. Table Parsing + Term Index | 2/2 | Complete   | 2026-03-24 |
| 5. Match Logic + Code Block Detection | 2/2 | Complete   | 2026-03-24 |
| 6. Decorations + Highlight Styles | 1/2 | In Progress|  |
| 7. Hover Tooltip | 0/TBD | Not started | - |
| 8. Settings Tab UI | 0/TBD | Not started | - |

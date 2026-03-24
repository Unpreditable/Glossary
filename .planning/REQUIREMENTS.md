# Requirements: Smart Glossary

**Defined:** 2026-03-20
**Core Value:** Terms defined in glossary files must be highlighted in notes and show their definition on hover — reliably, without breaking the editing experience.

## v1 Requirements

This is a fidelity rebuild. All requirements are in scope — no v2 deferral.

### Foundation

- [x] **FOUND-01**: TypeScript + esbuild project compiles to `main.js` with correct Obsidian plugin structure (manifest.json, CJS format, all @codemirror/* externalized)
- [x] **FOUND-02**: Plugin settings model persists via `loadData()`/`saveData()` with all fields and defaults (matchBy, caseSensitive, fuzzyMatching, excludeAcronyms, excludeTerms, includeFolders, excludeFolders, highlightStyle, highlightColor)

### Glossary Index

- [x] **INDX-01**: Files with `tags: glossary` (or `tags: [glossary, ...]`) in frontmatter are identified as glossary files
- [x] **INDX-02**: 2-column markdown tables (acronym | description) parsed into term index
- [x] **INDX-03**: 3-column markdown tables (acronym | full term | description) parsed into term index
- [x] **INDX-04**: Plural forms of acronyms are auto-indexed (e.g. "API" also matches "APIs")
- [x] **INDX-05**: Index rebuilds automatically when a glossary file is saved
- [x] **INDX-06**: Initial index build waits for Obsidian's layout/metadata to be ready (avoids empty index on vault load)
- [x] **INDX-07**: Index can be manually refreshed via command palette

### Matching

- [x] **MATC-01**: Terms matched by acronym only, full term only, or both (configurable via matchBy setting)
- [x] **MATC-02**: Case sensitivity configurable — acronyms always case-sensitive in 2-col tables; configurable for 3-col table terms
- [x] **MATC-03**: Fuzzy matching for full terms via Levenshtein edit-distance (configurable; threshold scales with term length)
- [x] **MATC-04**: Overlapping matches resolved without duplication (acronym wins at same position when both match)
- [x] **MATC-05**: Specific acronyms can be excluded from matching via excludeAcronyms list
- [x] **MATC-06**: Specific terms can be excluded from matching via excludeTerms list

### Highlighting

- [ ] **HIGH-01**: Matched terms decorated with highlight mark in CodeMirror editor (visible ranges only, not full document)
- [x] **HIGH-02**: Terms inside inline code spans and fenced code blocks are not highlighted
- [x] **HIGH-03**: Glossary files themselves are not highlighted (terms defined there are not decorated)
- [ ] **HIGH-04**: 10 named gradient highlight styles available (gradient1–gradient10)
- [ ] **HIGH-05**: Solid highlight style available with custom color picker

### Tooltip

- [ ] **TOOL-01**: Hovering a highlighted term shows tooltip with the term's acronym, full term, and description (whichever fields are populated)
- [ ] **TOOL-02**: Tooltip displays the source glossary file name
- [ ] **TOOL-03**: Tooltip shows "+N more" indicator when multiple glossary entries define the same term

### Folder Scoping

- [x] **FOLD-01**: includeFolders setting limits highlighting to notes inside specified folder paths
- [x] **FOLD-02**: excludeFolders setting skips highlighting for notes inside specified folder paths

### Settings UI

- [ ] **SETT-01**: Settings tab displays all configuration options with labels and descriptions
- [ ] **SETT-02**: Exclude acronyms and exclude terms controls only shown when relevant matchBy option is active
- [ ] **SETT-03**: Live highlight preview in settings tab updates when style selection changes

## v2 Requirements

*(None — this is a full-parity rebuild; all features are v1)*

## Out of Scope

| Feature | Reason |
|---------|--------|
| Reading Mode / Preview Mode highlighting | Requires different rendering approach; not in original |
| Backlink / graph integration | Not in original; separate concern |
| Glossary file creation or editing | Not in original; out of scope per PROJECT.md |
| Mobile-specific optimizations | Not a priority; isDesktopOnly: false but not optimized |
| Community plugin store publication | Personal use rebuild |
| Per-note disable toggle | Not in original |
| Multiple simultaneous tooltips | Not in original |
| Inline edit from tooltip | Not in original |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| FOUND-01 | Phase 1 | Complete |
| FOUND-02 | Phase 2 | Complete |
| INDX-01 | Phase 3 | Complete |
| INDX-05 | Phase 3 | Complete |
| INDX-06 | Phase 3 | Complete |
| INDX-07 | Phase 3 | Complete |
| INDX-02 | Phase 4 | Complete |
| INDX-03 | Phase 4 | Complete |
| INDX-04 | Phase 4 | Complete |
| MATC-05 | Phase 4 | Complete |
| MATC-06 | Phase 4 | Complete |
| MATC-01 | Phase 5 | Complete |
| MATC-02 | Phase 5 | Complete |
| MATC-03 | Phase 5 | Complete |
| MATC-04 | Phase 5 | Complete |
| HIGH-02 | Phase 5 | Complete |
| HIGH-03 | Phase 5 | Complete |
| FOLD-01 | Phase 5 | Complete |
| FOLD-02 | Phase 5 | Complete |
| HIGH-01 | Phase 6 | Pending |
| HIGH-04 | Phase 6 | Pending |
| HIGH-05 | Phase 6 | Pending |
| TOOL-01 | Phase 7 | Pending |
| TOOL-02 | Phase 7 | Pending |
| TOOL-03 | Phase 7 | Pending |
| SETT-01 | Phase 8 | Pending |
| SETT-02 | Phase 8 | Pending |
| SETT-03 | Phase 8 | Pending |

**Coverage:**
- v1 requirements: 28 total
- Mapped to phases: 28
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-20*
*Last updated: 2026-03-21 — traceability populated during roadmap creation*

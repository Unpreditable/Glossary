# Smart Glossary

## What This Is

An Obsidian plugin that highlights glossary terms in notes and shows definitions on hover. Glossary files are identified by a `#glossary` frontmatter tag and contain definitions in markdown tables. The plugin scans notes in real-time and decorates matching terms using CodeMirror extensions.

## Core Value

Terms defined in glossary files must be highlighted in notes and show their definition on hover — reliably, without breaking the editing experience.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Detect glossary files by `#glossary` frontmatter tag
- [ ] Parse glossary tables (2-column: acronym | description; 3-column: acronym | full term | description)
- [ ] Highlight matching terms in notes using CodeMirror decorations
- [ ] Show hover tooltip with term definition (acronym, full term, description, source file)
- [ ] Skip highlighting inside code blocks (inline and fenced)
- [ ] Rebuild index when a glossary file is modified
- [ ] Settings: match by acronym / term / both
- [ ] Settings: case sensitive toggle
- [ ] Settings: fuzzy matching toggle (edit-distance based, terms only)
- [ ] Settings: include/exclude folders for which notes to process
- [ ] Settings: exclude specific acronyms and terms from highlighting
- [ ] Settings: highlight style (10 gradients + solid with custom color)
- [ ] Command: "Refresh glossary index" manual trigger
- [ ] Automatically index plural forms of acronyms (e.g. "API" also matches "APIs")

### Out of Scope

- Publishing to Obsidian community plugins — personal use rebuild
- Mobile-specific optimizations — isDesktopOnly is false but not a priority

## Context

- The compiled `main.js` exists in the project root and serves as the complete behavioral reference
- Built with TypeScript, bundled with esbuild, uses `@codemirror/view`, `@codemirror/state`, `@codemirror/language`
- Obsidian API minimum version: 1.9.12
- Settings are persisted via Obsidian's `loadData()`/`saveData()` API
- Highlight implementation uses CSS gradient text + border-image trick for gradient styles, underline + background tint for solid style

## Constraints

- **Tech Stack**: TypeScript + esbuild — matches original build setup
- **Obsidian API**: Must use CodeMirror 6 ViewPlugin/Decoration API (not legacy CM5)
- **Compatibility**: minAppVersion 1.9.12

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Use compiled main.js as source of truth | Source was lost; compiled output is the complete spec | — Pending |
| Recreate exact feature set first | New features will be additive, not structural changes | — Pending |

---
*Last updated: 2026-03-20 after initialization*

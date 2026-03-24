---
phase: 06-decorations-highlight-styles
plan: 02
subsystem: ui
tags: [codemirror, viewplugin, decorations, highlights, css, incremental-cache, lezer]

# Dependency graph
requires:
  - phase: 06-01
    provides: cssInjector (injectGlossaryStyles, removeGlossaryStyles, buildStylesheet)
  - phase: 05-02
    provides: TermMatcher.findTermsInText, isInCodeBlock
provides:
  - GlossaryViewPlugin CM6 ViewPlugin with incremental line-cache decoration engine
  - createGlossaryViewPlugin factory for closure-based plugin instantiation
  - main.ts wiring: CSS lifecycle, ViewPlugin registration, refreshStyles()
  - Text-based fenced code block exclusion (computeFencedLineOffsets)
  - Text-based inline code span exclusion (isInInlineCode)
affects: [07-hover-popup, 08-settings-ui]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - CM6 ViewPlugin with closure factory pattern for constructor args
    - Incremental line cache (Map<lineFrom, TermMatch[]>) with evict-on-change
    - Two-pass decoration build: populate cache (visible + lookahead), then add visible only
    - Structural PluginRef interface to avoid circular main.ts <-> glossaryViewPlugin.ts import
    - eslint-disable for .cm EditorView cast (no-explicit-any + no-unsafe-member-access)
    - Text-based fenced block tracking supplements Lezer syntaxTree (Obsidian node name variations)
    - Text-based inline code span check via /`([^`]+)`/g regex per line

key-files:
  created:
    - src/decorations/glossaryViewPlugin.ts
  modified:
    - tests/decorations/glossaryViewPlugin.test.ts
    - src/main.ts
    - src/decorations/cssInjector.ts
    - src/matcher/codeBlockDetector.ts
    - tests/decorations/cssInjector.test.ts

key-decisions:
  - "Used PluginRef structural interface in glossaryViewPlugin.ts instead of importing GlossaryPlugin class — avoids circular dependency"
  - "LOOKAHEAD_BYTES=4000 constant (approx 50 lines) for lookahead buffer past visible viewport"
  - "Cursor-only update guard: return early if !docChanged && !viewportChanged — no unnecessary re-scans"
  - "forceRebuild clears entire lineCache before rebuild — guarantees fresh CSS after settings change"
  - "data-terms attribute stores JSON.stringify(match.terms) — Phase 7 hover popup contract"
  - "Text-based fenced block detection (computeFencedLineOffsets) is primary exclusion — Lezer node names vary across Obsidian versions"
  - "Solid highlight style is underline-only — background-color removed after Obsidian verification revealed unwanted word tinting"

patterns-established:
  - "CM6 ViewPlugin factory: export function createGlossaryViewPlugin(plugin: PluginRef) { return ViewPlugin.fromClass(class extends GlossaryViewPlugin { constructor(view) { super(view, plugin); } }, { decorations: (v) => v.decorations }); }"
  - "refreshStyles(): re-inject CSS + forceRebuild=true + dispatch({}) on all open MarkdownView editors"
  - "Code block exclusion: text-based fence tracking + isInInlineCode + isInCodeBlock (Lezer) applied in that order"

requirements-completed: [HIGH-01, HIGH-04, HIGH-05]

# Metrics
duration: 40min
completed: 2026-03-24
---

# Phase 6 Plan 02: GlossaryViewPlugin + main.ts Wiring Summary

**CM6 ViewPlugin with incremental line-cache decorating matched glossary terms with text-based fenced/inline code exclusion, verified in Obsidian with 3 bugs fixed**

## Performance

- **Duration:** ~40 min (15 min initial + 25 min bug-fix continuation)
- **Started:** 2026-03-24T04:10:47Z
- **Completed:** 2026-03-24T04:55:00Z
- **Tasks:** 3 (all complete)
- **Files modified:** 6

## Accomplishments

- GlossaryViewPlugin with incremental line cache: evict-on-change, 50-line lookahead buffer, cursor-only no-op guard
- createGlossaryViewPlugin factory using closure pattern (avoids circular import via PluginRef structural interface)
- main.ts wiring: injectGlossaryStyles on load, removeGlossaryStyles on unload, registerEditorExtension, refreshStyles()
- Three Obsidian bugs fixed: solid style background tint removed, inline code spans excluded, fenced code block detection made reliable via text-based scanning
- All 49 tests pass, build succeeds, eslint = 0 errors

## Task Commits

Each task was committed atomically:

1. **Task 1: GlossaryViewPlugin + cache unit tests** - `b69a609` (feat — TDD GREEN)
2. **Task 2: Wire main.ts** - `ca342f1` (feat)
3. **Task 3 Bug 1: Remove background tint from solid style** - `152a0c8` (fix)
4. **Task 3 Bug 2+3: Fix inline code and fenced block exclusion** - `0ab2fb8` (fix)

**Plan metadata:** `828e89b` (docs: complete plan)

## Files Created/Modified

- `src/decorations/glossaryViewPlugin.ts` - GlossaryViewPlugin class + createGlossaryViewPlugin factory + text-based code exclusion helpers
- `tests/decorations/glossaryViewPlugin.test.ts` - Unit tests for cache eviction, forceRebuild, cursor-only guard
- `src/main.ts` - CSS lifecycle, ViewPlugin registration, refreshStyles() method
- `src/decorations/cssInjector.ts` - Solid style fixed: underline-only, background-color removed
- `src/matcher/codeBlockDetector.ts` - Enhanced with additional Obsidian-specific node name variants and pos+1 boundary check
- `tests/decorations/cssInjector.test.ts` - Solid style test updated: asserts no background-color

## Decisions Made

- Used `PluginRef` structural interface in `glossaryViewPlugin.ts` instead of importing `GlossaryPlugin` class to avoid circular dependency
- `LOOKAHEAD_BYTES = 4000` approximates 50 lines for lookahead buffer past visible viewport
- Cursor-only update guard returns early — avoids any re-scan on simple cursor movement
- `forceRebuild = true` clears the entire `lineCache` before rebuild for fresh decorations after settings change
- `data-terms` stores `JSON.stringify(match.terms)` — Phase 7 hover popup contract established
- Text-based fenced block detection (`computeFencedLineOffsets`) is primary exclusion because Obsidian's Lezer markdown parser produces node type names that may not match standard `@lezer/markdown` (`FencedCode`, `InlineCode`, etc.)
- Solid highlight style is underline-only: background-color was causing the word text background to be tinted, not just underlined

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added no-unsafe-member-access eslint-disable alongside no-explicit-any**
- **Found during:** Task 2 (main.ts lint check)
- **Issue:** ESLint flagged `.cm` access on `any`-casted editor as `no-unsafe-member-access`; plan only mentioned `no-explicit-any` suppression
- **Fix:** Extended eslint-disable comment to cover both rules
- **Files modified:** src/main.ts
- **Verification:** npx eslint src/main.ts = 0 errors
- **Committed in:** ca342f1 (Task 2 commit)

**2. [Rule 1 - Bug] Solid highlight style applying unwanted background tint**
- **Found during:** Task 3 (Obsidian verification)
- **Issue:** buildStylesheet for solid style was setting `background-color: ${color}15`, causing the word background to be tinted rather than just underlined
- **Fix:** Removed `background-color` from solid style CSS. Updated test from "contains background-color" to "does not contain background-color"
- **Files modified:** src/decorations/cssInjector.ts, tests/decorations/cssInjector.test.ts
- **Verification:** npm test 49/49 pass, npm run build success
- **Committed in:** 152a0c8

**3. [Rule 1 - Bug] Inline backtick code spans still highlighted**
- **Found during:** Task 3 (Obsidian verification)
- **Issue:** `isInCodeBlock` Lezer tree check was not reliably excluding inline code spans in Obsidian's runtime
- **Fix:** Added `isInInlineCode()` text-based function using `/\`([^\`]+)\`/g` regex. Applied in buildDecorations Pass 2 per match
- **Files modified:** src/decorations/glossaryViewPlugin.ts
- **Verification:** npm test 49/49 pass, npm run build success
- **Committed in:** 0ab2fb8

**4. [Rule 1 - Bug] Fenced code block detection unreliable — fence lines and adjacent words highlighted**
- **Found during:** Task 3 (Obsidian verification)
- **Issue:** `isInCodeBlock` using syntaxTree was not reliably detecting fenced block positions. Fence marker lines (containing ` ``` `) were matched by the fuzzy term matcher and not excluded
- **Fix:** Added `computeFencedLineOffsets()` which scans the full document text tracking ` ``` ` fence toggles, producing a Set of line offsets to skip in Pass 2. Fence lines themselves are included in the skip set
- **Files modified:** src/decorations/glossaryViewPlugin.ts, src/matcher/codeBlockDetector.ts
- **Verification:** npm test 49/49 pass, npm run build success
- **Committed in:** 0ab2fb8

---

**Total deviations:** 4 auto-fixed (1 missing lint suppression Rule 2, 3 bugs Rule 1 found during Obsidian verification)
**Impact on plan:** All fixes required for correct visual behavior. No scope creep.

## Issues Encountered

- Lezer syntax tree node type names in Obsidian's runtime differ from standard `@lezer/markdown` names. This is a known challenge building Obsidian CM6 plugins without Obsidian runtime access during development. Text-based fallbacks are the correct pattern for this scenario.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- GlossaryViewPlugin is wired and decorates matched terms in the CM6 editor
- `data-terms` attribute is on every `Decoration.mark` — Phase 7 hover popup can read it via DOM event
- `refreshStyles()` is available for Phase 8 settings UI to call when style/color changes
- No blockers for Phase 7

---
*Phase: 06-decorations-highlight-styles*
*Completed: 2026-03-24*

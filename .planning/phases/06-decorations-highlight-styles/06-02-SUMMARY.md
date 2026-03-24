---
phase: 06-decorations-highlight-styles
plan: 02
subsystem: ui
tags: [codemirror, viewplugin, decorations, highlights, css, incremental-cache]

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

key-files:
  created:
    - src/decorations/glossaryViewPlugin.ts
  modified:
    - tests/decorations/glossaryViewPlugin.test.ts
    - src/main.ts

key-decisions:
  - "Used PluginRef structural interface in glossaryViewPlugin.ts instead of importing GlossaryPlugin class — avoids circular dependency"
  - "LOOKAHEAD_BYTES=4000 constant (approx 50 lines) for lookahead buffer past visible viewport"
  - "Cursor-only update guard: return early if !docChanged && !viewportChanged — no unnecessary re-scans"
  - "forceRebuild clears entire lineCache before rebuild — guarantees fresh CSS after settings change"
  - "data-terms attribute stores JSON.stringify(match.terms) — Phase 7 hover popup contract"

patterns-established:
  - "CM6 ViewPlugin factory: export function createGlossaryViewPlugin(plugin: PluginRef) { return ViewPlugin.fromClass(class extends GlossaryViewPlugin { constructor(view) { super(view, plugin); } }, { decorations: (v) => v.decorations }); }"
  - "refreshStyles(): re-inject CSS + forceRebuild=true + dispatch({}) on all open MarkdownView editors"

requirements-completed: [HIGH-01, HIGH-04, HIGH-05]

# Metrics
duration: 15min
completed: 2026-03-24
---

# Phase 6 Plan 02: GlossaryViewPlugin + main.ts Wiring Summary

**CM6 ViewPlugin with incremental line-cache decorating matched glossary terms in the visible viewport, wired into main.ts with CSS lifecycle and refreshStyles()**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-03-24T04:10:47Z
- **Completed:** 2026-03-24T04:25:00Z
- **Tasks:** 2 of 3 automated tasks complete (Task 3 = human verification checkpoint)
- **Files modified:** 3

## Accomplishments

- GlossaryViewPlugin with incremental line cache: evict-on-change, 50-line lookahead buffer, cursor-only no-op guard
- createGlossaryViewPlugin factory using closure pattern (avoids circular import via PluginRef structural interface)
- main.ts wiring: injectGlossaryStyles on load, removeGlossaryStyles on unload, registerEditorExtension, refreshStyles()
- All 49 tests pass, build succeeds, lint = 0 errors

## Task Commits

Each task was committed atomically:

1. **Task 1: GlossaryViewPlugin + cache unit tests** - `b69a609` (feat)
2. **Task 2: Wire main.ts** - `ca342f1` (feat)
3. **Task 3: Verify in Obsidian** - _pending human verification checkpoint_

## Files Created/Modified

- `src/decorations/glossaryViewPlugin.ts` - GlossaryViewPlugin class + createGlossaryViewPlugin factory
- `tests/decorations/glossaryViewPlugin.test.ts` - Unit tests for cache eviction, forceRebuild, cursor-only guard
- `src/main.ts` - Added CSS lifecycle, ViewPlugin registration, refreshStyles() method

## Decisions Made

- Used `PluginRef` structural interface in `glossaryViewPlugin.ts` instead of importing `GlossaryPlugin` class to avoid circular dependency (main.ts imports glossaryViewPlugin.ts, which would then import main.ts)
- `LOOKAHEAD_BYTES = 4000` approximates 50 lines × 80 chars for lookahead buffer past visible viewport
- Cursor-only update guard (no `docChanged`, no `viewportChanged`) returns early — avoids any re-scan on simple cursor movement
- `forceRebuild = true` clears the entire `lineCache` before rebuild, guaranteeing fresh decorations after settings change via `refreshStyles()`
- `data-terms` attribute stores `JSON.stringify(match.terms)` — Phase 7 hover popup contract established

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added no-unsafe-member-access eslint-disable alongside no-explicit-any**
- **Found during:** Task 2 (main.ts lint check)
- **Issue:** ESLint flagged `.cm` access on `any`-casted editor as `no-unsafe-member-access` in addition to `no-explicit-any`; plan only mentioned the `no-explicit-any` suppression
- **Fix:** Extended the eslint-disable comment to cover both rules on the same line
- **Files modified:** src/main.ts
- **Verification:** `npx eslint src/main.ts` = 0 errors
- **Committed in:** ca342f1 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 2 — missing lint suppression for unsafe member access)
**Impact on plan:** Minimal. One additional rule name in eslint-disable comment. No logic changes.

## Issues Encountered

None.

## Next Phase Readiness

- GlossaryViewPlugin is wired and decorates matched terms in the CM6 editor
- `data-terms` attribute is on every `Decoration.mark` — Phase 7 hover popup can read it via DOM event
- `refreshStyles()` is available for Phase 8 settings UI to call when style/color changes
- No blockers for Phase 7

---
*Phase: 06-decorations-highlight-styles*
*Completed: 2026-03-24*

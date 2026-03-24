---
phase: 06-decorations-highlight-styles
plan: 01
subsystem: ui
tags: [css-injection, highlight-styles, gradients, codemirror6, tdd]

# Dependency graph
requires:
  - phase: 02-settings-data-model
    provides: GlossarySettings type with highlightStyle and highlightColor fields
provides:
  - buildStylesheet(settings): pure function returning .cm-glossary-highlight CSS for any style
  - injectGlossaryStyles(settings): DOM function writing style element to document.head
  - removeGlossaryStyles(): DOM function removing the injected style element
affects: [07-hover-tooltip, 06-02-glossaryViewPlugin]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure function extraction pattern: buildStylesheet() tested without DOM; DOM-touching functions verified in Obsidian"
    - "eslint-disable-next-line with justification for necessary exception to obsidianmd/no-forbidden-elements"

key-files:
  created:
    - src/decorations/cssInjector.ts
    - tests/decorations/cssInjector.test.ts
    - tests/decorations/glossaryViewPlugin.test.ts
  modified: []

key-decisions:
  - "Extracted buildStylesheet() as pure function — testable in Node env without DOM mocking"
  - "eslint-disable-next-line for obsidianmd/no-forbidden-elements on createElement('style') — dynamic CSS injection is required for settings-based gradient/solid styles; static styles.css cannot support this"
  - "Wave 0 glossaryViewPlugin.test.ts stub created to satisfy Nyquist rule before Plan 02 implementation"

patterns-established:
  - "Pure function extraction: export testable pure function alongside DOM-touching side-effecting functions"
  - "GRADIENTS Record<string, string> lookup with literal verbatim values from reference implementation"

requirements-completed: [HIGH-04, HIGH-05]

# Metrics
duration: 8min
completed: 2026-03-24
---

# Phase 6 Plan 01: CSS Injector — Gradient + Solid Highlight Styles Summary

**Dynamic CSS injection via buildStylesheet() covering all 10 named gradients and solid underline+tint style, TDD with pure function extraction for Node testability**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-24T03:55:31Z
- **Completed:** 2026-03-24T04:03:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- `buildStylesheet(settings)` pure function returns correct `.cm-glossary-highlight` CSS for all 10 gradient styles and the solid style
- 18 unit tests covering each gradient's unique first color stop, solid style properties, mutual distinctness of all 10 outputs, and gradient/solid exclusivity
- `injectGlossaryStyles(settings)` and `removeGlossaryStyles()` DOM functions exported for ViewPlugin use in Plan 02
- Wave 0 stub `glossaryViewPlugin.test.ts` created ahead of Plan 02 implementation

## Task Commits

Each task was committed atomically:

1. **Task 1: Write failing tests for cssInjector + create Wave 0 stub** - `abe9a93` (test)
2. **Task 2: Implement cssInjector.ts (GREEN)** - `d45e199` (feat)

_Note: TDD tasks — test commit (RED) followed by implementation commit (GREEN)_

## Files Created/Modified
- `src/decorations/cssInjector.ts` - CSS injection module: GRADIENTS map, buildStylesheet(), injectGlossaryStyles(), removeGlossaryStyles()
- `tests/decorations/cssInjector.test.ts` - 18 unit tests covering all gradient/solid style outputs
- `tests/decorations/glossaryViewPlugin.test.ts` - Wave 0 placeholder stub for Plan 02

## Decisions Made
- Extracted `buildStylesheet()` as a pure function so tests run in Node environment without DOM mocking
- Added `eslint-disable-next-line obsidianmd/no-forbidden-elements` with justification on `createElement('style')` — dynamic CSS injection for settings-based styles cannot use a static `styles.css` file
- Wave 0 glossaryViewPlugin.test.ts placeholder follows Nyquist rule: test file exists before implementation

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added eslint-disable-next-line to satisfy 0-error lint gate**
- **Found during:** Task 2 (cssInjector implementation)
- **Issue:** `obsidianmd/no-forbidden-elements` ESLint rule flags `document.createElement('style')` — ESLint reported 1 error blocking the 0-error gate
- **Fix:** Added `// eslint-disable-next-line obsidianmd/no-forbidden-elements -- dynamic CSS injection required for settings-based gradient/solid styles; cannot use static styles.css` above the createElement call
- **Files modified:** `src/decorations/cssInjector.ts`
- **Verification:** `npx eslint src/decorations/cssInjector.ts` reports 0 problems
- **Committed in:** `d45e199` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 missing critical / blocking lint gate)
**Impact on plan:** Necessary to satisfy the 0-error ESLint gate. Dynamic CSS injection is the correct pattern for settings-based styles; the eslint-disable is justified and minimal.

## Issues Encountered
- Jest 30 renamed `--testPathPattern` to `--testPathPatterns` (plural) — used updated flag for test runs. No code changes needed.
- No `lint` npm script exists — used `npx eslint src/` directly.

## Next Phase Readiness
- `buildStylesheet`, `injectGlossaryStyles`, and `removeGlossaryStyles` are exported and ready for Plan 02 (GlossaryViewPlugin wiring)
- `tests/decorations/glossaryViewPlugin.test.ts` Wave 0 stub in place for Plan 02 to expand

---
*Phase: 06-decorations-highlight-styles*
*Completed: 2026-03-24*

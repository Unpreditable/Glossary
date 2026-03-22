---
phase: 04-table-parsing-term-index
plan: "01"
subsystem: index
tags: [typescript, obsidian, markdown-table-parsing, term-index]

requires:
  - phase: 03-glossary-file-detection
    provides: isGlossaryFile logic pattern; src/main.ts with parseGlossaryFile stub
  - phase: 02-settings-data-model
    provides: GlossarySettings interface (matchBy, caseSensitive, excludeAcronyms, excludeTerms)

provides:
  - GlossaryTerm interface and TermIndex type alias exported from src/index/termIndex.ts
  - isGlossaryFile(app, file) standalone exported function in src/index/glossaryDetector.ts
  - parseGlossaryFile(), isExcluded(), addToIndex() exported from src/index/tableParser.ts
  - Full 2-col and 3-col markdown table parsing with matchBy gating
  - Plural acronym indexing (acronym + "s") sharing same GlossaryTerm object
  - Exclusion filtering via isExcluded() respecting caseSensitive setting

affects:
  - 04-02 (Plan 02 wires these modules into main.ts)
  - 05-highlighter (imports GlossaryTerm, TermIndex from stable paths)
  - 06-hover (same imports)
  - 07-editor (same imports)

tech-stack:
  added: []
  patterns:
    - "Module extraction with dependency injection: pure functions accept (app, settings, termIndex) instead of this.*"
    - "Shared GlossaryTerm object for plural variants: acronym + 's' keyed separately but same object reference"
    - "Two-pass separator detection: skip separator row itself AND header row above separator via lookahead"

key-files:
  created:
    - src/index/termIndex.ts
    - src/index/glossaryDetector.ts
    - src/index/tableParser.ts
  modified: []

key-decisions:
  - "no-useless-escape auto-fix: regex /^\\|[\\s\\-\\|]+\\|$/ had unnecessary \\| inside character class; fixed to /^\\|[\\s\\-|]+\\|$/ to satisfy ESLint 0-error constraint"
  - "Plural +s entries do not increment parseGlossaryFile() count — count tracks rows parsed, not index keys written"
  - "isExcluded() uses compareFunc closure pattern (caseSensitive dispatch) from reference implementation verbatim"

patterns-established:
  - "Pattern: src/index/ module files contain zero class coupling — accept all dependencies as function parameters"
  - "Pattern: ESLint 0-error gate enforced per task before commit"

requirements-completed:
  - INDX-02
  - INDX-03
  - INDX-04
  - MATC-05
  - MATC-06

duration: 4min
completed: 2026-03-22
---

# Phase 4 Plan 01: Table Parsing + Term Index Modules Summary

**Three src/index/ module files implementing full markdown table parsing, term indexing, plural variants, and exclusion filtering ported directly from reference/main.js**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-03-22T03:41:17Z
- **Completed:** 2026-03-22T03:44:54Z
- **Tasks:** 2
- **Files created:** 3

## Accomplishments

- Created src/index/termIndex.ts exporting GlossaryTerm interface and TermIndex type alias — stable import path for all downstream phases (5-7)
- Created src/index/glossaryDetector.ts exporting isGlossaryFile(app, file) as standalone pure function — decoupled from plugin class
- Created src/index/tableParser.ts with full parseGlossaryFile(), isExcluded(), addToIndex() — 2-col and 3-col table parsing, matchBy gating, plural indexing, exclusion filtering; TypeScript 0 errors, ESLint 0 errors

## Task Commits

Each task was committed atomically:

1. **Task 1: Create termIndex.ts and glossaryDetector.ts** - `95fa69f` (feat)
2. **Task 2: Create tableParser.ts with full parsing implementation** - `5fd4c28` (feat)

## Files Created/Modified

- `src/index/termIndex.ts` - GlossaryTerm interface and TermIndex type alias
- `src/index/glossaryDetector.ts` - isGlossaryFile(app, file): boolean standalone function
- `src/index/tableParser.ts` - parseGlossaryFile(), isExcluded(), addToIndex() with complete parsing logic

## Decisions Made

- Auto-fixed regex ESLint error (no-useless-escape): `\|` inside character class `[\s\-\|]` is unnecessary — changed to `[\s\-|]`. This does not change regex behavior; the pipe character needs no escaping inside a character class.
- Kept RESEARCH.md algorithm verbatim — reference implementation is production-validated; no redesign.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed no-useless-escape ESLint error in regex patterns**
- **Found during:** Task 2 (tableParser.ts creation)
- **Issue:** The PLAN.md and RESEARCH.md reference regex `/^\|[\s\-\|]+\|$/` contains `\|` inside the character class `[...]`, which ESLint flags as `no-useless-escape` (0 errors required)
- **Fix:** Changed `[\s\-\|]` to `[\s\-|]` in both separator detection lines; semantically identical
- **Files modified:** src/index/tableParser.ts
- **Verification:** `npx eslint src/index/` returned 0 errors after fix
- **Committed in:** 5fd4c28 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - bug/ESLint compliance)
**Impact on plan:** Necessary for 0-error ESLint gate. No behavior change — pipe inside character class requires no escaping.

## Issues Encountered

None — TypeScript compilation was clean on first attempt for both tasks. ESLint error in tableParser.ts regex was caught and fixed before commit.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All three src/index/ module files are ready for import
- Plan 02 (04-02) can now wire these modules into main.ts: update buildGlossaryIndex() to import from src/index/, add silent flag, replace parseGlossaryFile stub
- Downstream phases 5-7 have stable import paths: `from "../index/termIndex"`, `from "../index/tableParser"`, etc.
- main.ts is unchanged by this plan — wiring deferred to Plan 02 exactly as specified

---
*Phase: 04-table-parsing-term-index*
*Completed: 2026-03-22*

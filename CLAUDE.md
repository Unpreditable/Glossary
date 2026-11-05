# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development (watch mode, inline sourcemaps)
npm run dev

# Production build (type-check + bundle, no sourcemaps)
npm run build

# Type-check only
npx tsc -noEmit -skipLibCheck

# Unit tests (Jest, pure logic, in tests/)
npm test

# End-to-end tests in a real, sandboxed Obsidian (via ../ObsidianE2EHarness)
npm run test:e2e
npm run test:e2e -- --spec glossaryView   # one spec file
npm run test:all                           # unit tests, then e2e
```

`test:e2e` and `test:all` run on this machine only. They open an Obsidian window that takes the keyboard until the run ends, so say so before starting one. Spec files in `e2e/specs/` must not gain imports; see [e2e/README.md](e2e/README.md). For manual checks: copy `main.js` + `manifest.json` into a vault's `.obsidian/plugins/obsidian-glossary/` folder and reload plugins.

## Architecture

Entry point is `src/main.ts` (`GlossaryPlugin extends Plugin`). It owns three top-level concerns:

**1. Glossary index** (`src/index/`)
- `glossaryDetector.ts` — identifies glossary files via `frontmatter.tags` containing `"glossary"`
- `tableParser.ts` — reads markdown tables (2-col: acronym|description, 3-col: acronym|fullTerm|description), populates `TermIndex` (a `Record<string, GlossaryTerm[]>`); automatically adds plural form (`"APIs"` → same entry as `"API"`)
- `termIndex.ts` — shared types: `GlossaryTerm`, `TermIndex`

Index is rebuilt on `onload` and debounced (5 s) on every glossary file `modify` event. The `"Refresh glossary index"` command triggers an immediate rebuild with a Notice.

**2. Matching** (`src/matcher/`)
- `termMatcher.ts` — `TermMatcher` scans a line of text for term/acronym hits; acronyms always case-sensitive, full terms respect `caseSensitive` setting; fuzzy matching (Levenshtein) applies only to full terms with thresholds 1/2/3 by word length; overlapping matches are resolved by position then acronym-wins priority
- `codeBlockDetector.ts` — Lezer `syntaxTree` fallback to detect inline/fenced code by node name (handles Obsidian's non-standard node name variants)

**3. Decorations** (`src/decorations/`)
- `glossaryViewPlugin.ts` — CodeMirror 6 `ViewPlugin`; uses a per-line cache keyed by `line.from`; on `docChanged` evicts only dirty lines; on `viewportChanged` or `forceRebuild` rebuilds visible ranges + 4000-byte lookahead; fenced block exclusion is text-based (regex on `` ``` `` lines) rather than Lezer, as a reliable supplement; marks matches with `cm-glossary-highlight` class + `data-terms` JSON attribute
- `cssInjector.ts` — injects/replaces a `<style id="glossary-plugin-styles">` element; gradient styles use `background-clip: text` + `border-image` trick; solid style uses `text-decoration underline`

**Refresh flow**: settings change → `main.refreshStyles()` (re-injects the CSS) → `buildGlossaryIndex()`. Every index build ends with `refreshEditors()`, which iterates all `MarkdownView` leaves, sets `plugin.forceRebuild = true`, and dispatches an empty transaction to trigger `update()`, so open notes never keep matches from an older index.

**Circular dependency guard**: `glossaryViewPlugin.ts` uses a local `PluginRef` interface instead of importing `GlossaryPlugin` from `main.ts` to avoid a circular import.

## Reference file

`reference/main.js` is a bundled snapshot of an earlier monolithic version of this plugin. It is the **feature reference** for this rewrite — use it to understand what was originally implemented and how. Do NOT copy code from it directly; the rewrite uses a better modular architecture. When in doubt about intended behavior, check the reference.

## After every code change

After making any code change, **always run `npm run build`** so the output `main.js` is updated and can be hot-reloaded in Obsidian for testing:

```bash
npm run build
```

## Key constraints

- All CodeMirror packages (`@codemirror/*`, `@lezer/*`) and `obsidian` are `external` in esbuild — they must never be bundled; they are provided by Obsidian at runtime.
- `tsconfig.json` sets `baseUrl: "src"` — imports within `src/` can be relative or root-relative from `src`.
- Obsidian minimum version: 1.9.12 (CM6 only; no CM5/legacy editor support needed).
- `document.createElement('style')` is used deliberately despite the eslint-plugin-obsidianmd warning — settings-driven gradient CSS cannot use a static `styles.css`.

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development (watch mode, inline sourcemaps)
npm run dev

# Production build (type-check + lint + bundle, no sourcemaps)
npm run build

# Type-check only (src and tests)
npx tsc -noEmit -skipLibCheck

# Lint: Obsidian's review rules: ESLint over every .ts file and manifest.json, stylelint over the CSS
npm run lint

# Unit tests (Jest, pure logic, in tests/)
npm test

# End-to-end tests in a real, sandboxed Obsidian (via ../ObsidianE2EHarness)
npm run test:e2e
npm run test:e2e -- --spec glossaryView   # one spec file
npm run test:all                           # unit tests, then e2e
```

`test:e2e` and `test:all` run on this machine only. They open an Obsidian window that takes the keyboard until the run ends, so say so before starting one. Spec files in `e2e/specs/` must not gain imports; see [e2e/README.md](e2e/README.md). For manual checks: copy `main.js` + `manifest.json` + `styles.css` into a vault's `.obsidian/plugins/glossary/` folder and reload plugins.

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
- `glossaryViewPlugin.ts` — CodeMirror 6 `ViewPlugin`; caches matches per line keyed by the line's text, with line-relative positions, so edits never leave stale entries; rebuilds the visible ranges on `docChanged`, `viewportChanged`, or when `plugin.matcher` is a new object (the cache is then emptied); skips notes by the editor's own file (`editorInfoField`); fenced block exclusion is text-based (regex on `` ``` `` lines) rather than Lezer, as a reliable supplement; marks matches with `cm-glossary-highlight` class + `data-terms` JSON attribute
- `cssInjector.ts` — applies the highlight style setting as a `glossary-style-<style>` class on each window's `<body>`, and the solid color as `--glossary-highlight-color`. All CSS lives in `styles.css`: gradient styles use `background-clip: text` + `border-image`; solid style uses a `border-bottom` in `--glossary-highlight-color`

**Refresh flow**: settings change → `main.refreshStyles()` (re-applies the body class and color) → `buildGlossaryIndex()`. Every index build makes a new `TermMatcher` and ends with `refreshEditors()` (`app.workspace.updateOptions()`), which sends every editor an update; the view plugin sees the new matcher and redecorates, so open notes never keep matches from an older index.

**Circular dependency guard**: `glossaryViewPlugin.ts` uses a local `PluginRef` interface instead of importing `GlossaryPlugin` from `main.ts` to avoid a circular import.

## Reference file

`reference/main.js` is a bundled snapshot of an earlier monolithic version of this plugin. It is the **feature reference** for this rewrite — use it to understand what was originally implemented and how. Do NOT copy code from it directly; the rewrite uses a better modular architecture. When in doubt about intended behavior, check the reference. It is local only (gitignored), so it may be missing from a fresh clone.

## After every code change

After making any code change, **always run `npm run build`** so the output `main.js` is updated and can be hot-reloaded in Obsidian for testing:

```bash
npm run build
```

## Key constraints

- All CodeMirror packages (`@codemirror/*`, `@lezer/*`) and `obsidian` are `external` in esbuild — they must never be bundled; they are provided by Obsidian at runtime.
- `tsconfig.json` sets `baseUrl: "src"` — imports within `src/` can be relative or root-relative from `src`.
- Obsidian minimum version: 1.13.0, for the declarative settings API (`getSettingDefinitions()`), which puts the settings in Obsidian's settings search. The settings tab has no `display()`. The `obsidian` typings and `@codemirror/state`/`view` are pinned to the exact versions one Obsidian release ships (currently 1.14.4); bump them together.
- `npm run lint` runs the same rules as Obsidian's review bot: eslint-plugin-obsidianmd (plus the `no-unsafe-*` rules the bot adds) over every `.ts` file and `manifest.json`, and stylelint (`stylelint.config.mjs`, copied from the bot's config in obsidianmd/obsidian-workflows) over the CSS. Never switch a rule off or add an `eslint-disable` or `stylelint-disable` comment; change the code instead.
- No `<style>` or `<link>` elements and no inline `style` assignments: CSS goes in `styles.css`, settings-driven values in body classes or CSS variables (`setCssProps`).

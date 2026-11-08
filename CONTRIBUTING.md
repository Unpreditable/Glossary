# Contributing

Thanks for your interest in Smart Glossary! There are three ways to contribute:

- [Report a bug](#report-a-bug)
- [Request a feature](#request-a-feature)
- [Submit a code change](#submit-a-code-change)

---

## Report a Bug

[Open an issue](https://github.com/Unpreditable/Glossary/issues/new/choose) — check for duplicates first.

A useful report includes:

- **Obsidian version** — Settings → About
- **Smart Glossary version** — Settings → Community plugins
- **Steps to reproduce** — what you did, what you expected, what happened instead
- **Glossary table and note text** (optional) — the rows and the text that misbehave, with any sensitive text removed

---

## Request a Feature

[Open an issue](https://github.com/Unpreditable/Glossary/issues/new/choose) using the feature request form.

Describe the problem you are trying to solve rather than the specific solution — this helps evaluate whether the request fits the plugin's direction. Feature implementation is handled by the maintainer.

---

## Submit a Code Change

Logic and feature changes are not actively solicited — please [open an issue](https://github.com/Unpreditable/Glossary/issues/new/choose) first to discuss.

If you do proceed with a code change:

**Setup**

1. Fork the repository and create a branch from `main`.
2. Install dependencies: `npm install`
3. Start the dev build: `npm run dev`
4. Symlink the repository folder into `<vault>/.obsidian/plugins/glossary/` and install the [Hot Reload](https://github.com/pjeby/hot-reload) community plugin — changes rebuild and reload automatically.

**Requirements before opening a PR**

- `npm run build` passes (TypeScript check + lint)
- `npm test` passes
- Any new logic is covered by Jest tests in `tests/`
- Lint rules are never switched off and no `eslint-disable` comments are added — change the code instead
- CSS changes follow the project rules:
  - No `!important` — raise selector specificity instead
  - No inline styles and no `<style>` elements — all CSS goes in `styles.css`; settings-driven values go in body classes or CSS variables
  - All colors, fonts, and spacing use Obsidian CSS variables

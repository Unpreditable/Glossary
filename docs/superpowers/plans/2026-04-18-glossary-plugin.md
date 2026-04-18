# Glossary Plugin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the modular rewrite to full feature parity with `reference/main.js`, fix one known bug, then add three new features: quick-add from editor, a custom glossary file view, and reading-view highlight support.

**Architecture:** The plugin is split into `src/index/` (glossary parsing), `src/matcher/` (term matching), `src/decorations/` (CM6 view plugin + CSS), and `src/glossary/` (new UI features). All CodeMirror and Obsidian packages are runtime-external (never bundled). There are no automated tests — verify each task by running `npm run build`, copying `main.js` + `manifest.json` to the vault plugin folder, and reloading plugins.

**Tech Stack:** TypeScript, Obsidian Plugin API, CodeMirror 6 (`@codemirror/view`, `@codemirror/state`, `@codemirror/language`), esbuild.

---

## Verification setup (read once)

To test after any task:
1. `npm run build` — must complete with no errors
2. Copy `main.js` and `manifest.json` to `<vault>/.obsidian/plugins/obsidian-glossary/`
3. In Obsidian: Settings → Community plugins → disable then re-enable "Smart Glossary"

---

## Task 1: Fix `shouldProcessFile` bug

**Files:**
- Modify: `src/decorations/glossaryViewPlugin.ts`

The current `buildDecorations()` never checks whether the active file is in an included/excluded folder. All markdown files get decorated regardless of the includeFolders/excludeFolders settings.

- [ ] **Step 1: Open `src/decorations/glossaryViewPlugin.ts` and locate `buildDecorations`**

Find this block near the top of `buildDecorations()`:
```typescript
private buildDecorations(view: EditorView): DecorationSet {
    // Guard: if matcher is not yet initialised, return empty set.
    // shouldProcessFile is intentionally skipped here — buildGlossaryIndex()
    // only populates termIndex for processable files, so the index is already filtered.
    if (!this.plugin?.matcher) {
      return new RangeSetBuilder<Decoration>().finish();
    }
```

- [ ] **Step 2: Replace that block with the corrected version**

```typescript
private buildDecorations(view: EditorView): DecorationSet {
    if (!this.plugin?.matcher) {
      return new RangeSetBuilder<Decoration>().finish();
    }

    const activeFile = this.plugin.app.workspace.getActiveFile();
    if (!activeFile || !this.plugin.matcher.shouldProcessFile(this.plugin.app, activeFile)) {
      this.lineCache.clear();
      return new RangeSetBuilder<Decoration>().finish();
    }
```

Also remove the now-stale comment block above the matcher guard.

- [ ] **Step 3: Build and verify**

```bash
npm run build
```

Expected: no TypeScript errors, `main.js` updated.

Manual test: create two folders in your vault (`included/` and `excluded/`), set includeFolders to `included` in settings (settings tab comes in Task 3 — edit `data.json` directly for now: `<vault>/.obsidian/plugins/obsidian-glossary/data.json` → `"includeFolders": ["included"]`). Open a note in `excluded/`. Glossary terms should NOT be highlighted. Open a note in `included/`. They should be highlighted.

- [ ] **Step 4: Commit**

```bash
git add src/decorations/glossaryViewPlugin.ts
git commit -m "fix: check shouldProcessFile in buildDecorations — excluded folders were being decorated"
```

---

## Task 2: Settings Tab UI

**Files:**
- Create: `src/settings/settingsTab.ts`
- Modify: `src/main.ts`
- Modify: `src/decorations/cssInjector.ts` (add `.glossary-preview` CSS)

- [ ] **Step 1: Create `src/settings/settingsTab.ts`**

```typescript
import { App, PluginSettingTab, Setting } from 'obsidian';
import type GlossaryPlugin from '../main';
import type { MatchBy, HighlightStyle } from '../settings';

export class GlossarySettingTab extends PluginSettingTab {
  constructor(app: App, private plugin: GlossaryPlugin) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl('h2', { text: 'Smart Glossary Settings' });

    // --- Match by ---
    new Setting(containerEl)
      .setName('Match by')
      .setDesc('What to highlight. 2-column tables always match by acronym.')
      .addDropdown(dd => dd
        .addOption('acronym', 'Acronym only')
        .addOption('term', 'Term only')
        .addOption('both', 'Acronym and Term')
        .setValue(this.plugin.settings.matchBy)
        .onChange(async (value) => {
          this.plugin.settings.matchBy = value as MatchBy;
          await this.save();
          this.display();
        }),
      );

    // --- Case sensitive ---
    new Setting(containerEl)
      .setName('Case sensitive')
      .setDesc('Match full terms with exact case. Acronyms are always case-sensitive.')
      .addToggle(t => t
        .setValue(this.plugin.settings.caseSensitive)
        .onChange(async (value) => {
          this.plugin.settings.caseSensitive = value;
          await this.save();
        }),
      );

    // --- Fuzzy matching ---
    new Setting(containerEl)
      .setName('Fuzzy matching')
      .setDesc('Match near-spellings of full terms (handles plurals and minor typos).')
      .addToggle(t => t
        .setValue(this.plugin.settings.fuzzyMatching)
        .onChange(async (value) => {
          this.plugin.settings.fuzzyMatching = value;
          await this.save();
        }),
      );

    // --- Exclude acronyms (conditional) ---
    if (this.plugin.settings.matchBy === 'acronym' || this.plugin.settings.matchBy === 'both') {
      new Setting(containerEl)
        .setName('Exclude acronyms')
        .setDesc('Comma-separated list of acronyms to never highlight (e.g. API, UI).')
        .addText(t => t
          .setPlaceholder('API, UI, CSS')
          .setValue(this.plugin.settings.excludeAcronyms.join(', '))
          .inputEl.addEventListener('blur', async () => {
            this.plugin.settings.excludeAcronyms = t.getValue()
              .split(',').map(s => s.trim()).filter(s => s.length > 0);
            await this.save();
          }),
        );
    }

    // --- Exclude terms (conditional) ---
    if (this.plugin.settings.matchBy === 'term' || this.plugin.settings.matchBy === 'both') {
      new Setting(containerEl)
        .setName('Exclude terms')
        .setDesc('Comma-separated list of full terms to never highlight.')
        .addText(t => t
          .setPlaceholder('data, system, process')
          .setValue(this.plugin.settings.excludeTerms.join(', '))
          .inputEl.addEventListener('blur', async () => {
            this.plugin.settings.excludeTerms = t.getValue()
              .split(',').map(s => s.trim()).filter(s => s.length > 0);
            await this.save();
          }),
        );
    }

    // --- Highlight style ---
    new Setting(containerEl)
      .setName('Highlight style')
      .setDesc('Visual style for highlighted glossary terms.')
      .addDropdown(dd => dd
        .addOption('gradient1',  'Ocean Waves')
        .addOption('gradient2',  'Sunset Glow')
        .addOption('gradient3',  'Purple Haze')
        .addOption('gradient4',  'Peach Melba')
        .addOption('gradient5',  'Mint Fresh')
        .addOption('gradient6',  'Cotton Candy')
        .addOption('gradient7',  'Electric Dreams')
        .addOption('gradient8',  'Spring Meadow')
        .addOption('gradient9',  'Cloud Nine')
        .addOption('gradient10', 'Forest Breeze')
        .addOption('solid',      'Solid Color')
        .setValue(this.plugin.settings.highlightStyle)
        .onChange(async (value) => {
          this.plugin.settings.highlightStyle = value as HighlightStyle;
          await this.save();
          this.display();
        }),
      );

    // --- Highlight color (conditional on solid style) ---
    if (this.plugin.settings.highlightStyle === 'solid') {
      new Setting(containerEl)
        .setName('Highlight color')
        .setDesc('Color used for solid underline highlighting.')
        .addColorPicker(cp => cp
          .setValue(this.plugin.settings.highlightColor)
          .onChange(async (value) => {
            this.plugin.settings.highlightColor = value;
            await this.save();
          }),
        );
    }

    // --- Live preview ---
    const previewSetting = new Setting(containerEl)
      .setName('Preview')
      .setDesc('How highlighted terms appear in your notes.');
    previewSetting.controlEl.createEl('span', {
      text: 'Sample Term',
      cls: 'glossary-preview',
    });

    // --- Include folders ---
    new Setting(containerEl)
      .setName('Include folders')
      .setDesc('Only highlight terms in these folders (comma-separated). Empty = all folders.')
      .addText(t => t
        .setPlaceholder('folder1, folder2')
        .setValue(this.plugin.settings.includeFolders.join(', '))
        .inputEl.addEventListener('blur', async () => {
          this.plugin.settings.includeFolders = t.getValue()
            .split(',').map(s => s.trim()).filter(s => s.length > 0);
          await this.save();
        }),
      );

    // --- Exclude folders ---
    new Setting(containerEl)
      .setName('Exclude folders')
      .setDesc('Never highlight terms in these folders (comma-separated).')
      .addText(t => t
        .setPlaceholder('Private, Archive')
        .setValue(this.plugin.settings.excludeFolders.join(', '))
        .inputEl.addEventListener('blur', async () => {
          this.plugin.settings.excludeFolders = t.getValue()
            .split(',').map(s => s.trim()).filter(s => s.length > 0);
          await this.save();
        }),
      );
  }

  private async save(): Promise<void> {
    await this.plugin.saveSettings();
    this.plugin.refreshStyles();
    await this.plugin.buildGlossaryIndex({ silent: true });
  }
}
```

- [ ] **Step 2: Register the settings tab in `src/main.ts`**

Add this import near the top of `main.ts`:
```typescript
import { GlossarySettingTab } from "./settings/settingsTab";
```

Add this line inside `onload()`, after `this.app.workspace.onLayoutReady(...)`:
```typescript
this.addSettingTab(new GlossarySettingTab(this.app, this));
```

- [ ] **Step 3: Add `.glossary-preview` CSS to `src/decorations/cssInjector.ts`**

The preview span in the settings tab needs the same gradient/solid style as `.cm-glossary-highlight`. Update `buildStylesheet` to apply the highlight rule to both classes and append static tooltip+preview layout CSS:

```typescript
export function buildStylesheet(settings: GlossarySettings): string {
  let highlightRule: string;

  if (settings.highlightStyle === 'solid') {
    highlightRule = `
.cm-glossary-highlight, .glossary-preview {
  text-decoration: underline;
  text-decoration-color: ${settings.highlightColor};
  text-decoration-thickness: 2px;
}`;
  } else {
    const grad = GRADIENTS[settings.highlightStyle];
    highlightRule = `
.cm-glossary-highlight, .glossary-preview {
  background: ${grad};
  background-clip: text;
  -webkit-background-clip: text;
  color: transparent;
  border-bottom: 2px solid transparent;
  border-image: ${grad} 0 0 100% 0;
}`;
  }

  const staticRules = `
.cm-tooltip-glossary {
  background: var(--background-primary);
  border: 1px solid var(--background-modifier-border);
  border-radius: 4px;
  padding: 8px 12px;
  max-width: 320px;
  font-size: var(--font-ui-small);
  color: var(--text-normal);
  line-height: 1.5;
}
.glossary-preview {
  display: inline-block;
  padding: 2px 6px;
  border-radius: 2px;
  font-weight: 500;
}`;

  return highlightRule + staticRules;
}
```

- [ ] **Step 4: Build and verify**

```bash
npm run build
```

Expected: no errors. In Obsidian after reloading: Settings → Community plugins → Smart Glossary gear icon → settings panel appears with all controls. Change highlight style — preview span updates immediately. Change matchBy to "Acronym only" — Exclude terms field disappears.

- [ ] **Step 5: Commit**

```bash
git add src/settings/settingsTab.ts src/main.ts src/decorations/cssInjector.ts
git commit -m "feat: add settings tab UI with live preview"
```

---

## Task 3: Hover Tooltip

**Files:**
- Create: `src/decorations/tooltipExtension.ts`
- Modify: `src/main.ts`

The `cssInjector.ts` already has `.cm-tooltip-glossary` styles from Task 2.

- [ ] **Step 1: Create `src/decorations/tooltipExtension.ts`**

```typescript
import { hoverTooltip, Tooltip, EditorView } from '@codemirror/view';
import type { Extension } from '@codemirror/state';
import type { createGlossaryViewPlugin } from './glossaryViewPlugin';
import type { GlossaryTerm } from '../index/termIndex';

type ViewPluginSpec = ReturnType<typeof createGlossaryViewPlugin>;

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export function createTooltipExtension(viewPluginSpec: ViewPluginSpec): Extension {
  return hoverTooltip((view: EditorView, pos: number): Tooltip | null => {
    const vp = view.plugin(viewPluginSpec);
    if (!vp) return null;

    let result: Tooltip | null = null;

    vp.decorations.between(pos, pos, (from, to, deco) => {
      const attrs = (deco.spec as { attributes?: Record<string, string> }).attributes;
      const termsData = attrs?.['data-terms'];
      if (!termsData || pos < from || pos > to) return;

      const terms = JSON.parse(termsData) as GlossaryTerm[];
      const term = terms[0];

      result = {
        pos: from,
        end: to,
        above: true,
        create: (): { dom: HTMLElement } => {
          const dom = document.createElement('div');
          dom.className = 'cm-tooltip-glossary';

          const parts: string[] = [];
          if (term.acronym)   parts.push(`<strong>${escapeHtml(term.acronym)}</strong>`);
          if (term.fullTerm)  parts.push(`<strong>${escapeHtml(term.fullTerm)}</strong>`);
          if (term.description) parts.push(escapeHtml(term.description));
          if (parts.length === 0) parts.push('No definition available');
          if (terms.length > 1)
            parts.push(`<small>(+${terms.length - 1} more definitions)</small>`);
          if (term.sourceFile)
            parts.push(`<small style="color:var(--text-muted)">${escapeHtml(term.sourceFile)}</small>`);

          dom.innerHTML = parts.join('<br>');
          return { dom };
        },
      };
    });

    return result;
  });
}
```

- [ ] **Step 2: Wire tooltip into `src/main.ts`**

Add import at the top:
```typescript
import { createTooltipExtension } from "./decorations/tooltipExtension";
```

In `onload()`, find this line:
```typescript
this.viewPluginSpec = createGlossaryViewPlugin(this);
this.registerEditorExtension(this.viewPluginSpec);
```

Replace with:
```typescript
this.viewPluginSpec = createGlossaryViewPlugin(this);
this.registerEditorExtension([
  this.viewPluginSpec,
  createTooltipExtension(this.viewPluginSpec),
]);
```

- [ ] **Step 3: Build and verify**

```bash
npm run build
```

In Obsidian: hover over a highlighted term — tooltip appears above with term name, description, source file. Tooltip disappears when cursor moves away.

- [ ] **Step 4: Commit**

```bash
git add src/decorations/tooltipExtension.ts src/main.ts
git commit -m "feat: add hover tooltip showing term definition and source file"
```

---

## Task 4: Quick-Add — Add Term Modal

> ⚠️ **REVIEW CHECKPOINT** — Before implementing this task, present the design to the user and get explicit approval. The modal UX details (field validation, duplicate handling, success message) were intentionally left open in the spec.

**Files:**
- Create: `src/glossary/addTermModal.ts`
- Modify: `src/main.ts`

- [ ] **Step 1: Create `src/glossary/addTermModal.ts`**

```typescript
import { App, Modal, Setting, TFile, Notice } from 'obsidian';
import type GlossaryPlugin from '../main';
import { isGlossaryFile } from '../index/glossaryDetector';

export class AddTermModal extends Modal {
  private acronym: string;
  private fullTerm: string;
  private description = '';
  private targetFile: TFile | null = null;

  constructor(app: App, private plugin: GlossaryPlugin, selectedText: string) {
    super(app);

    // Pre-fill: all-caps ≤6 chars → acronym, otherwise full term
    const trimmed = selectedText.trim();
    if (/^[A-Z0-9]{1,6}$/.test(trimmed)) {
      this.acronym = trimmed;
      this.fullTerm = '';
    } else {
      this.acronym = '';
      this.fullTerm = trimmed;
    }
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl('h2', { text: 'Add glossary term' });

    const glossaryFiles = this.app.vault.getMarkdownFiles()
      .filter(f => isGlossaryFile(this.app, f));

    if (glossaryFiles.length === 0) {
      contentEl.createEl('p', {
        text: 'No glossary files found. Create a markdown file with tag: glossary in its frontmatter.',
      });
      return;
    }

    this.targetFile = glossaryFiles[0];

    new Setting(contentEl)
      .setName('Acronym')
      .setDesc('Short form (e.g. API). Leave blank if term has no acronym.')
      .addText(t => t
        .setValue(this.acronym)
        .onChange(v => { this.acronym = v.trim(); }),
      );

    new Setting(contentEl)
      .setName('Full term')
      .setDesc('Full name (e.g. Application Programming Interface).')
      .addText(t => t
        .setValue(this.fullTerm)
        .onChange(v => { this.fullTerm = v.trim(); }),
      );

    new Setting(contentEl)
      .setName('Description')
      .addText(t => t
        .setPlaceholder('Short definition…')
        .setValue(this.description)
        .onChange(v => { this.description = v.trim(); }),
      );

    if (glossaryFiles.length > 1) {
      new Setting(contentEl)
        .setName('Target glossary file')
        .addDropdown(dd => {
          for (const f of glossaryFiles) dd.addOption(f.path, f.basename);
          dd.setValue(this.targetFile!.path)
            .onChange(v => {
              this.targetFile = this.app.vault.getAbstractFileByPath(v) as TFile;
            });
        });
    } else {
      new Setting(contentEl)
        .setName('Target glossary file')
        .setDesc(glossaryFiles[0].basename)
        .setDisabled(true);
    }

    new Setting(contentEl)
      .addButton(btn => btn
        .setButtonText('Add')
        .setCta()
        .onClick(() => { void this.submit(); }),
      )
      .addButton(btn => btn
        .setButtonText('Cancel')
        .onClick(() => this.close()),
      );
  }

  private async submit(): Promise<void> {
    if (!this.acronym && !this.fullTerm) {
      new Notice('Enter at least an acronym or full term.');
      return;
    }
    if (!this.targetFile) return;

    const row = this.buildRow();
    await this.appendToGlossaryFile(this.targetFile, row);
    await this.plugin.buildGlossaryIndex({ silent: true });
    new Notice(`Added "${this.acronym || this.fullTerm}" to ${this.targetFile.basename}`);
    this.close();
  }

  private buildRow(): string {
    const esc = (s: string) => s.replace(/\|/g, '\\|');
    if (this.fullTerm) {
      return `| ${esc(this.acronym)} | ${esc(this.fullTerm)} | ${esc(this.description)} |`;
    }
    return `| ${esc(this.acronym)} | ${esc(this.description)} |`;
  }

  private async appendToGlossaryFile(file: TFile, row: string): Promise<void> {
    const content = await this.app.vault.read(file);
    const lines = content.split('\n');

    // Find the last table row index
    let lastTableIdx = -1;
    for (let i = lines.length - 1; i >= 0; i--) {
      const t = lines[i].trim();
      if (t.startsWith('|') && t.endsWith('|') && !t.match(/^\|[\s\-|]+\|$/)) {
        lastTableIdx = i;
        break;
      }
    }

    if (lastTableIdx >= 0) {
      lines.splice(lastTableIdx + 1, 0, row);
    } else {
      // No table found — create one
      const isThreeCol = !!this.fullTerm;
      const header = isThreeCol
        ? '| Acronym | Full Term | Description |'
        : '| Acronym | Description |';
      const sep = isThreeCol
        ? '| --- | --- | --- |'
        : '| --- | --- |';
      lines.push('', header, sep, row);
    }

    await this.app.vault.modify(file, lines.join('\n'));
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
```

- [ ] **Step 2: Register context menu in `src/main.ts`**

Add import:
```typescript
import { AddTermModal } from "./glossary/addTermModal";
```

Add inside `onload()`, after the `addCommand` block:
```typescript
this.registerEvent(
  this.app.workspace.on('editor-menu', (menu, editor) => {
    const selection = editor.getSelection().trim();
    if (!selection) return;
    menu.addItem(item => item
      .setTitle('Add to glossary')
      .setIcon('book-plus')
      .onClick(() => new AddTermModal(this.app, this, selection).open()),
    );
  }),
);
```

- [ ] **Step 3: Build and verify**

```bash
npm run build
```

In Obsidian: select any word in a note → right-click → "Add to glossary" appears. Click it → modal opens with the word pre-filled. Fill in fields, click Add → term appears in the glossary file, highlight appears on next index rebuild.

- [ ] **Step 4: Commit**

```bash
git add src/glossary/addTermModal.ts src/main.ts
git commit -m "feat: add quick-add context menu to append terms to glossary files"
```

---

## Task 5: Custom Glossary View

> ⚠️ **CLARIFY AT IMPLEMENTATION** — Resolve these before coding: sort order (alpha by key? by file?); edit-in-place vs modal for existing entries; whether multi-file terms are grouped by file or merged into one list.

**Files:**
- Create: `src/glossary/glossaryView.ts`
- Modify: `src/main.ts`

The view is a CodeMirror-free `ItemView` registered as an alternative to the markdown editor for glossary-tagged files.

- [ ] **Step 1: Create `src/glossary/glossaryView.ts`**

```typescript
import { ItemView, WorkspaceLeaf, TFile } from 'obsidian';
import type GlossaryPlugin from '../main';
import type { GlossaryTerm } from '../index/termIndex';
import { AddTermModal } from './addTermModal';

export const GLOSSARY_VIEW_TYPE = 'glossary-term-view';

export class GlossaryItemView extends ItemView {
  private plugin: GlossaryPlugin;
  private searchQuery = '';

  constructor(leaf: WorkspaceLeaf, plugin: GlossaryPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string { return GLOSSARY_VIEW_TYPE; }
  getDisplayText(): string { return 'Glossary'; }
  getIcon(): string { return 'book-open'; }

  async onOpen(): Promise<void> {
    this.render();
  }

  render(): void {
    const { contentEl } = this;
    contentEl.empty();

    // Toolbar
    const toolbar = contentEl.createDiv({ cls: 'glossary-view-toolbar' });

    const searchInput = toolbar.createEl('input', {
      type: 'text',
      placeholder: 'Search terms…',
      cls: 'glossary-view-search',
    });
    searchInput.value = this.searchQuery;
    searchInput.addEventListener('input', () => {
      this.searchQuery = searchInput.value.toLowerCase();
      this.renderList(listEl);
    });

    toolbar.createEl('button', { text: '+ Add term', cls: 'mod-cta glossary-view-add' })
      .addEventListener('click', () => {
        new AddTermModal(this.app, this.plugin, '').open();
      });

    toolbar.createEl('button', { text: 'View source', cls: 'glossary-view-source' })
      .addEventListener('click', () => {
        const file = this.app.workspace.getActiveFile();
        if (file) void this.leaf.openFile(file, { state: { mode: 'source' } });
      });

    // Term list
    const listEl = contentEl.createDiv({ cls: 'glossary-view-list' });
    this.renderList(listEl);
  }

  private renderList(listEl: HTMLElement): void {
    listEl.empty();
    const q = this.searchQuery;

    // Collect all terms from the index
    const entries: Array<{ key: string; terms: GlossaryTerm[] }> = [];
    for (const [key, terms] of Object.entries(this.plugin.termIndex)) {
      // Skip plural-form duplicates (keys ending in 's' that have a base entry)
      const base = key.endsWith('s') ? key.slice(0, -1) : null;
      if (base && this.plugin.termIndex[base]) continue;

      if (q) {
        const term = terms[0];
        const haystack = [key, term.acronym, term.fullTerm, term.description, term.sourceFile]
          .filter(Boolean).join(' ').toLowerCase();
        if (!haystack.includes(q)) continue;
      }
      entries.push({ key, terms });
    }

    entries.sort((a, b) => a.key.localeCompare(b.key));

    if (entries.length === 0) {
      listEl.createEl('p', { text: 'No terms match.', cls: 'glossary-view-empty' });
      return;
    }

    for (const { terms } of entries) {
      const term = terms[0];
      const card = listEl.createDiv({ cls: 'glossary-view-card' });

      if (term.acronym)  card.createEl('strong', { text: term.acronym, cls: 'glossary-card-acronym' });
      if (term.fullTerm) card.createEl('span',   { text: term.fullTerm, cls: 'glossary-card-full' });
      if (term.description) card.createEl('p', { text: term.description, cls: 'glossary-card-desc' });
      card.createEl('small', { text: term.sourceFile, cls: 'glossary-card-source' });
    }
  }

  async onClose(): Promise<void> {
    this.contentEl.empty();
  }
}
```

- [ ] **Step 2: Expose `termIndex` on `GlossaryPlugin` in `src/main.ts`**

The view reads `plugin.termIndex` directly. Change the field from `private` to `public`:

```typescript
// Before:
private termIndex: TermIndex = {};

// After:
termIndex: TermIndex = {};
```

- [ ] **Step 3: Register the view and file-open interceptor in `src/main.ts`**

Add imports:
```typescript
import { GlossaryItemView, GLOSSARY_VIEW_TYPE } from "./glossary/glossaryView";
```

Add inside `onload()`:
```typescript
this.registerView(GLOSSARY_VIEW_TYPE, (leaf) => new GlossaryItemView(leaf, this));

this.registerEvent(
  this.app.workspace.on('file-open', (file) => {
    if (!file || !isGlossaryFile(this.app, file)) return;
    const leaf = this.app.workspace.getActiveLeaf();
    if (!leaf) return;
    // Only redirect if currently showing standard markdown view
    if (leaf.view.getViewType() !== 'markdown') return;
    void leaf.setViewState({ type: GLOSSARY_VIEW_TYPE, active: true });
  }),
);
```

- [ ] **Step 4: Add minimal CSS for the glossary view**

Append to `buildStylesheet()` in `src/decorations/cssInjector.ts`:

```typescript
const glossaryViewRules = `
.glossary-view-toolbar {
  display: flex;
  gap: 8px;
  padding: 8px;
  border-bottom: 1px solid var(--background-modifier-border);
  align-items: center;
}
.glossary-view-search {
  flex: 1;
  padding: 4px 8px;
  border-radius: 4px;
  border: 1px solid var(--background-modifier-border);
  background: var(--background-primary);
  color: var(--text-normal);
}
.glossary-view-list {
  padding: 8px;
  overflow-y: auto;
}
.glossary-view-card {
  padding: 8px 10px;
  margin-bottom: 6px;
  border-radius: 6px;
  border: 1px solid var(--background-modifier-border);
  background: var(--background-secondary);
}
.glossary-card-acronym { font-size: 1.05em; margin-right: 6px; }
.glossary-card-full    { color: var(--text-muted); }
.glossary-card-desc    { margin: 4px 0 2px; font-size: var(--font-ui-small); }
.glossary-card-source  { color: var(--text-faint); font-size: var(--font-ui-smaller); }
.glossary-view-empty   { color: var(--text-muted); padding: 16px; }
`;
```

Append `glossaryViewRules` to the return value of `buildStylesheet()`.

- [ ] **Step 5: Build and verify**

```bash
npm run build
```

In Obsidian: open a glossary-tagged file → custom card view appears instead of editor. Search bar filters cards in real time. "+ Add term" opens the add modal. "View source" switches back to markdown.

- [ ] **Step 6: Commit**

```bash
git add src/glossary/glossaryView.ts src/main.ts src/decorations/cssInjector.ts
git commit -m "feat: add custom ItemView for glossary files with search and add-term button"
```

---

## Task 6: Reading View Support (nice to have)

> ⚠️ **CLARIFY AT IMPLEMENTATION** — Decide whether to reuse the CM6 tooltip DOM builder from `tooltipExtension.ts` or use a simpler standalone mouseover handler.

**Files:**
- Create: `src/decorations/readingViewPostProcessor.ts`
- Modify: `src/main.ts`

- [ ] **Step 1: Create `src/decorations/readingViewPostProcessor.ts`**

```typescript
import type { MarkdownPostProcessorContext } from 'obsidian';
import type { TermMatcher } from '../matcher/termMatcher';
import type { GlossaryTerm } from '../index/termIndex';

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function buildTooltipDom(terms: GlossaryTerm[]): HTMLElement {
  const dom = document.createElement('div');
  dom.className = 'cm-tooltip-glossary glossary-reading-tooltip';
  const term = terms[0];
  const parts: string[] = [];
  if (term.acronym)     parts.push(`<strong>${escapeHtml(term.acronym)}</strong>`);
  if (term.fullTerm)    parts.push(`<strong>${escapeHtml(term.fullTerm)}</strong>`);
  if (term.description) parts.push(escapeHtml(term.description));
  if (parts.length === 0) parts.push('No definition available');
  if (terms.length > 1)
    parts.push(`<small>(+${terms.length - 1} more definitions)</small>`);
  if (term.sourceFile)
    parts.push(`<small style="color:var(--text-muted)">${escapeHtml(term.sourceFile)}</small>`);
  dom.innerHTML = parts.join('<br>');
  return dom;
}

export function processReadingViewEl(
  el: HTMLElement,
  _ctx: MarkdownPostProcessorContext,
  getMatcher: () => TermMatcher | null,
): void {
  const matcher = getMatcher();
  if (!matcher) return;

  // Walk text nodes; skip code elements
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      let p = node.parentElement;
      while (p) {
        if (p.tagName === 'CODE' || p.tagName === 'PRE') return NodeFilter.FILTER_REJECT;
        p = p.parentElement;
      }
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  const textNodes: Text[] = [];
  let n: Node | null;
  while ((n = walker.nextNode())) textNodes.push(n as Text);

  let tooltip: HTMLElement | null = null;

  for (const textNode of textNodes) {
    const text = textNode.nodeValue ?? '';
    if (!text.trim()) continue;

    const matches = matcher.findTermsInText(text, 0);
    if (matches.length === 0) continue;

    // Split text node and wrap matches in spans
    const parent = textNode.parentNode;
    if (!parent) continue;

    const frag = document.createDocumentFragment();
    let cursor = 0;
    for (const match of matches) {
      if (match.from > cursor) {
        frag.appendChild(document.createTextNode(text.slice(cursor, match.from)));
      }
      const span = document.createElement('span');
      span.className = 'cm-glossary-highlight';
      span.textContent = text.slice(match.from, match.to);

      const terms = match.terms;
      span.addEventListener('mouseover', (e) => {
        tooltip?.remove();
        tooltip = buildTooltipDom(terms);
        tooltip.style.cssText = 'position:fixed;z-index:9999;pointer-events:none;';
        tooltip.style.left = `${(e as MouseEvent).clientX + 12}px`;
        tooltip.style.top  = `${(e as MouseEvent).clientY + 12}px`;
        document.body.appendChild(tooltip);
      });
      span.addEventListener('mouseleave', () => { tooltip?.remove(); tooltip = null; });

      frag.appendChild(span);
      cursor = match.to;
    }
    if (cursor < text.length) {
      frag.appendChild(document.createTextNode(text.slice(cursor)));
    }
    parent.replaceChild(frag, textNode);
  }
}
```

- [ ] **Step 2: Register the post-processor in `src/main.ts`**

Add import:
```typescript
import { processReadingViewEl } from "./decorations/readingViewPostProcessor";
```

Add inside `onload()`:
```typescript
this.registerMarkdownPostProcessor((el, ctx) => {
  processReadingViewEl(el, ctx, () => this.matcher ?? null);
});
```

- [ ] **Step 3: Build and verify**

```bash
npm run build
```

In Obsidian: switch a note to Reading View (the book icon). Glossary terms should appear highlighted. Hover over one — tooltip appears. No highlights inside inline code or code blocks.

- [ ] **Step 4: Commit**

```bash
git add src/decorations/readingViewPostProcessor.ts src/main.ts
git commit -m "feat: highlight and tooltip glossary terms in reading view"
```

---

## Self-review notes

- Task 1 references `this.plugin.app` — confirmed present in `PluginRef` interface in `glossaryViewPlugin.ts`.
- Task 3 uses `vp.decorations` — confirmed public on `GlossaryViewPlugin`.
- Task 4 uses `plugin.buildGlossaryIndex({ silent: true })` — confirmed signature in `main.ts`.
- Task 5 uses `plugin.termIndex` directly — Task 5 Step 2 makes it public before it is accessed.
- `AddTermModal` is used in both Task 4 and Task 5 — import path is `../glossary/addTermModal` from both `main.ts` and `glossaryView.ts`.
- All commits use conventional commit prefix (`fix:`, `feat:`).
- Review checkpoints on Tasks 4 and 5 match the spec.

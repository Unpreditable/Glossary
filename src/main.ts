import { Plugin, TFile, TAbstractFile, debounce, Debouncer, MarkdownView, Notice, WorkspaceLeaf } from "obsidian";
import { GlossarySettings, DEFAULT_SETTINGS } from "./settings";
import { buildTermIndex } from "./index/tableParser";
import { isGlossaryFile } from "./index/glossaryDetector";
import type { TermIndex } from "./index/termIndex";
import { TermMatcher } from "./matcher/termMatcher";
import { createGlossaryViewPlugin } from "./decorations/glossaryViewPlugin";
import { applyHighlightStyle, removeHighlightStyle } from "./decorations/cssInjector";
import { createTooltipExtension } from "./decorations/tooltipExtension";
import { GlossarySettingTab } from "./settings/settingsTab";
import { AddTermModal } from "./glossary/addTermModal";
import { GlossaryItemView, GLOSSARY_VIEW_TYPE } from "./glossary/glossaryView";

export default class GlossaryPlugin extends Plugin {
  settings!: GlossarySettings;
  termIndex: TermIndex = {};
  /** Paths of the glossary files the current index was built from. */
  private indexedFiles = new Set<string>();
  private buildGeneration = 0;
  fileViewPreference: Map<string, 'glossary' | 'markdown'> = new Map();
  private recentlyHandled = new Set<string>();
  private debouncedRebuild!: Debouncer<[], void>;
  matcher!: TermMatcher;

  async onload(): Promise<void> {
    await this.loadSettings();
    this.refreshStyles();
    this.registerEvent(
      this.app.workspace.on('window-open', (win) => applyHighlightStyle(win.doc.body, this.settings)),
    );
    const viewPluginSpec = createGlossaryViewPlugin(this);
    this.registerEditorExtension([
      viewPluginSpec,
      createTooltipExtension(viewPluginSpec),
    ]);

    this.debouncedRebuild = debounce(
      () => { void this.buildGlossaryIndex({ silent: true }); },
      5000,
      true
    );

    // 'changed' fires once the metadata cache has re-read a file, so it sees a glossary tag
    // being added as well as content edits. A file the index was built from still counts after
    // its tag is removed, so its terms are dropped.
    this.registerEvent(
      this.app.metadataCache.on("changed", (file: TFile) => {
        if (this.indexedFiles.has(file.path) || isGlossaryFile(this.app, file)) {
          this.debouncedRebuild();
        }
      })
    );
    this.registerEvent(
      this.app.vault.on("delete", (file: TAbstractFile) => {
        if (this.indexedFiles.has(file.path)) void this.buildGlossaryIndex({ silent: true });
      })
    );
    this.registerEvent(
      this.app.vault.on("rename", (_file: TAbstractFile, oldPath: string) => {
        if (this.indexedFiles.has(oldPath)) void this.buildGlossaryIndex({ silent: true });
      })
    );

    this.addCommand({
      id: "refresh-index",
      name: "Refresh glossary index",
      callback: () => { void this.buildGlossaryIndex(); },
    });

    this.registerEvent(
      this.app.workspace.on('editor-menu', (menu, editor) => {
        let text = editor.getSelection().trim();
        if (!text) {
          const wordRange = editor.wordAt(editor.getCursor());
          if (wordRange) text = editor.getRange(wordRange.from, wordRange.to);
        }
        menu.addItem(item => item
          .setTitle('Add to glossary')
          .setIcon('book-plus')
          .onClick(() => new AddTermModal(this.app, this, text).open()),
        );
      }),
    );

    this.registerView(GLOSSARY_VIEW_TYPE, (leaf) => new GlossaryItemView(leaf, this));

    // The per-file view preference is keyed by path; carry it over when a note is renamed.
    this.registerEvent(
      this.app.vault.on('rename', (file, oldPath) => {
        const pref = this.fileViewPreference.get(oldPath);
        if (pref === undefined) return;
        this.fileViewPreference.delete(oldPath);
        this.fileViewPreference.set(file.path, pref);
      }),
    );

    // Primary: fires when switching tabs or opening a file in a new leaf
    this.registerEvent(
      this.app.workspace.on('active-leaf-change', (leaf) => {
        if (!leaf || leaf.view.getViewType() !== 'markdown') return;
        setTimeout(() => {
          if (leaf.view.getViewType() !== 'markdown') return;
          const file = (leaf.view as MarkdownView).file;
          if (!file || !isGlossaryFile(this.app, file)) return;
          this.handleGlossaryLeaf(leaf, file.path);
        }, 0);
      }),
    );

    // Fallback: fires when a file opens in the already-active leaf (active-leaf-change won't fire then)
    this.registerEvent(
      this.app.workspace.on('file-open', (file) => {
        if (!file || !isGlossaryFile(this.app, file)) return;
        setTimeout(() => {
          this.app.workspace.iterateAllLeaves((leaf) => {
            if (leaf.view.getViewType() === 'markdown' &&
                (leaf.view as MarkdownView).file?.path === file.path) {
              this.handleGlossaryLeaf(leaf, file.path);
            }
          });
        }, 0);
      }),
    );

    this.app.workspace.onLayoutReady(() => {
      void this.buildGlossaryIndex({ silent: true });
      this.scanGlossaryLeaves();
      const ref = this.app.metadataCache.on('resolved', () => {
        this.scanGlossaryLeaves();
        this.app.metadataCache.offref(ref);
      });
    });

    this.addSettingTab(new GlossarySettingTab(this.app, this));
  }

  onunload(): void {
    // Don't detach glossary leaves: Obsidian restores them when the view is re-registered on reload.
    for (const body of this.windowBodies()) removeHighlightStyle(body);
  }

  // Restored leaves on cold start don't reliably fire active-leaf-change/file-open
  private scanGlossaryLeaves(): void {
    this.app.workspace.iterateAllLeaves((leaf) => {
      if (leaf.view.getViewType() !== 'markdown') return;
      const file = (leaf.view as MarkdownView).file;
      if (!file || !isGlossaryFile(this.app, file)) return;
      this.handleGlossaryLeaf(leaf, file.path);
    });
  }

  private handleGlossaryLeaf(leaf: WorkspaceLeaf, filePath: string): void {
    if (this.recentlyHandled.has(filePath)) return;
    this.recentlyHandled.add(filePath);
    setTimeout(() => this.recentlyHandled.delete(filePath), 1500);

    const pref = this.fileViewPreference.get(filePath) ?? 'glossary';
    if (pref === 'markdown') {
      this.injectGlossaryPrompt(leaf, filePath);
    } else {
      void this.redirectToGlossaryView(leaf, filePath);
    }
  }

  // Obsidian's own openFile flow is async and can overwrite our setViewState
  // if we fire too early. Retry with backoff until the view actually sticks.
  private async redirectToGlossaryView(leaf: WorkspaceLeaf, filePath: string): Promise<void> {
    for (let attempt = 0; attempt < 4; attempt++) {
      await new Promise<void>((r) => setTimeout(r, 80 + attempt * 120));
      const viewType = leaf.view.getViewType();
      if (viewType !== 'markdown') return;
      if ((leaf.view as MarkdownView).file?.path !== filePath) return;
      await leaf.setViewState({ type: GLOSSARY_VIEW_TYPE, state: { file: filePath }, active: true });
      if (leaf.view.getViewType() === GLOSSARY_VIEW_TYPE) return;
    }
  }

  injectGlossaryPrompt(leaf: WorkspaceLeaf, filePath: string): void {
    const sourceViewEl = leaf.view.containerEl.querySelector('.markdown-source-view');
    const cmEditor = sourceViewEl?.querySelector('.cm-editor');
    if (!sourceViewEl || !cmEditor) return;
    sourceViewEl.querySelector('.glossary-source-prompt')?.remove();
    const prompt = document.createElement('div');
    prompt.className = 'glossary-source-prompt';
    const btn = document.createElement('button');
    btn.textContent = 'Open as glossary view';
    btn.className = 'glossary-view-source-btn';
    btn.addEventListener('click', () => {
      this.fileViewPreference.set(filePath, 'glossary');
      void leaf.setViewState({ type: GLOSSARY_VIEW_TYPE, state: { file: filePath }, active: true });
    });
    prompt.appendChild(btn);
    sourceViewEl.insertBefore(prompt, cmEditor);
  }

  /** Applies the highlight style setting in every window; styles.css holds the rules. */
  refreshStyles(): void {
    for (const body of this.windowBodies()) applyHighlightStyle(body, this.settings);
  }

  /** The <body> of the main window and of every popout window with a leaf in it. */
  private windowBodies(): Set<HTMLElement> {
    const bodies = new Set<HTMLElement>([document.body]);
    this.app.workspace.iterateAllLeaves((leaf) => { bodies.add(leaf.view.containerEl.doc.body); });
    return bodies;
  }

  /**
   * Has every open editor re-run its extensions. The view plugin sees the new matcher, drops the
   * matches it cached from the old one, and redecorates.
   */
  private refreshEditors(): void {
    this.app.workspace.updateOptions();
  }

  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData() as Partial<GlossarySettings>);
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  async buildGlossaryIndex(options: { silent?: boolean } = {}): Promise<void> {
    // Builds overlap (settings, the add-term modal, the command, file events). Each fills its
    // own index, and only the newest one to start is kept.
    const generation = ++this.buildGeneration;
    const glossaryFiles = this.app.vault.getMarkdownFiles()
      .filter((file) => isGlossaryFile(this.app, file));
    const { termIndex, termCount } = await buildTermIndex(this.app, glossaryFiles, this.settings);
    if (generation !== this.buildGeneration) return;
    this.termIndex = termIndex;
    this.indexedFiles = new Set(glossaryFiles.map((file) => file.path));
    this.matcher = new TermMatcher(this.termIndex, this.settings);
    // Open editors cache matches from the previous matcher (or none, on startup).
    this.refreshEditors();
    if (!options.silent) {
      new Notice(`Rebuilt ${termCount} terms from ${glossaryFiles.length} files`);
    }
  }
}

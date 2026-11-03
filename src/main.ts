import { Plugin, TFile, TAbstractFile, debounce, Debouncer, MarkdownView, Notice, WorkspaceLeaf } from "obsidian";
import type { EditorView } from "@codemirror/view";
import { GlossarySettings, DEFAULT_SETTINGS } from "./settings";
import { parseGlossaryFile } from "./index/tableParser";
import { isGlossaryFile } from "./index/glossaryDetector";
import type { TermIndex } from "./index/termIndex";
import { TermMatcher } from "./matcher/termMatcher";
import { createGlossaryViewPlugin } from "./decorations/glossaryViewPlugin";
import { injectGlossaryStyles, removeGlossaryStyles } from "./decorations/cssInjector";
import { createTooltipExtension } from "./decorations/tooltipExtension";
import { GlossarySettingTab } from "./settings/settingsTab";
import { AddTermModal } from "./glossary/addTermModal";
import { GlossaryItemView, GLOSSARY_VIEW_TYPE } from "./glossary/glossaryView";

export default class GlossaryPlugin extends Plugin {
  settings!: GlossarySettings;
  termIndex: TermIndex = {};
  fileViewPreference: Map<string, 'glossary' | 'markdown'> = new Map();
  private recentlyHandled = new Set<string>();
  private debouncedRebuild!: Debouncer<[], void>;
  matcher!: TermMatcher;
  private viewPluginSpec!: ReturnType<typeof createGlossaryViewPlugin>;

  async onload(): Promise<void> {
    await this.loadSettings();
    injectGlossaryStyles(this.settings);
    this.viewPluginSpec = createGlossaryViewPlugin(this);
    this.registerEditorExtension([
      this.viewPluginSpec,
      createTooltipExtension(this.viewPluginSpec),
    ]);
    console.log("Smart Glossary loaded");

    this.debouncedRebuild = debounce(
      () => { void this.buildGlossaryIndex({ silent: true }); },
      5000,
      true
    );

    this.registerEvent(
      this.app.vault.on("modify", (file: TAbstractFile) => {
        if (file instanceof TFile && isGlossaryFile(this.app, file)) {
          this.debouncedRebuild();
        }
      })
    );

    this.addCommand({
      id: "refresh-glossary",
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
    removeGlossaryStyles();
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
    btn.textContent = 'Open as Glossary View';
    btn.className = 'glossary-view-source-btn';
    btn.addEventListener('click', () => {
      this.fileViewPreference.set(filePath, 'glossary');
      void leaf.setViewState({ type: GLOSSARY_VIEW_TYPE, state: { file: filePath }, active: true });
    });
    prompt.appendChild(btn);
    sourceViewEl.insertBefore(prompt, cmEditor);
  }

  refreshStyles(): void {
    injectGlossaryStyles(this.settings);
    this.app.workspace.iterateAllLeaves((leaf) => {
      if (leaf.view instanceof MarkdownView) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
        const editorView = (leaf.view.editor as any).cm as EditorView;
        if (!editorView) return;
        const p = editorView.plugin(this.viewPluginSpec);
        if (p) {
          p.forceRebuild = true;
          editorView.dispatch({});
        }
      }
    });
  }

  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData() as Partial<GlossarySettings>);
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  async buildGlossaryIndex(options: { silent?: boolean } = {}): Promise<void> {
    this.termIndex = {};
    let termCount = 0;
    const glossaryFiles = this.app.vault.getMarkdownFiles()
      .filter((file) => isGlossaryFile(this.app, file));
    for (const file of glossaryFiles) {
      termCount += await parseGlossaryFile(this.app, file, this.settings, this.termIndex);
    }
    console.log(`Glossary index built: ${termCount} terms from ${glossaryFiles.length} file(s)`);
    this.matcher = new TermMatcher(this.termIndex, this.settings);
    if (!options.silent) {
      new Notice(`Rebuilt ${termCount} terms from ${glossaryFiles.length} files`);
    }
  }
}

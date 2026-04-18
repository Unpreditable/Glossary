import { Plugin, TFile, TAbstractFile, debounce, Debouncer, MarkdownView, Notice } from "obsidian";
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

export default class GlossaryPlugin extends Plugin {
  settings!: GlossarySettings;
  private termIndex: TermIndex = {};
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
      true  // resetTimer: reset window on each glossary file save
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

    this.app.workspace.onLayoutReady(() => {
      void this.buildGlossaryIndex({ silent: true });
    });

    this.addSettingTab(new GlossarySettingTab(this.app, this));
  }

  onunload(): void {
    removeGlossaryStyles();
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

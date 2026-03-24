import { Plugin, TFile, TAbstractFile, debounce, Debouncer, Notice } from "obsidian";
import { GlossarySettings, DEFAULT_SETTINGS } from "./settings";
import { parseGlossaryFile } from "./index/tableParser";
import { isGlossaryFile } from "./index/glossaryDetector";
import type { TermIndex } from "./index/termIndex";
import { TermMatcher } from "./matcher/termMatcher";

export default class GlossaryPlugin extends Plugin {
  settings!: GlossarySettings;
  private termIndex: TermIndex = {};
  private debouncedRebuild!: Debouncer<[], void>;
  matcher!: TermMatcher;

  async onload(): Promise<void> {
    await this.loadSettings();
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
  }

  onunload(): void {
    // cleanup in future phases
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

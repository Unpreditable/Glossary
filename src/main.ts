import { Plugin, TFile, TAbstractFile, debounce, Debouncer } from "obsidian";
import { GlossarySettings, DEFAULT_SETTINGS } from "./settings";

export interface GlossaryTerm {
  sourceFile: string;   // vault path of the glossary file
  acronym?: string;
  fullTerm?: string;
  description?: string;
}

export default class GlossaryPlugin extends Plugin {
  settings!: GlossarySettings;
  private termIndex: Record<string, GlossaryTerm[]> = {};
  private debouncedRebuild!: Debouncer<[], void>;

  async onload(): Promise<void> {
    await this.loadSettings();
    console.log("Smart Glossary loaded");

    this.debouncedRebuild = debounce(
      () => { void this.buildGlossaryIndex(); },
      5000,
      true  // resetTimer: reset window on each glossary file save
    );

    this.registerEvent(
      this.app.vault.on("modify", (file: TAbstractFile) => {
        if (file instanceof TFile && this.isGlossaryFile(file)) {
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
      void this.buildGlossaryIndex();
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

  async buildGlossaryIndex(): Promise<void> {
    this.termIndex = {};
    const glossaryFiles = this.app.vault.getMarkdownFiles()
      .filter((file) => this.isGlossaryFile(file));
    for (const file of glossaryFiles) {
      await this.parseGlossaryFile(file);
    }
    console.log(`Glossary index built: ${glossaryFiles.length} glossary file(s) found`);
  }

  private async parseGlossaryFile(file: TFile): Promise<void> {
    // stub: Phase 4 implements table parsing
    void file;
  }

  private readonly GLOSSARY_TAG = "glossary" as const;

  private isGlossaryFile(file: TFile): boolean {
    const cache = this.app.metadataCache.getFileCache(file);
    const tags = cache?.frontmatter?.tags as string | string[] | undefined;
    return Array.isArray(tags)
      ? tags.includes(this.GLOSSARY_TAG)
      : tags === this.GLOSSARY_TAG;
  }
}

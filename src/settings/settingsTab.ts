import { App, PluginSettingTab, Setting } from 'obsidian';
import type GlossaryPlugin from '../main';
import type { MatchBy, HighlightStyle } from '../settings';

/** A comma-separated text field's value as a list, without blanks. */
function parseList(value: string): string[] {
  return value.split(',').map(s => s.trim()).filter(s => s.length > 0);
}

export class GlossarySettingTab extends PluginSettingTab {
  constructor(app: App, private plugin: GlossaryPlugin) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    // --- Match by ---
    new Setting(containerEl)
      .setName('Match by')
      .setDesc('What to highlight from 3-column tables. 2-column tables always match by acronym.')
      .addDropdown(dd => dd
        .addOption('acronym', 'Acronym only')
        .addOption('term', 'Term only')
        .addOption('both', 'Acronym and term')
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
          .inputEl.addEventListener('blur', () => {
            this.plugin.settings.excludeAcronyms = parseList(t.getValue());
            void this.save();
          }),
        );
    }

    // --- Exclude terms (conditional) ---
    if (this.plugin.settings.matchBy === 'term' || this.plugin.settings.matchBy === 'both') {
      new Setting(containerEl)
        .setName('Exclude terms')
        .setDesc('Comma-separated list of full terms to never highlight.')
        .addText(t => t
          .setPlaceholder('Data, system, process')
          .setValue(this.plugin.settings.excludeTerms.join(', '))
          .inputEl.addEventListener('blur', () => {
            this.plugin.settings.excludeTerms = parseList(t.getValue());
            void this.save();
          }),
        );
    }

    // --- Highlight style ---
    new Setting(containerEl)
      .setName('Highlight style')
      .setDesc('Visual style for highlighted glossary terms.')
      .addDropdown(dd => dd
        .addOption('gradient1',  'Ocean waves')
        .addOption('gradient2',  'Sunset glow')
        .addOption('gradient3',  'Purple haze')
        .addOption('gradient4',  'Peach melba')
        .addOption('gradient5',  'Mint fresh')
        .addOption('gradient6',  'Cotton candy')
        .addOption('gradient7',  'Electric dreams')
        .addOption('gradient8',  'Spring meadow')
        .addOption('gradient9',  'Cloud nine')
        .addOption('gradient10', 'Forest breeze')
        .addOption('solid',      'Solid color')
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
    previewSetting.controlEl.createSpan({
      text: 'Sample term',
      cls: 'glossary-preview',
    });

    // --- Include folders ---
    new Setting(containerEl)
      .setName('Include folders')
      .setDesc('Only highlight terms in these folders (comma-separated). Empty = all folders.')
      .addText(t => t
        .setPlaceholder('Projects, journal')
        .setValue(this.plugin.settings.includeFolders.join(', '))
        .inputEl.addEventListener('blur', () => {
          this.plugin.settings.includeFolders = parseList(t.getValue());
          void this.save();
        }),
      );

    // --- Exclude folders ---
    new Setting(containerEl)
      .setName('Exclude folders')
      .setDesc('Never highlight terms in these folders (comma-separated).')
      .addText(t => t
        .setPlaceholder('Private, archive')
        .setValue(this.plugin.settings.excludeFolders.join(', '))
        .inputEl.addEventListener('blur', () => {
          this.plugin.settings.excludeFolders = parseList(t.getValue());
          void this.save();
        }),
      );
  }

  private async save(): Promise<void> {
    await this.plugin.saveSettings();
    this.plugin.refreshStyles();
    // Rebuilds the index against the new settings and redecorates the open editors.
    await this.plugin.buildGlossaryIndex({ silent: true });
  }
}

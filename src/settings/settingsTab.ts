import { App, PluginSettingTab, debounce } from 'obsidian';
import type { SettingDefinitionItem } from 'obsidian';
import type GlossaryPlugin from '../main';
import type { GlossarySettings } from '../settings';

type Key = keyof GlossarySettings;

/** A comma-separated text field's value as a list, without blanks. */
function parseList(value: string): string[] {
  return value.split(',').map(s => s.trim()).filter(s => s.length > 0);
}

/**
 * Declarative settings (Obsidian 1.13+), so they show up in Obsidian's settings search.
 * Values go through getControlValue/setControlValue: the comma-separated lists are stored as
 * arrays, and every change re-applies the styles and rebuilds the index.
 */
export class GlossarySettingTab extends PluginSettingTab {
  // Text fields report every keystroke; rebuild once typing pauses.
  private rebuildSoon = debounce(() => { void this.plugin.buildGlossaryIndex({ silent: true }); }, 500, true);

  constructor(app: App, private plugin: GlossaryPlugin) {
    super(app, plugin);
  }

  getSettingDefinitions(): SettingDefinitionItem<Key>[] {
    const s = this.plugin.settings;
    return [
      {
        name: 'Match by',
        desc: 'What to highlight from 3-column tables. 2-column tables always match by acronym.',
        control: {
          type: 'dropdown', key: 'matchBy',
          options: { acronym: 'Acronym only', term: 'Term only', both: 'Acronym and term' },
        },
      },
      {
        name: 'Case sensitive',
        desc: 'Match full terms with exact case. Acronyms are always case-sensitive.',
        control: { type: 'toggle', key: 'caseSensitive' },
      },
      {
        name: 'Fuzzy matching',
        desc: 'Match near-spellings of full terms (handles plurals and minor typos).',
        control: { type: 'toggle', key: 'fuzzyMatching' },
      },
      {
        name: 'Exclude acronyms',
        desc: 'Comma-separated list of acronyms to never highlight (e.g. API, UI).',
        visible: () => s.matchBy !== 'term',
        control: { type: 'text', key: 'excludeAcronyms', placeholder: 'API, UI, CSS' },
      },
      {
        name: 'Exclude terms',
        desc: 'Comma-separated list of full terms to never highlight.',
        visible: () => s.matchBy !== 'acronym',
        control: { type: 'text', key: 'excludeTerms', placeholder: 'Data, system, process' },
      },
      {
        name: 'Highlight style',
        desc: 'Visual style for highlighted glossary terms.',
        control: {
          type: 'dropdown', key: 'highlightStyle',
          options: {
            gradient1: 'Ocean waves', gradient2: 'Sunset glow', gradient3: 'Purple haze',
            gradient4: 'Peach melba', gradient5: 'Mint fresh', gradient6: 'Cotton candy',
            gradient7: 'Electric dreams', gradient8: 'Spring meadow', gradient9: 'Cloud nine',
            gradient10: 'Forest breeze', solid: 'Solid color',
          },
        },
      },
      {
        name: 'Highlight color',
        desc: 'Color used for solid underline highlighting.',
        visible: () => s.highlightStyle === 'solid',
        control: { type: 'color', key: 'highlightColor' },
      },
      {
        name: 'Preview',
        desc: 'How highlighted terms appear in your notes.',
        searchable: false,
        render: (setting) => { setting.controlEl.createSpan({ text: 'Sample term', cls: 'glossary-preview' }); },
      },
      {
        name: 'Include folders',
        desc: 'Only highlight terms in these folders (comma-separated). Empty = all folders.',
        control: { type: 'text', key: 'includeFolders', placeholder: 'Projects, journal' },
      },
      {
        name: 'Exclude folders',
        desc: 'Never highlight terms in these folders (comma-separated).',
        control: { type: 'text', key: 'excludeFolders', placeholder: 'Private, archive' },
      },
    ];
  }

  getControlValue(key: string): unknown {
    const value = this.plugin.settings[key as Key];
    return Array.isArray(value) ? value.join(', ') : value;
  }

  async setControlValue(key: string, value: unknown): Promise<void> {
    const settings = this.plugin.settings as unknown as Record<string, unknown>;
    const isList = Array.isArray(settings[key]);
    settings[key] = isList ? parseList(String(value)) : value;
    await this.plugin.saveSettings();
    this.plugin.refreshStyles();
    // Exclusions and highlight color show or hide with the match mode and the style.
    this.refreshDomState();
    // Rebuilds the index against the new settings and redecorates the open editors.
    if (isList) this.rebuildSoon();
    else await this.plugin.buildGlossaryIndex({ silent: true });
  }
}

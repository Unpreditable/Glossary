import { Plugin } from "obsidian";
import { GlossarySettings, DEFAULT_SETTINGS } from "./settings";

export default class GlossaryPlugin extends Plugin {
  settings!: GlossarySettings;

  async onload(): Promise<void> {
    await this.loadSettings();
    console.log("Smart Glossary loaded");
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
}

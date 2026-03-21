import { Plugin } from "obsidian";

export default class GlossaryPlugin extends Plugin {
  async onload(): Promise<void> {
    console.log("Smart Glossary loaded");
  }

  onunload(): void {
    // cleanup in future phases
  }
}

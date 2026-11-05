import { App, Modal, Setting, TFile } from 'obsidian';
import type GlossaryPlugin from '../main';
import { isGlossaryFile } from '../index/glossaryDetector';
import type { GlossaryTerm } from '../index/termIndex';

export class AddTermModal extends Modal {
  private acronym = '';
  private fullTerm = '';
  private description = '';
  private targetFile: TFile | null = null;

  private submitBtn!: HTMLButtonElement;
  private errorsSection!: HTMLElement;
  private duplicatesSection!: HTMLElement;
  private acronymInput!: HTMLInputElement;
  private fullTermInput!: HTMLInputElement;
  private descInput!: HTMLInputElement;

  constructor(app: App, private plugin: GlossaryPlugin, selectedText: string) {
    super(app);
    const trimmed = selectedText.trim();
    if (/^[A-Z0-9]{2,6}$/i.test(trimmed)) {
      this.acronym = trimmed;
    } else {
      this.fullTerm = trimmed;
    }
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('glossary-add-modal');
    contentEl.createEl('h2', { text: 'Add glossary term' });

    const glossaryFiles = this.app.vault.getMarkdownFiles()
      .filter(f => isGlossaryFile(this.app, f));

    if (glossaryFiles.length === 0) {
      contentEl.createEl('p', {
        text: 'No glossary files found. Create a markdown file with tag: glossary in its frontmatter.',
      });
      new Setting(contentEl).addButton(btn => btn
        .setButtonText('Cancel')
        .onClick(() => this.close()),
      );
      return;
    }

    this.targetFile = glossaryFiles[0];

    // Row 1: Acronym + Full Term side by side
    const row1 = contentEl.createDiv({ cls: 'glossary-modal-row' });

    this.acronymInput = row1.createEl('input', { type: 'text', placeholder: 'Acronym' });
    this.acronymInput.value = this.acronym;
    this.acronymInput.addEventListener('input', () => {
      this.acronym = this.acronymInput.value.trim();
      this.updateAll();
    });

    this.fullTermInput = row1.createEl('input', { type: 'text', placeholder: 'Full Term' });
    this.fullTermInput.value = this.fullTerm;
    this.fullTermInput.addEventListener('input', () => {
      this.fullTerm = this.fullTermInput.value.trim();
      this.updateAll();
    });

    // Row 2: Description full-width
    const row2 = contentEl.createDiv({ cls: 'glossary-modal-full' });
    this.descInput = row2.createEl('input', { type: 'text', placeholder: 'Description' });
    this.descInput.value = this.description;
    this.descInput.addEventListener('input', () => {
      this.description = this.descInput.value.trim();
      this.updateAll();
    });

    // Row 3: Target glossary file
    new Setting(contentEl)
      .setName('Target glossary file')
      .addDropdown(dd => {
        for (const f of glossaryFiles) dd.addOption(f.path, f.basename);
        dd.setValue(this.targetFile!.path)
          .onChange(v => {
            const file = this.app.vault.getAbstractFileByPath(v);
            if (file instanceof TFile) this.targetFile = file;
          });
        dd.selectEl.disabled = glossaryFiles.length === 1;
      });

    // Errors section
    this.errorsSection = contentEl.createDiv({ cls: 'glossary-modal-errors' });
    this.errorsSection.setCssProps({ visibility: 'hidden' });

    // Duplicates section
    this.duplicatesSection = contentEl.createDiv({ cls: 'glossary-modal-duplicates' });
    this.duplicatesSection.hide();

    // Buttons
    new Setting(contentEl)
      .addButton(btn => {
        this.submitBtn = btn.buttonEl;
        btn.setButtonText('Add').setCta().onClick(() => { void this.submit(); });
      })
      .addButton(btn => btn.setButtonText('Cancel').onClick(() => this.close()));

    this.updateAll();
  }

  private filledCount(): number {
    return [this.acronym, this.fullTerm, this.description].filter(s => s.length > 0).length;
  }

  private validateAcronym(): string | null {
    if (!this.acronym) return null;
    return /^[A-Z0-9]{2,}$/i.test(this.acronym)
      ? null
      : 'Acronym: at least 2 alphanumeric characters.';
  }

  private validateFullTerm(): string | null {
    if (!this.fullTerm) return null;
    return this.fullTerm.length >= 5
      ? null
      : 'Full term: at least 5 characters.';
  }

  private validateDescription(): string | null {
    if (!this.description) return null;
    return this.description.trim().split(/\s+/).length >= 2
      ? null
      : 'Description: at least 2 words.';
  }

  private updateAll(): void {
    const acronymErr  = this.validateAcronym();
    const fullTermErr = this.validateFullTerm();
    const descErr     = this.validateDescription();

    this.acronymInput.classList.toggle('glossary-input-invalid', acronymErr !== null);
    this.fullTermInput.classList.toggle('glossary-input-invalid', fullTermErr !== null);
    this.descInput.classList.toggle('glossary-input-invalid', descErr !== null);

    const validationErrors = [acronymErr, fullTermErr, descErr].filter(Boolean) as string[];
    const filled = this.filledCount();
    const allErrors: string[] = [];
    if (filled < 2) allErrors.push('Fill in at least 2 of: Acronym, Full Term, Description.');
    allErrors.push(...validationErrors);

    this.errorsSection.empty();
    if (allErrors.length > 0) {
      this.errorsSection.setCssProps({ visibility: 'visible' });
      this.errorsSection.createEl('strong', { text: 'Before you add:' });
      const list = this.errorsSection.createEl('ul', { cls: 'glossary-modal-error-list' });
      for (const err of allErrors) list.createEl('li', { text: err });
    } else {
      this.errorsSection.setCssProps({ visibility: 'hidden' });
    }

    if (this.submitBtn) {
      this.submitBtn.disabled = filled < 2 || validationErrors.length > 0;
    }

    this.updateDuplicates();
  }

  private updateDuplicates(): void {
    if (!this.duplicatesSection) return;

    const matches: GlossaryTerm[] = [];
    const seen = new Set<GlossaryTerm>();

    for (const terms of Object.values(this.plugin.termIndex)) {
      for (const term of terms) {
        if (seen.has(term)) continue;
        const acronymMatch = this.acronym && term.acronym &&
          term.acronym.toLowerCase() === this.acronym.toLowerCase();
        const termMatch = this.fullTerm && term.fullTerm &&
          term.fullTerm.toLowerCase() === this.fullTerm.toLowerCase();
        if (acronymMatch || termMatch) {
          matches.push(term);
          seen.add(term);
        }
      }
    }

    this.duplicatesSection.empty();

    if (matches.length === 0) {
      this.duplicatesSection.hide();
      return;
    }

    this.duplicatesSection.show();
    this.duplicatesSection.createEl('strong', { text: `Duplicate entries (${matches.length})` });

    const list = this.duplicatesSection.createEl('ul', { cls: 'glossary-modal-duplicate-list' });
    for (const m of matches) {
      const parts: string[] = [];
      if (m.acronym)  parts.push(m.acronym);
      if (m.fullTerm) parts.push(m.fullTerm);
      const basename = m.sourceFile.split('/').pop() ?? m.sourceFile;
      list.createEl('li', { text: `${parts.join(' — ')} (${basename})` });
    }
  }

  private async submit(): Promise<void> {
    if (this.filledCount() < 2 || !this.targetFile) return;

    const row = this.buildRow();
    await this.appendToGlossaryFile(this.targetFile, row);
    await this.plugin.buildGlossaryIndex({ silent: true });

    const { contentEl } = this;
    contentEl.empty();
    const msg = contentEl.createEl('p', {
      text: `Added "${this.acronym || this.fullTerm}" to ${this.targetFile.basename} ✓`,
    });
    msg.addClass('glossary-modal-done');
    setTimeout(() => this.close(), 1000);
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

    const isRow = (line: string) => { const t = line.trim(); return t.startsWith('|') && t.endsWith('|'); };
    const isSep = (line: string) => {
      const t = line.trim();
      if (!t.startsWith('|') || !t.endsWith('|')) return false;
      return t.slice(1, -1).split('|').every(c => /^[\s\-:]+$/.test(c));
    };
    const countCols = (line: string) => line.trim().split('|').length - 2;
    const targetCols = this.fullTerm ? 3 : 2;
    const newKey = (this.acronym || this.fullTerm).toLowerCase();

    let insertIdx = -1;

    for (let i = 0; i < lines.length - 1; i++) {
      if (!isRow(lines[i]) || !isSep(lines[i + 1])) continue;
      if (countCols(lines[i]) !== targetCols) continue;

      // Found the right table — scan past its data rows
      let j = i + 2;
      while (j < lines.length && isRow(lines[j])) j++;

      // Find alphabetical insertion point within data rows
      insertIdx = j;
      for (let k = i + 2; k < j; k++) {
        const firstCol = (lines[k].trim().split('|')[1] ?? '').trim().toLowerCase();
        if (firstCol > newKey) { insertIdx = k; break; }
      }
      break;
    }

    if (insertIdx >= 0) {
      lines.splice(insertIdx, 0, row);
    } else {
      const isThreeCol = !!this.fullTerm;
      const header = isThreeCol
        ? '| Acronym | Full Term | Description |'
        : '| Acronym | Description |';
      const sep = isThreeCol ? '| --- | --- | --- |' : '| --- | --- |';
      lines.push('', header, sep, row);
    }

    await this.app.vault.modify(file, lines.join('\n'));
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

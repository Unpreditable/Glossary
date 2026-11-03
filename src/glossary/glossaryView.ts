import { ItemView, TFile, ViewStateResult, WorkspaceLeaf, setIcon } from 'obsidian';
import type GlossaryPlugin from '../main';
import {
  parseFileTables,
  writeRowToContent,
  insertRowAlphabeticallyInContent,
  sortTableInContent,
  setColWidthsInContent,
} from './glossaryFileParser';
import type { ViewRow, ViewTable } from './glossaryFileParser';

export const GLOSSARY_VIEW_TYPE = 'glossary-view';

// Renders inline markdown (links, bold, italic, code, <br>) into an element.
function renderInline(text: string, el: HTMLElement): void {
  for (const [i, part] of text.split('<br>').entries()) {
    if (i > 0) el.createEl('br');
    renderInlinePart(part, el);
  }
}

function renderInlinePart(text: string, el: HTMLElement): void {
  const re = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]|\[([^\]]+)\]\(([^)]+)\)|\*\*(.+?)\*\*|\*(.+?)\*|_(.+?)_|`(.+?)`/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) el.appendText(text.slice(last, m.index));
    if (m[1] !== undefined) {
      el.createEl('a', { text: m[2] ?? m[1], cls: 'internal-link' }).dataset.href = m[1];
    } else if (m[3] !== undefined) {
      el.createEl('a', { href: m[4], text: m[3] });
    } else if (m[5] !== undefined) {
      el.createEl('strong', { text: m[5] });
    } else if (m[6] !== undefined) {
      el.createEl('em', { text: m[6] });
    } else if (m[7] !== undefined) {
      el.createEl('em', { text: m[7] });
    } else if (m[8] !== undefined) {
      el.createEl('code', { text: m[8] });
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) el.appendText(text.slice(last));
}

export class GlossaryItemView extends ItemView {
  private filePath = '';
  private tables: ViewTable[] = [];
  private sectionEls: HTMLElement[] = [];
  private searchQuery = '';
  private pendingAddRow: number | null = null;

  constructor(leaf: WorkspaceLeaf, private plugin: GlossaryPlugin) {
    super(leaf);
  }

  getViewType(): string { return GLOSSARY_VIEW_TYPE; }
  getDisplayText(): string {
    return this.filePath
      ? (this.filePath.split('/').pop()?.replace(/\.md$/, '') ?? 'Glossary')
      : 'Glossary';
  }
  getIcon(): string { return 'book-open'; }

  async setState(state: Record<string, unknown>, result: ViewStateResult): Promise<void> {
    await super.setState(state, result);
    if (typeof state['file'] === 'string' && state['file'] !== this.filePath) {
      this.filePath = state['file'];
      this.searchQuery = '';
      this.contentEl.scrollTop = 0;
      await this.loadAndRender();
    }
  }

  getState(): Record<string, unknown> { return { file: this.filePath }; }

  async onOpen(): Promise<void> { /* populated via setState */ }

  private async loadAndRender(): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(this.filePath);
    if (!(file instanceof TFile)) return;
    this.tables = parseFileTables(await this.app.vault.read(file));
    this.render();
  }

  private render(): void {
    const { contentEl } = this;
    const scrollTop = contentEl.scrollTop;
    contentEl.empty();
    contentEl.addClass('glossary-item-view');

    const toolbar = contentEl.createDiv({ cls: 'glossary-view-toolbar' });
    const searchInput = toolbar.createEl('input', {
      type: 'text', placeholder: 'Search terms…', cls: 'glossary-view-search',
    });
    searchInput.value = this.searchQuery;
    searchInput.addEventListener('input', () => {
      this.searchQuery = searchInput.value.toLowerCase();
      this.applySearch();
    });

    const refreshBtn = toolbar.createEl('button', { cls: 'glossary-view-icon-btn', attr: { 'aria-label': 'Refresh' } });
    setIcon(refreshBtn, 'refresh-cw');
    refreshBtn.addEventListener('click', () => void this.loadAndRender());

    toolbar.createEl('button', { text: 'View source', cls: 'glossary-view-source-btn' })
      .addEventListener('click', () => {
        void (async () => {
          const file = this.app.vault.getAbstractFileByPath(this.filePath);
          if (!(file instanceof TFile)) return;
          this.plugin.fileViewPreference.set(file.path, 'markdown');
          await this.leaf.openFile(file, { state: { mode: 'source' } });
          this.plugin.injectGlossaryPrompt(this.leaf, file.path);
        })();
      });

    const body = contentEl.createDiv({ cls: 'glossary-view-body' });
    this.sectionEls = [];

    if (this.tables.length === 0) {
      body.createEl('p', { text: 'No tables found.', cls: 'glossary-view-empty' });
      return;
    }

    for (const table of this.tables) {
      const section = body.createDiv({ cls: 'glossary-view-section' });
      this.sectionEls.push(section);
      this.renderSection(section, table);
    }

    if (this.searchQuery) this.applySearch();
    contentEl.scrollTop = scrollTop;
  }

  private renderSection(section: HTMLElement, table: ViewTable): void {
    section.empty();
    const tableEl = section.createEl('table', { cls: 'glossary-view-table' });

    const colgroup = tableEl.createEl('colgroup');
    const defaults = table.colCount === 3 ? [12, 25, 63] : table.colCount === 2 ? [18, 82] : null;
    const widths = table.colWidths ?? defaults;
    for (let c = 0; c < table.colCount; c++) {
      const col = colgroup.createEl('col');
      if (widths) col.style.width = `${widths[c]}%`;
    }

    const thead = tableEl.createEl('thead');
    const headerTr = thead.createEl('tr');
    for (const h of table.headerCells) headerTr.createEl('th', { text: h });
    this.attachColResizer(thead, colgroup, table);

    const tbody = tableEl.createEl('tbody');
    for (const row of table.rows) this.renderExistingRow(tbody, table, row);

    const addArea = section.createDiv({ cls: 'glossary-view-add-area' });
    addArea.createEl('button', { text: '+ Add term', cls: 'glossary-view-add-btn' })
      .addEventListener('click', () => this.addNewRow(tbody, table));
    addArea.createEl('span', { text: 'New items will appear in alphabetical order on next open', cls: 'glossary-view-add-hint' });
  }

  // Creates a show/edit cell: display span (rendered markdown) + hidden input.
  // Returns the input element.
  private makeCell(tr: HTMLTableRowElement, value: string): HTMLInputElement {
    const td = tr.createEl('td');

    const display = td.createEl('span', { cls: 'glossary-cell-display' });
    renderInline(value || '\u00a0', display);

    const input = td.createEl('input', { type: 'text', cls: 'glossary-cell-input' });
    input.value = value;
    input.style.display = 'none';

    display.addEventListener('click', () => {
      display.style.display = 'none';
      input.style.display = '';
      input.focus();
      input.select();
    });

    input.addEventListener('blur', () => {
      display.style.display = '';
      input.style.display = 'none';
      display.empty();
      renderInline(input.value || '\u00a0', display);
    });

    return input;
  }

  private focusDisplay(input: HTMLInputElement): void {
    const display = input.parentElement?.querySelector('.glossary-cell-display') as HTMLElement | null;
    display?.click();
  }

  private renderExistingRow(tbody: HTMLElement, table: ViewTable, row: ViewRow): HTMLTableRowElement {
    const tr = tbody.createEl('tr');
    const inputs: HTMLInputElement[] = [];

    for (let c = 0; c < table.colCount; c++) {
      inputs.push(this.makeCell(tr, row.cells[c] ?? ''));
    }

    for (let c = 0; c < table.colCount; c++) {
      inputs[c].addEventListener('blur', () => {
        void this.saveExistingRow(table, row.rowIdx, inputs.map(i => i.value.trim()));
      });
      this.wireKeys(inputs[c], c, inputs, tbody, table, false);
    }

    return tr;
  }

  private addNewRow(tbody: HTMLElement, table: ViewTable): HTMLTableRowElement {
    const tr = tbody.createEl('tr', { cls: 'glossary-row-new' });
    const inputs: HTMLInputElement[] = [];
    let saved = false;

    for (let c = 0; c < table.colCount; c++) {
      inputs.push(this.makeCell(tr, ''));
    }

    const trySave = () => {
      if (saved || tr.contains(document.activeElement)) return;
      const cells = inputs.map(i => i.value.trim());
      if (cells.some(v => v.length > 0)) {
        saved = true;
        void this.saveNewRow(table, cells, tr, inputs);
      }
    };

    for (let c = 0; c < table.colCount; c++) {
      inputs[c].addEventListener('blur', () => setTimeout(trySave, 0));
      this.wireKeys(inputs[c], c, inputs, tbody, table, true);
    }

    this.focusDisplay(inputs[0]);
    return tr;
  }

  private wireKeys(
    input: HTMLInputElement,
    c: number,
    inputs: HTMLInputElement[],
    tbody: HTMLElement,
    table: ViewTable,
    isNew: boolean,
  ): void {
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        const next = inputs[c + 1] ?? inputs[0];
        setTimeout(() => this.focusDisplay(next), 0);
        return;
      }

      if (e.key === 'Enter') {
        e.preventDefault();
        setTimeout(() => {
          const currentTr = input.closest('tr');
          const nextTr = currentTr?.nextElementSibling as HTMLElement | null;
          if (nextTr) {
            (nextTr.querySelector('.glossary-cell-display') as HTMLElement | null)?.click();
          } else if (isNew && inputs.some(inp => inp.value.trim().length > 0)) {
            this.pendingAddRow = table.tableIdx;
            input.blur();
          } else {
            this.addNewRow(tbody, table);
          }
        }, 0);
        return;
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setTimeout(() => {
          const nextTr = input.closest('tr')?.nextElementSibling as HTMLElement | null;
          if (nextTr) {
            (Array.from(nextTr.querySelectorAll('.glossary-cell-display')) as HTMLElement[])[c]?.click();
          }
        }, 0);
        return;
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setTimeout(() => {
          const prevTr = input.closest('tr')?.previousElementSibling as HTMLElement | null;
          if (prevTr) {
            (Array.from(prevTr.querySelectorAll('.glossary-cell-display')) as HTMLElement[])[c]?.click();
          }
        }, 0);
        return;
      }

      if (e.key === 'ArrowRight') {
        const atEnd = input.selectionStart === input.value.length && input.selectionStart === input.selectionEnd;
        const next = inputs[c + 1];
        if (atEnd && next) {
          e.preventDefault();
          setTimeout(() => this.focusDisplay(next), 0);
        }
        return;
      }

      if (e.key === 'ArrowLeft') {
        const atStart = input.selectionStart === 0 && input.selectionStart === input.selectionEnd;
        const prev = inputs[c - 1];
        if (atStart && prev) {
          e.preventDefault();
          setTimeout(() => this.focusDisplay(prev), 0);
        }
      }
    });
  }

  private async saveExistingRow(table: ViewTable, rowIdx: number, cells: string[]): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(this.filePath);
    if (!(file instanceof TFile)) return;
    const content = await this.app.vault.read(file);
    await this.app.vault.modify(file, writeRowToContent(content, table, rowIdx, cells));
    table.rows[rowIdx].cells = cells;
  }

  private async saveNewRow(table: ViewTable, cells: string[], tr: HTMLTableRowElement, inputs: HTMLInputElement[]): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(this.filePath);
    if (!(file instanceof TFile)) return;
    const updated = insertRowAlphabeticallyInContent(await this.app.vault.read(file), table, cells);
    await this.app.vault.modify(file, updated);
    this.tables = parseFileTables(updated);

    const updatedTable = this.tables[table.tableIdx];
    const newRow = updatedTable?.rows.find(r => r.cells.join('\x00') === cells.join('\x00'));

    // Convert in-place: keep glossary-row-new for visual indicator, wire up existing-row save
    if (newRow && updatedTable) {
      for (let c = 0; c < table.colCount; c++) {
        inputs[c].addEventListener('blur', () => {
          void this.saveExistingRow(updatedTable, newRow.rowIdx, inputs.map(i => i.value.trim()));
        });
      }
    }

    this.applySearch();

    if (this.pendingAddRow === table.tableIdx) {
      this.pendingAddRow = null;
      const tbody = tr.parentElement as HTMLElement | null;
      if (tbody && updatedTable) this.addNewRow(tbody, updatedTable);
    }
  }

  private async sortTable(table: ViewTable): Promise<void> {
    const sorted = [...table.rows].sort((a, b) => (a.cells[0] ?? '').localeCompare(b.cells[0] ?? ''));
    const file = this.app.vault.getAbstractFileByPath(this.filePath);
    if (!(file instanceof TFile)) return;
    const updated = sortTableInContent(await this.app.vault.read(file), table, sorted);
    await this.app.vault.modify(file, updated);
    this.tables = parseFileTables(updated);
    const sectionEl = this.sectionEls[table.tableIdx];
    const updatedTable = this.tables[table.tableIdx];
    if (sectionEl && updatedTable) { this.renderSection(sectionEl, updatedTable); this.applySearch(); }
  }

  private attachColResizer(thead: HTMLElement, colgroup: HTMLElement, table: ViewTable): void {
    const colCount = table.colCount;
    const cols = Array.from(colgroup.children) as HTMLElement[];
    const ths = Array.from(thead.querySelectorAll('th')) as HTMLElement[];
    const MIN_W = 60;

    for (let i = 0; i < colCount - 1; i++) {
      const handle = ths[i].createEl('span', { cls: 'glossary-col-resize-handle' });

      handle.addEventListener('mousedown', (e) => {
        e.preventDefault();
        const startX = e.clientX;
        const startLeft = ths[i].offsetWidth;
        const startRight = ths[i + 1].offsetWidth;
        const total = startLeft + startRight;

        const onMove = (mv: MouseEvent) => {
          const delta = mv.clientX - startX;
          const newLeft = Math.min(total - MIN_W, Math.max(MIN_W, startLeft + delta));
          cols[i].style.width = newLeft + 'px';
          cols[i + 1].style.width = (total - newLeft) + 'px';
        };
        const onUp = () => {
          document.removeEventListener('mousemove', onMove);
          document.removeEventListener('mouseup', onUp);
          void this.saveColWidths(table, ths);
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
      });
    }
  }

  // Stores widths as integer percentages summing to 100 in a comment above the table.
  private async saveColWidths(table: ViewTable, ths: HTMLElement[]): Promise<void> {
    const px = ths.map(th => th.offsetWidth);
    const total = px.reduce((a, b) => a + b, 0);
    if (total === 0) return;
    const pct = px.map(w => Math.round((w / total) * 100));
    pct[pct.length - 1] += 100 - pct.reduce((a, b) => a + b, 0);

    const file = this.app.vault.getAbstractFileByPath(this.filePath);
    if (!(file instanceof TFile)) return;
    const updated = setColWidthsInContent(await this.app.vault.read(file), table, pct);
    await this.app.vault.modify(file, updated);
    this.syncTables(updated);
  }

  // Re-parses the file. If its content matches what the DOM shows, only line offsets
  // are patched into the existing table objects (row handlers hold references to them),
  // so the view isn't rebuilt and scroll position is kept. Otherwise re-renders.
  private syncTables(content: string): void {
    const parsed = parseFileTables(content);
    const sameContent = parsed.length === this.tables.length && parsed.every((p, i) => {
      const t = this.tables[i];
      return p.colCount === t.colCount &&
        p.headerCells.join('\x00') === t.headerCells.join('\x00') &&
        p.rows.length === t.rows.length &&
        p.rows.every((r, j) => r.cells.join('\x00') === t.rows[j].cells.join('\x00'));
    });

    if (!sameContent) {
      this.tables = parsed;
      this.render();
      return;
    }
    parsed.forEach((p, i) => {
      const t = this.tables[i];
      t.headerLineIdx = p.headerLineIdx;
      t.colWidths = p.colWidths;
      t.colWidthsLineIdx = p.colWidthsLineIdx;
    });
  }

  private applySearch(): void {
    const q = this.searchQuery;
    for (const section of this.sectionEls) {
      for (const tr of Array.from(section.querySelectorAll('tbody tr'))) {
        const text = Array.from((tr as HTMLElement).querySelectorAll('input'))
          .map(i => i.value).join(' ').toLowerCase();
        (tr as HTMLElement).style.display = (!q || text.includes(q)) ? '' : 'none';
      }
    }
  }

  async onClose(): Promise<void> {
    this.filePath = '';
    this.contentEl.empty();
  }
}

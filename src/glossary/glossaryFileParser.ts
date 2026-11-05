export interface ViewRow {
  cells: string[];
  rowIdx: number;
  /** Line of this row in the file. Rows with all-empty cells are skipped, so this isn't derivable from rowIdx. */
  lineIdx: number;
}

export interface ViewTable {
  tableIdx: number;
  headerCells: string[];
  colCount: number;
  rows: ViewRow[];
  headerLineIdx: number;
  /** Line just past the table's last row line (empty rows included). */
  endLineIdx: number;
  /** Column widths in percent, from a `%%glossary_column_width=10|40|50%%` line above the table. */
  colWidths: number[] | null;
  colWidthsLineIdx: number | null;
}

const COL_WIDTH_RE = /^\s*%%\s*glossary_column_width\s*=\s*([\d.\s|]+?)\s*%%\s*$/;

// Looks for the width comment on the nearest non-blank line above the header.
function findColWidths(lines: string[], headerLineIdx: number, colCount: number): { widths: number[] | null; lineIdx: number | null } {
  let k = headerLineIdx - 1;
  while (k >= 0 && lines[k].trim() === '') k--;
  const m = k >= 0 ? COL_WIDTH_RE.exec(lines[k]) : null;
  if (!m) return { widths: null, lineIdx: null };
  const nums = m[1].split('|').map(n => parseFloat(n));
  const sum = nums.reduce((a, b) => a + b, 0);
  const valid = nums.length === colCount && nums.every(n => n > 0) && sum > 0;
  return { widths: valid ? nums.map(n => (n / sum) * 100) : null, lineIdx: k };
}

function parseCells(line: string): string[] {
  const t = line.trim();
  // `\|` is a pipe inside a cell: park it as NUL (which a note never contains) while splitting.
  // Not a lookbehind split: iOS before 16.4 can't parse one, and the plugin would fail to load.
  return t.slice(1, t.endsWith('|') ? -1 : undefined)
    .replace(/\\\|/g, '\u0000')
    .split('|')
    .map(c => c.trim().split('\u0000').join('|'));
}

function isSep(line: string): boolean {
  const t = line.trim();
  return t.startsWith('|') && t.endsWith('|') &&
    t.slice(1, -1).split('|').every(c => /^[\s\-:]+$/.test(c));
}

function isRow(line: string): boolean {
  const t = line.trim();
  return t.startsWith('|') && t.endsWith('|');
}

export function parseFileTables(content: string): ViewTable[] {
  const lines = content.split('\n');
  const tables: ViewTable[] = [];
  let i = 0;

  while (i < lines.length) {
    if (isRow(lines[i]) && i + 1 < lines.length && isSep(lines[i + 1])) {
      const headerLineIdx = i;
      const headerCells = parseCells(lines[i]);
      const colCount = headerCells.length;
      const rows: ViewRow[] = [];
      let j = i + 2;
      while (j < lines.length && isRow(lines[j])) {
        const cells = parseCells(lines[j]);
        while (cells.length < colCount) cells.push('');
        const sliced = cells.slice(0, colCount);
        if (sliced.some(c => c.length > 0)) {
          rows.push({ cells: sliced, rowIdx: rows.length, lineIdx: j });
        }
        j++;
      }
      const { widths, lineIdx } = findColWidths(lines, headerLineIdx, colCount);
      tables.push({
        tableIdx: tables.length, headerCells, colCount, rows, headerLineIdx, endLineIdx: j,
        colWidths: widths, colWidthsLineIdx: lineIdx,
      });
      i = j;
    } else {
      i++;
    }
  }
  return tables;
}

/**
 * A note's lines without their line endings, and the ending to join them back with. A note
 * saved with Windows endings keeps them: joining with '\n' would leave every line a writer
 * touched or added with a different ending from the rest.
 */
export function splitLines(content: string): { lines: string[]; eol: string } {
  return { lines: content.split(/\r?\n/), eol: content.includes('\r\n') ? '\r\n' : '\n' };
}

function buildRowLine(cells: string[]): string {
  return '| ' + cells.map(c => c.replace(/\|/g, '\\|')).join(' | ') + ' |';
}

// Writers look line positions up in the content they modify rather than trusting the
// caller's (possibly stale) table, so earlier inserts elsewhere in the file can't shift them.
// Null if the table is gone; writers then leave the content unchanged rather than guess.
function freshTable(lines: string[], table: ViewTable): ViewTable | null {
  return parseFileTables(lines.join('\n'))[table.tableIdx] ?? null;
}

export function writeRowToContent(
  content: string,
  table: ViewTable,
  rowIdx: number,
  cells: string[],
): string {
  const { lines, eol } = splitLines(content);
  const row = freshTable(lines, table)?.rows[rowIdx];
  if (!row) return content;
  lines[row.lineIdx] = buildRowLine(cells);
  return lines.join(eol);
}

export function insertRowAlphabeticallyInContent(
  content: string,
  table: ViewTable,
  cells: string[],
): string {
  const { lines, eol } = splitLines(content);
  const fresh = freshTable(lines, table);
  if (!fresh) return content;
  const newKey = (cells[0] ?? '').toLowerCase();
  const before = fresh.rows.find(r => (r.cells[0] ?? '').toLowerCase() > newKey);
  lines.splice(before ? before.lineIdx : fresh.endLineIdx, 0, buildRowLine(cells));
  return lines.join(eol);
}

export function setColWidthsInContent(
  content: string,
  table: ViewTable,
  widths: number[],
): string {
  const { lines, eol } = splitLines(content);
  const fresh = freshTable(lines, table);
  if (!fresh) return content;
  const line = `%%glossary_column_width=${widths.join('|')}%%`;
  if (fresh.colWidthsLineIdx !== null) {
    lines[fresh.colWidthsLineIdx] = line;
  } else {
    lines.splice(fresh.headerLineIdx, 0, line);
  }
  return lines.join(eol);
}

/**
 * Adds a term as the add-term modal does: into the first table with as many columns as `cells`,
 * in alphabetical order, or as a new table at the end of the note when there is none.
 */
export function addTermToContent(content: string, cells: string[]): string {
  const table = parseFileTables(content).find(t => t.colCount === cells.length);
  if (table) return insertRowAlphabeticallyInContent(content, table, cells);

  const { lines, eol } = splitLines(content);
  const header = cells.length === 3 ? ['Acronym', 'Full Term', 'Description'] : ['Acronym', 'Description'];
  lines.push('', buildRowLine(header), '| ' + header.map(() => '---').join(' | ') + ' |', buildRowLine(cells));
  return lines.join(eol);
}

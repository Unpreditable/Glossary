export interface ViewRow {
  cells: string[];
  rowIdx: number;
}

export interface ViewTable {
  tableIdx: number;
  headerCells: string[];
  colCount: number;
  rows: ViewRow[];
  headerLineIdx: number;
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
  return t.slice(1, t.endsWith('|') ? -1 : undefined)
    .split('|')
    .map(c => c.trim().replace(/\\\|/g, '|'));
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
          rows.push({ cells: sliced, rowIdx: rows.length });
        }
        j++;
      }
      const { widths, lineIdx } = findColWidths(lines, headerLineIdx, colCount);
      tables.push({
        tableIdx: tables.length, headerCells, colCount, rows, headerLineIdx,
        colWidths: widths, colWidthsLineIdx: lineIdx,
      });
      i = j;
    } else {
      i++;
    }
  }
  return tables;
}

function buildRowLine(cells: string[]): string {
  return '| ' + cells.map(c => c.replace(/\|/g, '\\|')).join(' | ') + ' |';
}

export function writeRowToContent(
  content: string,
  table: ViewTable,
  rowIdx: number,
  cells: string[],
): string {
  const lines = content.split('\n');
  lines[table.headerLineIdx + 2 + rowIdx] = buildRowLine(cells);
  return lines.join('\n');
}

export function insertRowAlphabeticallyInContent(
  content: string,
  table: ViewTable,
  cells: string[],
): string {
  const lines = content.split('\n');
  const newKey = (cells[0] ?? '').toLowerCase();
  const dataStart = table.headerLineIdx + 2;
  const dataEnd = dataStart + table.rows.length;

  let insertIdx = dataEnd;
  for (let k = dataStart; k < dataEnd; k++) {
    const firstCol = ((lines[k] ?? '').trim().split('|')[1] ?? '').trim().toLowerCase();
    if (firstCol > newKey) { insertIdx = k; break; }
  }

  lines.splice(insertIdx, 0, buildRowLine(cells));
  return lines.join('\n');
}

export function appendRowToContent(
  content: string,
  table: ViewTable,
  cells: string[],
): string {
  const lines = content.split('\n');
  const insertAt = table.headerLineIdx + 2 + table.rows.length;
  lines.splice(insertAt, 0, buildRowLine(cells));
  return lines.join('\n');
}

export function sortTableInContent(
  content: string,
  table: ViewTable,
  sortedRows: ViewRow[],
): string {
  const lines = content.split('\n');
  const dataStart = table.headerLineIdx + 2;
  for (let i = 0; i < sortedRows.length; i++) {
    lines[dataStart + i] = buildRowLine(sortedRows[i].cells);
  }
  return lines.join('\n');
}

export function setColWidthsInContent(
  content: string,
  table: ViewTable,
  widths: number[],
): string {
  const lines = content.split('\n');
  const line = `%%glossary_column_width=${widths.join('|')}%%`;
  if (table.colWidthsLineIdx !== null) {
    lines[table.colWidthsLineIdx] = line;
  } else {
    lines.splice(table.headerLineIdx, 0, line);
  }
  return lines.join('\n');
}

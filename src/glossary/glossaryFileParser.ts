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
      tables.push({ tableIdx: tables.length, headerCells, colCount, rows, headerLineIdx });
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

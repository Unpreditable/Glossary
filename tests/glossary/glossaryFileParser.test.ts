import {
  parseFileTables,
  writeRowToContent,
  insertRowAlphabeticallyInContent,
  setColWidthsInContent,
  addTermToContent,
} from '../../src/glossary/glossaryFileParser';

// The second table has an all-empty row in the middle: parsing skips it, so a row's
// index no longer matches its line offset from the header.
const CONTENT = [
  '# Tech',                           // 0
  '',                                 // 1
  '| Acronym | Description |',        // 2
  '|---|---|',                        // 3
  '| API | A contract |',             // 4
  '',                                 // 5
  '# Business',                       // 6
  '',                                 // 7
  '| Acronym | Description |',        // 8
  '|---|---|',                        // 9
  '| KPI | A measured goal |',        // 10
  '| | |',                            // 11
  '| ROI | Gain relative to cost |',  // 12
].join('\n');

const lines = (content: string) => content.split('\n');

describe('parseFileTables', () => {
  it('records each row\'s file line, skipping empty rows', () => {
    const business = parseFileTables(CONTENT)[1];
    expect(business.rows.map(r => [r.cells[0], r.rowIdx, r.lineIdx])).toEqual([
      ['KPI', 0, 10],
      ['ROI', 1, 12],
    ]);
    expect(business.endLineIdx).toBe(13);
  });

  it('reads an escaped pipe as part of its cell', () => {
    const [table] = parseFileTables('| A | B |\n|---|---|\n| OR | a \\| b |');
    expect(table.rows[0].cells).toEqual(['OR', 'a | b']);
  });

  it('reads back a cell with a pipe exactly as it was written', () => {
    const content = '| A | B |\n|---|---|\n| X | old |';
    const written = writeRowToContent(content, parseFileTables(content)[0], 0, ['X', 'a | b']);
    expect(parseFileTables(written)[0].rows[0].cells).toEqual(['X', 'a | b']);
  });
});

describe('writers on a table with an empty row', () => {
  const business = parseFileTables(CONTENT)[1];

  it('writeRowToContent edits the row after the empty one', () => {
    const out = lines(writeRowToContent(CONTENT, business, 1, ['ROI', 'Return']));
    expect(out[11]).toBe('| | |');
    expect(out[12]).toBe('| ROI | Return |');
  });

  it('insertRowAlphabeticallyInContent inserts before the first later key', () => {
    const out = lines(insertRowAlphabeticallyInContent(CONTENT, business, ['NPS', 'Net promoter']));
    expect(out.slice(10, 14)).toEqual([
      '| KPI | A measured goal |',
      '| | |',
      '| NPS | Net promoter |',
      '| ROI | Gain relative to cost |',
    ]);
  });

  it('insertRowAlphabeticallyInContent appends past the last row line', () => {
    const out = lines(insertRowAlphabeticallyInContent(CONTENT, business, ['ZZZ', 'Last']));
    expect(out[13]).toBe('| ZZZ | Last |');
  });
});

// A table right under a text line is part of that paragraph in Markdown, and isn't rendered.
describe('setColWidthsInContent', () => {
  it('leaves a blank line between the width comment and the table', () => {
    const out = lines(setColWidthsInContent(CONTENT, parseFileTables(CONTENT)[0], [30, 70]));
    expect(out.slice(0, 5)).toEqual(['# Tech', '', '%%glossary_column_width=30|70%%', '', '| Acronym | Description |']);
  });

  it('adds the blank line under a comment written without one', () => {
    const content = '%%glossary_column_width=50|50%%\n| A | B |\n|---|---|\n| X | Y |';
    const out = lines(setColWidthsInContent(content, parseFileTables(content)[0], [30, 70]));
    expect(out.slice(0, 3)).toEqual(['%%glossary_column_width=30|70%%', '', '| A | B |']);
  });

  it('replaces a comment in place when the blank line is there', () => {
    const once = setColWidthsInContent(CONTENT, parseFileTables(CONTENT)[0], [30, 70]);
    const twice = setColWidthsInContent(once, parseFileTables(once)[0], [40, 60]);
    expect(twice).toBe(once.replace('30|70', '40|60'));
  });
});

describe('writers with a stale table', () => {
  it('use current line positions after the file shifted', () => {
    const business = parseFileTables(CONTENT)[1];
    // A width line and its blank line added above the first table push the second one down two lines.
    const shifted = setColWidthsInContent(CONTENT, parseFileTables(CONTENT)[0], [30, 70]);
    const out = lines(writeRowToContent(shifted, business, 0, ['KPI', 'Edited']));
    expect(out[12]).toBe('| KPI | Edited |');
    expect(out[13]).toBe('| | |');
  });

  it('leave the content unchanged when the table no longer exists', () => {
    const business = parseFileTables(CONTENT)[1];
    const oneTable = lines(CONTENT).slice(0, 6).join('\n');
    expect(writeRowToContent(oneTable, business, 0, ['X', 'Y'])).toBe(oneTable);
    expect(insertRowAlphabeticallyInContent(oneTable, business, ['X', 'Y'])).toBe(oneTable);
    expect(setColWidthsInContent(oneTable, business, [50, 50])).toBe(oneTable);
  });
});

describe('writers on a note with Windows line endings', () => {
  const crlf = CONTENT.split('\n').join('\r\n');
  const business = parseFileTables(crlf)[1];
  // Every line break in the result is \r\n: none left bare by an edited or added line.
  const allCrlf = (s: string) => !/[^\r]\n/.test(s) && s.includes('\r\n');

  it('writeRowToContent keeps them', () => {
    const out = writeRowToContent(crlf, business, 0, ['KPI', 'Edited']);
    expect(allCrlf(out)).toBe(true);
    expect(out.split('\r\n')[10]).toBe('| KPI | Edited |');
  });

  it('insertRowAlphabeticallyInContent keeps them', () => {
    expect(allCrlf(insertRowAlphabeticallyInContent(crlf, business, ['NPS', 'Net promoter']))).toBe(true);
    expect(allCrlf(insertRowAlphabeticallyInContent(crlf, business, ['ZZZ', 'Last']))).toBe(true);
  });

  it('setColWidthsInContent keeps them', () => {
    expect(allCrlf(setColWidthsInContent(crlf, business, [30, 70]))).toBe(true);
  });

  it('addTermToContent keeps them, also when it adds a table', () => {
    expect(allCrlf(addTermToContent(crlf, ['NPS', 'Net promoter']))).toBe(true);
    expect(allCrlf(addTermToContent(crlf, ['NPS', 'Net Promoter Score', 'Loyalty']))).toBe(true);
  });
});

describe('addTermToContent', () => {
  it('inserts into the first table with as many columns, alphabetically', () => {
    const out = lines(addTermToContent(CONTENT, ['BIOS', 'Firmware']));
    expect(out.slice(4, 6)).toEqual(['| API | A contract |', '| BIOS | Firmware |']);
  });

  it('adds a table at the end when no table has as many columns', () => {
    const out = lines(addTermToContent(CONTENT, ['NPS', 'Net Promoter Score', 'Loyalty']));
    expect(out.slice(-3)).toEqual([
      '| Acronym | Full Term | Description |',
      '| --- | --- | --- |',
      '| NPS | Net Promoter Score | Loyalty |',
    ]);
  });

  it('escapes a pipe in a cell', () => {
    const out = addTermToContent(CONTENT, ['OR', 'a | b']);
    expect(lines(out)).toContain('| OR | a \\| b |');
  });
});

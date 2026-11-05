import {
  parseFileTables,
  writeRowToContent,
  insertRowAlphabeticallyInContent,
  sortTableInContent,
  setColWidthsInContent,
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

  it('sortTableInContent writes rows to their lines and leaves the empty row', () => {
    const reversed = [...business.rows].reverse();
    const out = lines(sortTableInContent(CONTENT, business, reversed));
    expect(out.slice(10, 13)).toEqual([
      '| ROI | Gain relative to cost |',
      '| | |',
      '| KPI | A measured goal |',
    ]);
  });
});

describe('writers with a stale table', () => {
  it('use current line positions after the file shifted', () => {
    const business = parseFileTables(CONTENT)[1];
    // A width line added above the first table pushes the second one down a line.
    const shifted = setColWidthsInContent(CONTENT, parseFileTables(CONTENT)[0], [30, 70]);
    const out = lines(writeRowToContent(shifted, business, 0, ['KPI', 'Edited']));
    expect(out[11]).toBe('| KPI | Edited |');
    expect(out[12]).toBe('| | |');
  });

  it('leave the content unchanged when the table no longer exists', () => {
    const business = parseFileTables(CONTENT)[1];
    const oneTable = lines(CONTENT).slice(0, 6).join('\n');
    expect(writeRowToContent(oneTable, business, 0, ['X', 'Y'])).toBe(oneTable);
    expect(insertRowAlphabeticallyInContent(oneTable, business, ['X', 'Y'])).toBe(oneTable);
    expect(sortTableInContent(oneTable, business, business.rows)).toBe(oneTable);
    expect(setColWidthsInContent(oneTable, business, [50, 50])).toBe(oneTable);
  });
});

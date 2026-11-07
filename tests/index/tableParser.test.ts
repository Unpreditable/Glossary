import { buildTermIndex, parseGlossaryFile } from '../../src/index/tableParser';
import type { TermIndex } from '../../src/index/termIndex';
import type { GlossarySettings } from '../../src/settings';
import type { App } from 'obsidian';
import { makeMockFile } from '../fixtures/mockApp';

const SETTINGS: GlossarySettings = {
  matchBy: 'both',
  caseSensitive: false,
  fuzzyMatching: false,
  excludeAcronyms: [],
  excludeTerms: [],
  includeFolders: [],
  excludeFolders: [],
  highlightStyle: 'gradient1',
  highlightColor: '#ff6b35',
};

async function index(content: string): Promise<{ termIndex: TermIndex; count: number }> {
  const termIndex: TermIndex = {};
  const app = { vault: { read: async () => content } } as unknown as App;
  const count = await parseGlossaryFile(app, makeMockFile('glossary.md'), SETTINGS, termIndex);
  return { termIndex, count };
}

describe('parseGlossaryFile', () => {
  it('indexes a row whose cell contains an escaped pipe, unescaped', async () => {
    const { termIndex, count } = await index([
      '| Acronym | Full term | Description |',
      '|---|---|---|',
      '| OR | Logical or | Written a \\| b |',
    ].join('\n'));
    expect(count).toBe(1);
    expect(termIndex['OR']?.[0].description).toBe('Written a | b');
  });

  it('indexes 2- and 3-column tables, skipping headers and empty rows', async () => {
    const { termIndex, count } = await index([
      '| Acronym | Description |',
      '|---|---|',
      '| CPU | Executes instructions |',
      '| | |',
      '',
      '| Acronym | Full term | Description |',
      '|---|---|---|',
      '| API | Application Programming Interface | A contract |',
    ].join('\n'));
    expect(count).toBe(2);
    expect(Object.keys(termIndex).sort()).toEqual(
      ['API', 'APIs', 'CPU', 'CPUs', 'application programming interface'],
    );
  });

  it('ignores tables that have neither 2 nor 3 columns', async () => {
    const { count } = await index([
      '| A | B | C | D |',
      '|---|---|---|---|',
      '| X | Y | Z | W |',
    ].join('\n'));
    expect(count).toBe(0);
  });
});

describe('buildTermIndex', () => {
  it('gives overlapping builds an index each, with every term once', async () => {
    const content = ['| A | B |', '|---|---|', '| API | A contract |'].join('\n');
    // Every awaited read hands control to the other build, so the two interleave file by file.
    const app = { vault: { read: async () => content } } as unknown as App;
    const files = [makeMockFile('one.md'), makeMockFile('two.md')];
    const [first, second] = await Promise.all([
      buildTermIndex(app, files, SETTINGS),
      buildTermIndex(app, files, SETTINGS),
    ]);
    expect(first.termIndex).not.toBe(second.termIndex);
    expect(first.termIndex['API']).toHaveLength(2); // one per file
    expect(second.termIndex['API']).toHaveLength(2);
    expect(first.termCount).toBe(2);
  });
});

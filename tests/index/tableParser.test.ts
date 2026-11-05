import { parseGlossaryFile } from '../../src/index/tableParser';
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

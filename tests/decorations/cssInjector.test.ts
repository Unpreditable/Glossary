import { buildStylesheet } from '../../src/decorations/cssInjector';
import type { GlossarySettings } from '../../src/settings';

const defaults: GlossarySettings = {
  matchBy: 'both',
  caseSensitive: false,
  fuzzyMatching: true,
  excludeAcronyms: [],
  excludeTerms: [],
  includeFolders: [],
  excludeFolders: [],
  highlightStyle: 'gradient1',
  highlightColor: '#ff6b35',
};

describe('buildStylesheet — gradient styles', () => {
  it('gradient1 contains #0065ff and background-clip: text', () => {
    const css = buildStylesheet({ ...defaults, highlightStyle: 'gradient1' });
    expect(css).toContain('#0065ff');
    expect(css).toContain('background-clip: text');
  });

  it('gradient2 contains #ff6b6b', () => {
    const css = buildStylesheet({ ...defaults, highlightStyle: 'gradient2' });
    expect(css).toContain('#ff6b6b');
  });

  it('gradient3 contains #667eea', () => {
    const css = buildStylesheet({ ...defaults, highlightStyle: 'gradient3' });
    expect(css).toContain('#667eea');
  });

  it('gradient4 contains #ffecd2', () => {
    const css = buildStylesheet({ ...defaults, highlightStyle: 'gradient4' });
    expect(css).toContain('#ffecd2');
  });

  it('gradient5 contains #a8edea', () => {
    const css = buildStylesheet({ ...defaults, highlightStyle: 'gradient5' });
    expect(css).toContain('#a8edea');
  });

  it('gradient6 contains #ff9a9e', () => {
    const css = buildStylesheet({ ...defaults, highlightStyle: 'gradient6' });
    expect(css).toContain('#ff9a9e');
  });

  it('gradient7 contains #21d4fd', () => {
    const css = buildStylesheet({ ...defaults, highlightStyle: 'gradient7' });
    expect(css).toContain('#21d4fd');
  });

  it('gradient8 contains #96fbc4', () => {
    const css = buildStylesheet({ ...defaults, highlightStyle: 'gradient8' });
    expect(css).toContain('#96fbc4');
  });

  it('gradient9 contains #fbc2eb', () => {
    const css = buildStylesheet({ ...defaults, highlightStyle: 'gradient9' });
    expect(css).toContain('#fbc2eb');
  });

  it('gradient10 contains #84fab0', () => {
    const css = buildStylesheet({ ...defaults, highlightStyle: 'gradient10' });
    expect(css).toContain('#84fab0');
  });

  it('all 10 gradient outputs are mutually distinct strings', () => {
    const results = (
      ['gradient1', 'gradient2', 'gradient3', 'gradient4', 'gradient5',
       'gradient6', 'gradient7', 'gradient8', 'gradient9', 'gradient10'] as const
    ).map(style => buildStylesheet({ ...defaults, highlightStyle: style }));

    const unique = new Set(results);
    expect(unique.size).toBe(10);
  });

  it('gradient1 does NOT contain text-decoration: underline', () => {
    const css = buildStylesheet({ ...defaults, highlightStyle: 'gradient1' });
    expect(css).not.toContain('text-decoration: underline');
  });

  it('gradient style contains color: transparent', () => {
    const css = buildStylesheet({ ...defaults, highlightStyle: 'gradient1' });
    expect(css).toContain('color: transparent');
  });
});

describe('buildStylesheet — solid style', () => {
  it('solid contains text-decoration: underline', () => {
    const css = buildStylesheet({ ...defaults, highlightStyle: 'solid', highlightColor: '#ff6b35' });
    expect(css).toContain('text-decoration: underline');
  });

  it('solid contains text-decoration-color with highlightColor', () => {
    const css = buildStylesheet({ ...defaults, highlightStyle: 'solid', highlightColor: '#ff6b35' });
    expect(css).toContain('text-decoration-color: #ff6b35');
  });

  it('solid contains background-color with 15 hex opacity suffix', () => {
    const css = buildStylesheet({ ...defaults, highlightStyle: 'solid', highlightColor: '#ff6b35' });
    expect(css).toContain('background-color: #ff6b3515');
  });

  it('solid contains text-decoration-thickness: 2px', () => {
    const css = buildStylesheet({ ...defaults, highlightStyle: 'solid', highlightColor: '#ff6b35' });
    expect(css).toContain('text-decoration-thickness: 2px');
  });

  it('solid does NOT contain background-clip: text', () => {
    const css = buildStylesheet({ ...defaults, highlightStyle: 'solid', highlightColor: '#ff6b35' });
    expect(css).not.toContain('background-clip: text');
  });
});

import { TermMatcher, TermMatch } from '../../src/matcher/termMatcher';
import type { TermIndex } from '../../src/index/termIndex';
import type { GlossarySettings } from '../../src/settings';
import { makeMockApp, makeMockFile } from '../fixtures/mockApp';

function makeSettings(overrides: Partial<GlossarySettings> = {}): GlossarySettings {
  return {
    matchBy: 'both',
    caseSensitive: false,
    fuzzyMatching: false,
    excludeAcronyms: [],
    excludeTerms: [],
    includeFolders: [],
    excludeFolders: [],
    highlightStyle: 'gradient1',
    highlightColor: '#ff6b35',
    ...overrides,
  };
}

// ─── MATC-01: matchBy routing ───────────────────────────────────────────────

describe('MATC-01: matchBy routing', () => {
  const termIndex: TermIndex = {
    'API': [{ sourceFile: 'glossary.md', acronym: 'API' }],
    'application-programming-interface': [{ sourceFile: 'glossary.md', fullTerm: 'application-programming-interface' }],
  };

  it('matchBy=acronym returns only acronym matches', () => {
    const matcher = new TermMatcher(termIndex, makeSettings({ matchBy: 'acronym' }));
    const matches = matcher.findTermsInText(
      'The API and application-programming-interface are different',
      0,
    );
    expect(matches.length).toBe(1);
    expect(matches[0].terms[0].acronym).toBe('API');
  });

  it('matchBy=term returns only full-term matches', () => {
    const matcher = new TermMatcher(termIndex, makeSettings({ matchBy: 'term' }));
    const matches = matcher.findTermsInText(
      'The API and application-programming-interface are different',
      0,
    );
    expect(matches.length).toBe(1);
    expect(matches[0].terms[0].fullTerm).toBe('application-programming-interface');
  });

  it('matchBy=both returns matches from both branches', () => {
    const matcher = new TermMatcher(termIndex, makeSettings({ matchBy: 'both' }));
    const matches = matcher.findTermsInText(
      'The API and application-programming-interface are different',
      0,
    );
    expect(matches.length).toBe(2);
  });
});

// ─── MATC-02: case sensitivity ───────────────────────────────────────────────

describe('MATC-02: case sensitivity', () => {
  it('acronym matching is always case-sensitive (no match for lowercase)', () => {
    const termIndex: TermIndex = {
      'API': [{ sourceFile: 'glossary.md', acronym: 'API' }],
    };
    const matcher = new TermMatcher(termIndex, makeSettings({ caseSensitive: false }));
    const matches = matcher.findTermsInText('the api works', 0);
    expect(matches.length).toBe(0);
  });

  it('acronym matching is always case-sensitive (match for exact case)', () => {
    const termIndex: TermIndex = {
      'API': [{ sourceFile: 'glossary.md', acronym: 'API' }],
    };
    const matcher = new TermMatcher(termIndex, makeSettings({ caseSensitive: false }));
    const matches = matcher.findTermsInText('the API works', 0);
    expect(matches.length).toBe(1);
  });

  it('term matching with caseSensitive=false matches case-insensitively', () => {
    const termIndex: TermIndex = {
      'machine-learning': [{ sourceFile: 'glossary.md', fullTerm: 'Machine Learning' }],
    };
    const matcher = new TermMatcher(termIndex, makeSettings({ caseSensitive: false }));
    const matches = matcher.findTermsInText('machine learning', 0);
    expect(matches.length).toBe(1);
  });

  it('term matching with caseSensitive=true does not match different case', () => {
    const termIndex: TermIndex = {
      'machine-learning': [{ sourceFile: 'glossary.md', fullTerm: 'Machine Learning' }],
    };
    const matcher = new TermMatcher(termIndex, makeSettings({ caseSensitive: true }));
    const matches = matcher.findTermsInText('machine learning', 0);
    expect(matches.length).toBe(0);
  });
});

// ─── MATC-03: fuzzy matching ─────────────────────────────────────────────────

describe('MATC-03: fuzzy matching', () => {
  it('fuzzyMatching=true finds terms within edit-distance threshold', () => {
    const termIndex: TermIndex = {
      'kubernetes': [{ sourceFile: 'glossary.md', fullTerm: 'Kubernetes' }],
    };
    const matcher = new TermMatcher(termIndex, makeSettings({ fuzzyMatching: true }));
    const matches = matcher.findTermsInText('Kubernetss is great', 0);
    expect(matches.length).toBe(1);
  });

  it('fuzzyMatching=false does not match typos', () => {
    const termIndex: TermIndex = {
      'kubernetes': [{ sourceFile: 'glossary.md', fullTerm: 'Kubernetes' }],
    };
    const matcher = new TermMatcher(termIndex, makeSettings({ fuzzyMatching: false }));
    const matches = matcher.findTermsInText('Kubernetss is great', 0);
    expect(matches.length).toBe(0);
  });

  it('fuzzy does NOT apply to acronyms', () => {
    const termIndex: TermIndex = {
      'API': [{ sourceFile: 'glossary.md', acronym: 'API' }],
    };
    const matcher = new TermMatcher(termIndex, makeSettings({ fuzzyMatching: true }));
    const matches = matcher.findTermsInText('APZ makes things work', 0);
    expect(matches.length).toBe(0);
  });

  it('getFuzzyThreshold returns 1 for short terms (length < 6)', () => {
    const matcher = new TermMatcher({}, makeSettings());
    expect(matcher.getFuzzyThreshold('cat')).toBe(1);
    expect(matcher.getFuzzyThreshold('abc')).toBe(1);
  });

  it('getFuzzyThreshold returns 2 for medium terms (length <= 8)', () => {
    const matcher = new TermMatcher({}, makeSettings());
    expect(matcher.getFuzzyThreshold('network')).toBe(2);
    expect(matcher.getFuzzyThreshold('database')).toBe(2);
  });

  it('getFuzzyThreshold returns 3 for long terms (length > 8)', () => {
    const matcher = new TermMatcher({}, makeSettings());
    expect(matcher.getFuzzyThreshold('Kubernetes')).toBe(3);
    expect(matcher.getFuzzyThreshold('programming')).toBe(3);
  });
});

// ─── MATC-04: overlap deduplication ─────────────────────────────────────────

describe('MATC-04: overlap deduplication', () => {
  it('acronym wins when both acronym and full-term match at same position', () => {
    const termIndex: TermIndex = {
      'API': [{ sourceFile: 'glossary.md', acronym: 'API' }],
      'api-key': [{ sourceFile: 'glossary.md', fullTerm: 'api' }],
    };
    const matcher = new TermMatcher(termIndex, makeSettings({ matchBy: 'both' }));
    const matches = matcher.findTermsInText('Use API here', 0);
    // Only the acronym match should remain
    const apiMatches = matches.filter(m => m.matched === 'API' || m.matched.toLowerCase() === 'api');
    expect(apiMatches.length).toBe(1);
    expect(apiMatches[0].terms[0].acronym).toBe('API');
  });

  it('result array has no overlapping ranges', () => {
    const termIndex: TermIndex = {
      'ML': [{ sourceFile: 'glossary.md', acronym: 'ML' }],
      'mlops': [{ sourceFile: 'glossary.md', fullTerm: 'ML' }],
    };
    const matcher = new TermMatcher(termIndex, makeSettings({ matchBy: 'both' }));
    const matches = matcher.findTermsInText('Use ML in production', 0);
    // Verify no overlaps
    for (let i = 0; i < matches.length - 1; i++) {
      expect(matches[i].to).toBeLessThanOrEqual(matches[i + 1].from);
    }
  });
});

// ─── HIGH-03: glossary file guard ────────────────────────────────────────────

describe('HIGH-03: glossary file guard', () => {
  it('shouldProcessFile returns false for glossary files', () => {
    const app = makeMockApp(['glossary/terms.md']);
    const file = makeMockFile('glossary/terms.md');
    const matcher = new TermMatcher({}, makeSettings());
    expect(matcher.shouldProcessFile(app, file)).toBe(false);
  });

  it('shouldProcessFile returns true for normal note files', () => {
    const app = makeMockApp(['glossary/terms.md']);
    const file = makeMockFile('notes/my-note.md');
    const matcher = new TermMatcher({}, makeSettings());
    expect(matcher.shouldProcessFile(app, file)).toBe(true);
  });
});

// ─── FOLD-01: includeFolders ─────────────────────────────────────────────────

describe('FOLD-01: includeFolders', () => {
  it('returns true when file is inside an included folder', () => {
    const app = makeMockApp();
    const file = makeMockFile('notes/foo.md');
    const matcher = new TermMatcher({}, makeSettings({ includeFolders: ['notes'] }));
    expect(matcher.shouldProcessFile(app, file)).toBe(true);
  });

  it('returns false when file path has folder as prefix but not as folder (trailing slash)', () => {
    const app = makeMockApp();
    const file = makeMockFile('notes-archive/foo.md');
    const matcher = new TermMatcher({}, makeSettings({ includeFolders: ['notes'] }));
    expect(matcher.shouldProcessFile(app, file)).toBe(false);
  });

  it('returns true for any non-glossary file when includeFolders is empty', () => {
    const app = makeMockApp();
    const file = makeMockFile('anywhere/foo.md');
    const matcher = new TermMatcher({}, makeSettings({ includeFolders: [] }));
    expect(matcher.shouldProcessFile(app, file)).toBe(true);
  });
});

// ─── FOLD-02: excludeFolders ─────────────────────────────────────────────────

describe('FOLD-02: excludeFolders', () => {
  it('returns false when file is inside an excluded folder', () => {
    const app = makeMockApp();
    const file = makeMockFile('archive/old.md');
    const matcher = new TermMatcher({}, makeSettings({ excludeFolders: ['archive'] }));
    expect(matcher.shouldProcessFile(app, file)).toBe(false);
  });

  it('returns true when file is not in any excluded folder', () => {
    const app = makeMockApp();
    const file = makeMockFile('notes/foo.md');
    const matcher = new TermMatcher({}, makeSettings({ excludeFolders: ['archive'] }));
    expect(matcher.shouldProcessFile(app, file)).toBe(true);
  });

  it('excludeFolders comparison is case-insensitive', () => {
    const app = makeMockApp();
    const file = makeMockFile('archive/old.md');
    const matcher = new TermMatcher({}, makeSettings({ excludeFolders: ['Archive'] }));
    expect(matcher.shouldProcessFile(app, file)).toBe(false);
  });
});

// ─── editDistance utility ────────────────────────────────────────────────────

describe('editDistance', () => {
  it('returns 0 for identical strings', () => {
    const matcher = new TermMatcher({}, makeSettings());
    expect(matcher.editDistance('hello', 'hello')).toBe(0);
  });

  it('returns 1 for single substitution', () => {
    const matcher = new TermMatcher({}, makeSettings());
    expect(matcher.editDistance('cat', 'bat')).toBe(1);
  });

  it('returns correct distance for Kubernetss vs Kubernetes', () => {
    const matcher = new TermMatcher({}, makeSettings());
    expect(matcher.editDistance('Kubernetss', 'Kubernetes')).toBe(1);
  });
});

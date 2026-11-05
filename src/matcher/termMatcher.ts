import { App, TFile } from 'obsidian';
import type { TermIndex, GlossaryTerm } from '../index/termIndex';
import { isGlossaryFile } from '../index/glossaryDetector';
import type { GlossarySettings } from '../settings';

export interface TermMatch {
  from: number;
  to: number;
  matched: string;
  terms: GlossaryTerm[];
  /** Whether this hit came from an acronym key or a full-term key of the index. */
  kind: 'acronym' | 'term';
}

/**
 * An index key is an acronym key when it is a row's acronym or that acronym's plural.
 * A row with both an acronym and a full term shares one term object across both keys,
 * so the term's fields alone can't tell which key is which.
 */
function isAcronymKey(key: string, terms: GlossaryTerm[]): boolean {
  return terms.some(t => t.acronym !== undefined && (key === t.acronym || key === t.acronym + 's'));
}

const FUZZY_THRESHOLD_SHORT = 1;  // term.length < 6
const FUZZY_THRESHOLD_MEDIUM = 2; // term.length <= 8
const FUZZY_THRESHOLD_LONG = 3;   // term.length > 8

export class TermMatcher {
  constructor(
    private readonly termIndex: TermIndex,
    private readonly settings: GlossarySettings,
  ) {}

  findTermsInText(text: string, lineStart: number): TermMatch[] {
    const raw: TermMatch[] = [];

    if (this.settings.matchBy === 'acronym' || this.settings.matchBy === 'both') {
      this.findAcronymMatches(text, raw, lineStart);
    }
    if (this.settings.matchBy === 'term' || this.settings.matchBy === 'both') {
      this.findTermMatches(text, raw, lineStart);
    }

    // Sort: by position ascending, with acronym matches first on tie
    raw.sort((a, b) => {
      if (a.from !== b.from) return a.from - b.from;
      // acronym wins on tie
      if (a.kind === b.kind) return 0;
      return a.kind === 'acronym' ? -1 : 1;
    });

    // Linear overlap filter — first winner stays, skip overlapping followers
    const result: TermMatch[] = [];
    let lastEnd = -1;
    for (const match of raw) {
      if (match.from >= lastEnd) {
        result.push(match);
        lastEnd = match.to;
      }
    }

    return result;
  }

  private findAcronymMatches(text: string, matches: TermMatch[], lineStart: number): void {
    for (const [key, termsList] of Object.entries(this.termIndex)) {
      const first = termsList[0];
      if (!first?.acronym || !isAcronymKey(key, termsList)) continue;

      // The key, not the acronym: the plural key ("APIs") must match its own text.
      const pattern = `\\b${this.escapeRegex(key)}\\b`;
      // Acronyms are ALWAYS case-sensitive
      const regex = new RegExp(pattern, 'g');
      let match: RegExpExecArray | null;
      while ((match = regex.exec(text)) !== null) {
        const from = lineStart + match.index;
        const to = from + match[0].length;
        matches.push({ from, to, matched: match[0], terms: termsList, kind: 'acronym' });
      }
    }
  }

  private findTermMatches(text: string, matches: TermMatch[], lineStart: number): void {
    for (const [key, termsList] of Object.entries(this.termIndex)) {
      const first = termsList[0];
      // Full-term keys only; a row's acronym keys are matched by findAcronymMatches.
      if (!first?.fullTerm || isAcronymKey(key, termsList)) continue;

      const flags = this.settings.caseSensitive ? 'g' : 'gi';
      const pattern = `\\b${this.escapeRegex(first.fullTerm)}\\b`;
      const regex = new RegExp(pattern, flags);
      let match: RegExpExecArray | null;
      while ((match = regex.exec(text)) !== null) {
        const from = lineStart + match.index;
        const to = from + match[0].length;
        matches.push({ from, to, matched: match[0], terms: termsList, kind: 'term' });
      }

      // Also attempt fuzzy matching for full terms if enabled
      if (this.settings.fuzzyMatching) {
        this.findFuzzyMatches(text, first.fullTerm, termsList, matches, lineStart);
      }
    }
  }

  private findFuzzyMatches(
    text: string,
    fullTerm: string,
    terms: GlossaryTerm[],
    matches: TermMatch[],
    lineStart: number,
  ): void {
    const threshold = this.getFuzzyThreshold(fullTerm);
    // Split text into words, tracking their positions
    const wordRegex = /\S+/g;
    let wordMatch: RegExpExecArray | null;
    while ((wordMatch = wordRegex.exec(text)) !== null) {
      const word = wordMatch[0];
      // Compare case-insensitively for fuzzy
      const dist = this.editDistance(word.toLowerCase(), fullTerm.toLowerCase());
      if (dist > 0 && dist <= threshold) {
        const from = lineStart + wordMatch.index;
        const to = from + word.length;
        matches.push({ from, to, matched: word, terms, kind: 'term' });
      }
    }
  }

  /** Compute Levenshtein edit distance between two strings. */
  editDistance(a: string, b: string): number {
    const m = a.length;
    const n = b.length;
    const dp: number[][] = [];
    for (let i = 0; i <= m; i++) {
      dp[i] = [i];
    }
    for (let j = 0; j <= n; j++) {
      dp[0][j] = j;
    }
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (a[i - 1] === b[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1];
        } else {
          dp[i][j] = 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
        }
      }
    }
    return dp[m][n];
  }

  getFuzzyThreshold(term: string): number {
    if (term.length < 6) return FUZZY_THRESHOLD_SHORT;
    if (term.length <= 8) return FUZZY_THRESHOLD_MEDIUM;
    return FUZZY_THRESHOLD_LONG;
  }

  private escapeRegex(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private normalizeFolder(folder: string): string {
    return folder.toLowerCase().replace(/\/?$/, '/');
  }

  shouldProcessFile(app: App, file: TFile): boolean {
    if (!file) return false;
    if (isGlossaryFile(app, file)) return false;

    const filePath = file.path.toLowerCase();

    if (this.settings.includeFolders.length > 0) {
      const inIncluded = this.settings.includeFolders.some(folder => {
        const normalized = this.normalizeFolder(folder);
        return filePath.startsWith(normalized);
      });
      if (!inIncluded) return false;
    }

    const inExcluded = this.settings.excludeFolders.some(folder => {
      const normalized = this.normalizeFolder(folder);
      return filePath.startsWith(normalized);
    });
    if (inExcluded) return false;

    return true;
  }
}

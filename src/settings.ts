/** Which glossary attribute to match against note text. */
export type MatchBy = 'acronym' | 'term' | 'both';

/** Visual style applied to highlighted glossary terms. */
export type HighlightStyle =
  | 'gradient1'
  | 'gradient2'
  | 'gradient3'
  | 'gradient4'
  | 'gradient5'
  | 'gradient6'
  | 'gradient7'
  | 'gradient8'
  | 'gradient9'
  | 'gradient10'
  | 'solid';

/** All user-configurable settings for the Smart Glossary plugin. */
export interface GlossarySettings {
  matchBy: MatchBy;
  caseSensitive: boolean;
  fuzzyMatching: boolean;
  excludeAcronyms: string[];
  excludeTerms: string[];
  includeFolders: string[];
  excludeFolders: string[];
  highlightStyle: HighlightStyle;
  highlightColor: string;
}

/** Default values applied on fresh install or for any missing persisted fields. */
export const DEFAULT_SETTINGS: GlossarySettings = {
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

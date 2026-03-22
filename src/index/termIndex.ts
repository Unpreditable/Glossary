export interface GlossaryTerm {
  sourceFile: string;
  acronym?: string;
  fullTerm?: string;
  description?: string;
}

export type TermIndex = Record<string, GlossaryTerm[]>;

import { App, TFile } from "obsidian";
import { GlossarySettings } from "../settings";
import { GlossaryTerm, TermIndex } from "./termIndex";
import { parseFileTables } from "../glossary/glossaryFileParser";

export function addToIndex(key: string, term: GlossaryTerm, termIndex: TermIndex): void {
  if (!termIndex[key]) {
    termIndex[key] = [];
  }
  termIndex[key].push(term);
}

export function isExcluded(
  term: string,
  type: "acronym" | "term",
  settings: GlossarySettings
): boolean {
  const excludeList = type === "acronym" ? settings.excludeAcronyms : settings.excludeTerms;
  const compareFunc = settings.caseSensitive
    ? (a: string, b: string): boolean => a === b
    : (a: string, b: string): boolean => a.toLowerCase() === b.toLowerCase();
  return excludeList.some((excluded) => compareFunc(term, excluded));
}

export async function parseGlossaryFile(
  app: App,
  file: TFile,
  settings: GlossarySettings,
  termIndex: TermIndex
): Promise<number> {
  const content = await app.vault.read(file);
  let count = 0;
  // The Glossary View's parser: it unescapes `\|` in cells and skips header, separator and empty rows.
  const rows = parseFileTables(content)
    .filter((table) => table.colCount === 2 || table.colCount === 3)
    .flatMap((table) => table.rows);
  for (const { cells: columns } of rows) {
    const term: GlossaryTerm = { sourceFile: file.path };
    let added = false;
    if (columns.length === 3) {
      const [acronym, fullTerm, description] = columns;
      if (acronym) term.acronym = acronym;
      if (fullTerm) term.fullTerm = fullTerm;
      if (description) term.description = description;
      if (settings.matchBy === "acronym" || settings.matchBy === "both") {
        if (acronym && !isExcluded(acronym, "acronym", settings)) {
          addToIndex(acronym, term, termIndex);
          addToIndex(acronym + "s", term, termIndex);
          added = true;
        }
      }
      if (settings.matchBy === "term" || settings.matchBy === "both") {
        if (fullTerm && !isExcluded(fullTerm, "term", settings)) {
          const key = settings.caseSensitive ? fullTerm : fullTerm.toLowerCase();
          addToIndex(key, term, termIndex);
          added = true;
        }
      }
    } else {
      const [acronym, description] = columns;
      if (!acronym) continue;
      term.acronym = acronym;
      if (description) term.description = description;
      if (!isExcluded(acronym, "acronym", settings)) {
        addToIndex(acronym, term, termIndex);
        addToIndex(acronym + "s", term, termIndex);
        added = true;
      }
    }
    if (added) count++;
  }
  return count;
}

/** Reads every glossary file into a new index of its own. */
export async function buildTermIndex(
  app: App,
  files: TFile[],
  settings: GlossarySettings
): Promise<{ termIndex: TermIndex; termCount: number }> {
  const termIndex: TermIndex = {};
  let termCount = 0;
  for (const file of files) {
    termCount += await parseGlossaryFile(app, file, settings, termIndex);
  }
  return { termIndex, termCount };
}

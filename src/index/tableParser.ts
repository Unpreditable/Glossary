import { App, TFile } from "obsidian";
import { GlossarySettings } from "../settings";
import { GlossaryTerm, TermIndex } from "./termIndex";

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
  const lines = content.split("\n");
  let count = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line.startsWith("|") || !line.endsWith("|")) continue;
    if (line.match(/^\|[\s\-|]+\|$/)) continue;
    if (i + 1 < lines.length && lines[i + 1].trim().match(/^\|[\s\-|]+\|$/)) continue;
    const columns = line.split("|").map((col) => col.trim()).slice(1, -1);
    if (columns.length !== 3 && columns.length !== 2) continue;
    if (columns.every((col) => !col)) continue;
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

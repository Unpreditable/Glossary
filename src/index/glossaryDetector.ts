import { App, TFile } from "obsidian";

const GLOSSARY_TAG = "glossary" as const;

export function isGlossaryFile(app: App, file: TFile): boolean {
  const cache = app.metadataCache.getFileCache(file);
  const tags = cache?.frontmatter?.tags as string | string[] | undefined;
  return Array.isArray(tags)
    ? tags.includes(GLOSSARY_TAG)
    : tags === GLOSSARY_TAG;
}

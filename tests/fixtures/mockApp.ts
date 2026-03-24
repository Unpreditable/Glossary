import { App, TFile } from 'obsidian';

export function makeMockApp(glossaryPaths: string[] = []): App {
  const app = new App() as unknown as {
    metadataCache: { getFileCache: (f: TFile) => unknown };
  };
  app.metadataCache = {
    getFileCache: (file: TFile) => {
      if (glossaryPaths.includes(file.path)) {
        return { frontmatter: { tags: 'glossary' } };
      }
      return null;
    },
  };
  return app as unknown as App;
}

export function makeMockFile(path: string): TFile {
  const f = new TFile();
  f.path = path;
  return f;
}

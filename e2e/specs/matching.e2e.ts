// What counts as a mention of a term, and how the matching settings change it, seen in the editor.

// Written without imports: describe, it, expect, browser, $ and the helpers are globals the harness
// provides.

/** The text of every highlight in the active tab, in order. */
async function marks(): Promise<string[]> {
  return browser.execute(() =>
    Array.from(document.querySelectorAll(".workspace-leaf.mod-active .cm-glossary-highlight"))
      .map((el) => el.textContent ?? ""));
}

/** Waits until the active tab's highlights are exactly `expected`. */
async function waitForMarks(expected: string[]): Promise<void> {
  let seen: string[] = [];
  await browser.waitUntil(async () => {
    seen = await marks();
    return JSON.stringify(seen) === JSON.stringify(expected);
  }, { timeout: 10000, timeoutMsg: `expected highlights ${JSON.stringify(expected)}` }).catch(() => {
    throw new Error(`expected highlights ${JSON.stringify(expected)}, saw ${JSON.stringify(seen)}`);
  });
}

async function openNote(path: string, content: string): Promise<void> {
  await browser.executeObsidian(async ({ app }, p, c) => { await app.vault.create(p, c); }, path, content);
  await obsidianPage.openFile(path);
}

/** Creates a glossary note and has the plugin index it once Obsidian has read its frontmatter. */
async function addGlossary(path: string, rows: string): Promise<void> {
  await browser.executeObsidian(async ({ app, plugins }, p, c) => {
    const file = await app.vault.create(p, c);
    for (let i = 0; i < 50 && !app.metadataCache.getFileCache(file)?.frontmatter; i++) {
      await new Promise((r) => window.setTimeout(r, 100));
    }
    await (plugins.glossary as unknown as { buildGlossaryIndex(o: { silent: boolean }): Promise<void> })
      .buildGlossaryIndex({ silent: true });
  }, path, `---\ntags: [glossary]\n---\n${rows}`);
}

/** Changes settings and rebuilds the index, as the settings tab does after a change. */
async function applySettings(patch: Record<string, unknown>): Promise<void> {
  await setPluginSettings("glossary", patch);
  await browser.executeObsidian(async ({ plugins }) => {
    await (plugins.glossary as unknown as { buildGlossaryIndex(o: { silent: boolean }): Promise<void> })
      .buildGlossaryIndex({ silent: true });
  });
}

const TWO_COLUMN = "| Acronym | Description |\n|---|---|\n| HTTP | Web protocol |\n";
const SINGLE_WORD = "| Acronym | Full term | Description |\n|---|---|---|\n| SRV | Server | A machine that serves |\n";

describe("Matching terms in the editor", () => {
  beforeEach(async () => {
    await resetState();
  });

  it("highlights acronyms, their plurals and full terms by default", async () => {
    await openNote("Mentions.md", "Two APIs run on the Central Processing Unit, not the CPU.");
    await waitForMarks(["APIs", "Central Processing Unit", "CPU"]);
  });

  it("matches acronyms by case always, and full terms in any case by default", async () => {
    await openNote("Case.md", "The api and API run on the central processing unit.");
    await waitForMarks(["API", "central processing unit"]);
  });

  it("matches full terms only in their own case when case sensitive", async () => {
    await applySettings({ caseSensitive: true });
    await openNote("Case.md", "The central processing unit is the Central Processing Unit.");
    await waitForMarks(["Central Processing Unit"]);
  });

  it("matches only acronyms with Match by set to acronym", async () => {
    await applySettings({ matchBy: "acronym" });
    await openNote("Mentions.md", "The API runs on the Central Processing Unit.");
    await waitForMarks(["API"]);
  });

  it("matches full terms, and acronyms of 2-column rows, with Match by set to term", async () => {
    await addGlossary("Web.md", TWO_COLUMN);
    await applySettings({ matchBy: "term" });
    await openNote("Mentions.md", "The API sends HTTP to the Central Processing Unit.");
    await waitForMarks(["HTTP", "Central Processing Unit"]);
  });

  it("matches a misspelled single-word full term while fuzzy matching is on", async () => {
    await addGlossary("Servers.md", SINGLE_WORD);
    await openNote("Typos.md", "The servr and the server here.");
    await waitForMarks(["servr", "server"]);
  });

  it("matches only exact full terms while fuzzy matching is off", async () => {
    await addGlossary("Servers.md", SINGLE_WORD);
    await applySettings({ fuzzyMatching: false });
    await openNote("Typos.md", "The servr and the server here.");
    await waitForMarks(["server"]);
  });

  it("leaves out the excluded acronyms", async () => {
    await applySettings({ excludeAcronyms: ["API"] });
    await openNote("Mentions.md", "The API runs on the CPU.");
    await waitForMarks(["CPU"]);
  });

  it("leaves out the excluded full terms, but still matches their acronym", async () => {
    await applySettings({ excludeTerms: ["central processing unit"] });
    await openNote("Mentions.md", "The Central Processing Unit, or CPU.");
    await waitForMarks(["CPU"]);
  });
});

// Keeps this file's names its own: a file with no import or export shares one scope with every other.
export {};

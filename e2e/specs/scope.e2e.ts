// Where terms are highlighted: which folders, not in glossary notes, not in code.

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

/** Creates a note, making its folder if needed, and opens it in a new tab. */
async function openNote(path: string, content: string): Promise<void> {
  await browser.executeObsidian(async ({ app }, p, c) => {
    const folder = p.includes("/") ? p.slice(0, p.lastIndexOf("/")) : "";
    if (folder && !app.vault.getAbstractFileByPath(folder)) await app.vault.createFolder(folder);
    await app.vault.create(p, c);
  }, path, content);
  await obsidianPage.openFile(path);
  await browser.waitUntil(() => browser.executeObsidian(({ app }, p) =>
    app.workspace.getActiveFile()?.path === p && !!app.workspace.activeEditor?.editor, path), {
    timeoutMsg: `${path} never opened in an editor`,
  });
}

/**
 * Checks that the active note shows no highlight. A note that should show none can't be waited
 * on, so this gives the editor time to decorate first.
 */
async function expectNoMarks(): Promise<void> {
  await browser.pause(1000);
  expect(await marks()).toEqual([]);
}

/** Changes settings and rebuilds the index, as the settings tab does after a change. */
async function applySettings(patch: Record<string, unknown>): Promise<void> {
  await setPluginSettings("glossary", patch);
  await browser.executeObsidian(async ({ plugins }) => {
    await (plugins.glossary as unknown as { buildGlossaryIndex(o: { silent: boolean }): Promise<void> })
      .buildGlossaryIndex({ silent: true });
  });
}

describe("Where terms are highlighted", () => {
  beforeEach(async () => {
    await resetState();
  });

  it("highlights only notes inside the included folders", async () => {
    await applySettings({ includeFolders: ["Projects"] });
    await openNote("Projects/Plan.md", "The API is ready.");
    await waitForMarks(["API"]);
    await openNote("Other/Plan.md", "The API is ready.");
    await expectNoMarks();
  });

  it("skips notes inside the excluded folders, subfolders included", async () => {
    await applySettings({ excludeFolders: ["Archive/"] });
    await openNote("Current.md", "The API is ready.");
    await waitForMarks(["API"]);
    await openNote("Archive/2025/Old.md", "The API is ready.");
    await expectNoMarks();
  });

  it("matches folder names regardless of case", async () => {
    await applySettings({ excludeFolders: ["archive"] });
    await openNote("Current.md", "The API is ready.");
    await waitForMarks(["API"]);
    await openNote("Archive/Old.md", "The API is ready.");
    await expectNoMarks();
  });

  it("does not highlight a glossary note's own terms in the Markdown editor", async () => {
    await obsidianPage.openFile("Notes.md");
    await waitForMarks(["API"]);
    await browser.executeObsidian(({ plugins }) => {
      (plugins.glossary as unknown as { fileViewPreference: Map<string, string> })
        .fileViewPreference.set("Glossary.md", "markdown");
    });
    await obsidianPage.openFile("Glossary.md");
    await browser.waitUntil(() => browser.executeObsidian(({ app }) =>
      app.workspace.getActiveFile()?.path === "Glossary.md" && !!app.workspace.activeEditor?.editor), {
      timeoutMsg: "Glossary.md never opened in the Markdown editor",
    });
    await expectNoMarks();
  });

  it("skips terms in inline code", async () => {
    await openNote("Code.md", "Call the API, not `API.call()` itself.");
    await waitForMarks(["API"]);
  });

  it("skips terms in a fenced code block", async () => {
    await openNote("Fenced.md", "The API is below.\n\n```js\nconst API = 1;\n```\n\nAfter the CPU block.");
    await waitForMarks(["API", "CPU"]);
  });
});

// Keeps this file's names its own: a file with no import or export shares one scope with every other.
export {};

// Hovering a highlighted term shows its definition.

// Written without imports: describe, it, expect, browser, $ and the helpers are globals the harness
// provides.

const TOOLTIP = ".cm-tooltip-glossary";

/** The text of every highlight in the active tab, in order. */
async function marks(): Promise<string[]> {
  return browser.execute(() =>
    Array.from(document.querySelectorAll(".workspace-leaf.mod-active .cm-glossary-highlight"))
      .map((el) => el.textContent ?? ""));
}

async function waitForMark(text: string): Promise<void> {
  await browser.waitUntil(async () => (await marks()).includes(text), {
    timeout: 15000, timeoutMsg: `"${text}" was never highlighted`,
  });
}

/** Creates a glossary note and has the plugin index it once Obsidian has read its frontmatter. */
async function addGlossary(path: string, content: string): Promise<void> {
  await browser.executeObsidian(async ({ app, plugins }, p, c) => {
    const file = await app.vault.create(p, c);
    for (let i = 0; i < 50 && !app.metadataCache.getFileCache(file)?.frontmatter; i++) {
      await new Promise((r) => window.setTimeout(r, 100));
    }
    await (plugins.glossary as unknown as { buildGlossaryIndex(o: { silent: boolean }): Promise<void> })
      .buildGlossaryIndex({ silent: true });
  }, path, content);
}

async function openNote(path: string, content: string): Promise<void> {
  await browser.executeObsidian(async ({ app }, p, c) => { await app.vault.create(p, c); }, path, content);
  await obsidianPage.openFile(path);
}

/** Moves the mouse onto a highlight, through a mousemove CodeMirror's hover handling reads. */
async function hover(text: string): Promise<void> {
  await browser.execute((t) => {
    const mark = Array.from(document.querySelectorAll(".workspace-leaf.mod-active .cm-glossary-highlight"))
      .find((el) => el.textContent === t);
    if (!mark) throw new Error(`no highlight "${t}"`);
    const { left, top, width, height } = mark.getBoundingClientRect();
    mark.dispatchEvent(new MouseEvent("mousemove", {
      clientX: left + width / 2, clientY: top + height / 2, bubbles: true,
    }));
  }, text);
  await $(TOOLTIP).waitForDisplayed({ timeoutMsg: `no tooltip showed over "${text}"` });
}

describe("The tooltip on a highlighted term", () => {
  beforeEach(async () => {
    await resetState();
  });

  it("shows the acronym, full term, description and the glossary note it comes from", async () => {
    await obsidianPage.openFile("Notes.md");
    await waitForMark("API");
    await hover("API");
    const text = await $(TOOLTIP).getText();
    expect(text).toContain("API");
    expect(text).toContain("Application Programming Interface");
    expect(text).toContain("A contract between programs");
    expect(await $(`${TOOLTIP} .cm-tooltip-glossary-source`).getText()).toBe("Glossary.md");
    expect(text).not.toContain("more definitions");
  });

  it("shows the description of a 2-column row with no full term", async () => {
    await addGlossary("Web.md", "---\ntags: [glossary]\n---\n| Acronym | Description |\n|---|---|\n| HTTP | Web protocol |\n");
    await openNote("Browsing.md", "Pages travel over HTTP.");
    await waitForMark("HTTP");
    await hover("HTTP");
    const text = await $(TOOLTIP).getText();
    expect(text).toContain("HTTP");
    expect(text).toContain("Web protocol");
    expect(await $(`${TOOLTIP} .cm-tooltip-glossary-source`).getText()).toBe("Web.md");
  });

  it("counts the other definitions when two glossaries define the term", async () => {
    await addGlossary("More terms.md", "---\ntags: [glossary]\n---\n| Acronym | Description |\n|---|---|\n| API | Another definition |\n");
    await obsidianPage.openFile("Notes.md");
    await waitForMark("API");
    await hover("API");
    expect(await $(TOOLTIP).getText()).toContain("(+1 more definitions)");
  });

  it("shows the definition for a full term matched in the note", async () => {
    await openNote("Hardware.md", "The Central Processing Unit runs it.");
    await waitForMark("Central Processing Unit");
    await hover("Central Processing Unit");
    const text = await $(TOOLTIP).getText();
    expect(text).toContain("CPU");
    expect(text).toContain("Executes instructions");
  });
});

// Keeps this file's names its own: a file with no import or export shares one scope with every other.
export {};

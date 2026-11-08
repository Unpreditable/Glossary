// "Add to glossary" in the editor's right-click menu, and the form it opens.

// Written without imports: describe, it, expect, browser, $ and the helpers are globals the harness
// provides.

const MODAL = ".modal .glossary-add-modal";
const ADD_BUTTON = `${MODAL} button.mod-cta`;

/** The text of every highlight in the active tab, in order. */
async function marks(): Promise<string[]> {
  return browser.execute(() =>
    Array.from(document.querySelectorAll(".workspace-leaf.mod-active .cm-glossary-highlight"))
      .map((el) => el.textContent ?? ""));
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

/**
 * Puts the caret in `text` (or selects it), right-clicks it, and picks "Add to glossary".
 * The right-click is a contextmenu event at the text's position, which Obsidian's editor menu reads.
 */
async function addToGlossaryFrom(text: string, { select = false } = {}): Promise<void> {
  await browser.waitUntil(() => browser.executeObsidian(({ app }, t) =>
    (app.workspace.activeEditor?.editor?.getValue() ?? "").includes(t), text), {
    timeoutMsg: `the active note never held "${text}"`,
  });
  await browser.executeObsidian(({ app }, t, sel) => {
    const editor = app.workspace.activeEditor?.editor;
    if (!editor) throw new Error("no active editor");
    const start = editor.getValue().indexOf(t);
    if (sel) editor.setSelection(editor.offsetToPos(start), editor.offsetToPos(start + t.length));
    else editor.setCursor(editor.offsetToPos(start + 1));
    editor.focus();
  }, text, select);
  await browser.execute((t) => {
    const content = document.querySelector(".workspace-leaf.mod-active .cm-content");
    if (!content) throw new Error("no editor in the active tab");
    const walker = document.createTreeWalker(content, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const at = node.textContent?.indexOf(t) ?? -1;
      if (at < 0) continue;
      const range = document.createRange();
      range.setStart(node, at);
      range.setEnd(node, at + t.length);
      const { left, top, width, height } = range.getBoundingClientRect();
      node.parentElement?.dispatchEvent(new MouseEvent("contextmenu", {
        clientX: left + width / 2, clientY: top + height / 2, button: 2, bubbles: true, cancelable: true,
      }));
      return;
    }
    throw new Error(`no "${t}" on screen in the active note`);
  }, text);
  await $(".menu-item-title=Add to glossary").click();
  await $(MODAL).waitForDisplayed({ timeoutMsg: "the add-term form never opened" });
}

async function fields(): Promise<{ acronym: string; fullTerm: string; description: string }> {
  return browser.execute((modal) => {
    const value = (placeholder: string) =>
      document.querySelector<HTMLInputElement>(`${modal} input[placeholder="${placeholder}"]`)?.value ?? "";
    return { acronym: value("Acronym"), fullTerm: value("Full Term"), description: value("Description") };
  }, MODAL);
}

async function fill(placeholder: string, text: string): Promise<void> {
  await $(`${MODAL} input[placeholder="${placeholder}"]`).setValue(text);
}

async function addDisabled(): Promise<boolean> {
  return browser.execute((selector) => document.querySelector<HTMLButtonElement>(selector)?.disabled ?? true, ADD_BUTTON);
}

async function errors(): Promise<string[]> {
  return browser.execute((modal) =>
    Array.from(document.querySelectorAll(`${modal} .glossary-modal-error-list li`)).map((li) => li.textContent ?? ""), MODAL);
}

async function waitForNoteLine(path: string, expected: string): Promise<string[]> {
  let lines: string[] = [];
  await browser.waitUntil(async () => {
    lines = (await obsidianPage.read(path)).split("\n");
    return lines.includes(expected);
  }, { timeoutMsg: `${path} never held the line "${expected}"` });
  return lines;
}

describe("Adding a term from the editor", () => {
  beforeEach(async () => {
    await resetState();
  });

  afterEach(async () => {
    // A form left open would sit over the next test's editor, and the reset doesn't close it.
    for (let i = 0; i < 5 && await $(".modal-container").isExisting(); i++) {
      await press("Escape");
      await browser.pause(200);
    }
    expect(await $(".modal-container").isExisting()).toBe(false);
  });

  it("fills in the acronym under the caret and lists the glossary's entry for it", async () => {
    await obsidianPage.openFile("Notes.md");
    await addToGlossaryFrom("API");
    expect(await fields()).toEqual({ acronym: "API", fullTerm: "", description: "" });
    expect(await $(`${MODAL} .glossary-modal-duplicates li`).getText())
      .toBe("API — Application Programming Interface (Glossary.md)");
    // One field filled: not enough to add.
    expect(await addDisabled()).toBe(true);
    expect(await errors()).toContain("Fill in at least 2 of: Acronym, Full Term, Description.");
  });

  it("fills in the full term from a selected phrase", async () => {
    await openNote("Storage.md", "A Data Lake holds raw data.");
    await addToGlossaryFrom("Data Lake", { select: true });
    expect(await fields()).toEqual({ acronym: "", fullTerm: "Data Lake", description: "" });
    expect(await $(`${MODAL} .glossary-modal-duplicates`).isDisplayed()).toBe(false);
  });

  it("keeps Add off while a field is invalid", async () => {
    await openNote("Hardware.md", "The GPU renders frames.");
    await addToGlossaryFrom("GPU");
    await fill("Description", "Renders");
    expect(await errors()).toContain("Description: at least 2 words.");
    expect(await addDisabled()).toBe(true);

    await fill("Description", "Renders images");
    expect(await errors()).toEqual([]);
    expect(await addDisabled()).toBe(false);
  });

  it("adds the term in alphabetical order and highlights it in the open note", async () => {
    await openNote("Hardware.md", "The GPU renders frames.");
    await addToGlossaryFrom("GPU");
    await fill("Full Term", "Graphics Processing Unit");
    await fill("Description", "Renders images");
    await $(ADD_BUTTON).click();

    const lines = await waitForNoteLine("Glossary.md", "| GPU | Graphics Processing Unit | Renders images |");
    expect(lines.indexOf("| GPU | Graphics Processing Unit | Renders images |"))
      .toBe(lines.findIndex((l) => l.startsWith("| CPU |")) + 1);
    await $(MODAL).waitForExist({ reverse: true, timeoutMsg: "the form never closed after adding" });
    await browser.waitUntil(async () => (await marks()).includes("GPU"), {
      timeoutMsg: "the added term was never highlighted in the open note",
    });
  });

  it("writes to the glossary picked in the list, as a 2-column row without a full term", async () => {
    await addGlossary("More terms.md", "---\ntags: [glossary]\n---\n| Acronym | Description |\n|---|---|\n| DOC | Written down |\n");
    await openNote("Hardware.md", "The GPU renders frames.");
    await addToGlossaryFrom("GPU");
    await fill("Description", "Renders images");
    await browser.execute((modal) => {
      const select = document.querySelector<HTMLSelectElement>(`${modal} select`);
      if (!select) throw new Error("no glossary list");
      if (select.disabled) throw new Error("the glossary list is off with two glossaries");
      select.value = "More terms.md";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    }, MODAL);
    await $(ADD_BUTTON).click();

    await waitForNoteLine("More terms.md", "| GPU | Renders images |");
    expect(await obsidianPage.read("Glossary.md")).not.toContain("GPU");
  });

  it("says there is no glossary when the vault has none", async () => {
    await browser.executeObsidian(async ({ app, obsidian, plugins }) => {
      const file = app.vault.getAbstractFileByPath("Glossary.md");
      if (!(file instanceof obsidian.TFile)) throw new Error("no Glossary.md");
      await app.fileManager.trashFile(file);
      await (plugins.glossary as unknown as { buildGlossaryIndex(o: { silent: boolean }): Promise<void> })
        .buildGlossaryIndex({ silent: true });
    });
    await obsidianPage.openFile("Notes.md");
    await addToGlossaryFrom("API");
    expect(await $(MODAL).getText()).toContain("No glossary notes found.");
    expect(await $(`${MODAL} input`).isExisting()).toBe(false);
  });
});

// Keeps this file's names its own: a file with no import or export shares one scope with every other.
export {};

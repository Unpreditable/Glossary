// Terms from the glossary are highlighted where a note mentions them.

// Written without imports: describe, it, expect, browser, $ and the helpers are globals the harness
// provides.

describe("Highlighting in the editor", () => {
  it("marks an acronym the glossary defines", async () => {
    await obsidianPage.openFile("Notes.md");
    const mark = $(".cm-glossary-highlight");
    await mark.waitForExist({ timeoutMsg: "no term in Notes.md was highlighted" });
    expect(await mark.getText()).toBe("API");
  });

  it("highlights a term added to the glossary in a note that is already open", async () => {
    await obsidianPage.openFile("Notes.md");
    await $(".cm-glossary-highlight").waitForExist({ timeoutMsg: "Notes.md was never highlighted" });

    await browser.executeObsidian(async ({ app, obsidian }) => {
      const file = app.vault.getAbstractFileByPath("Glossary.md");
      if (!(file instanceof obsidian.TFile)) throw new Error("no Glossary.md");
      // The fixture may be checked out with CRLF line endings.
      const updated = await app.vault.process(file, (text) => text.replace(
        /(\| CPU \|.*\r?\n)/,
        "$1| ELS | Elsewhere | Not here |\n",
      ));
      if (!updated.includes("| ELS |")) throw new Error("the glossary row was not added");
      const commands = (app as unknown as { commands: { executeCommandById(id: string): boolean } }).commands;
      commands.executeCommandById("glossary:refresh-glossary");
    });

    await browser.waitUntil(async () => {
      const marks = await browser.execute(() =>
        Array.from(document.querySelectorAll(".cm-glossary-highlight")).map((el) => el.textContent));
      return marks.includes("elsewhere");
    }, { timeoutMsg: "the new term never got highlighted in the open note" });
  });

  it("indexes a new glossary note, and drops its terms when it is deleted", async () => {
    const marks = () => browser.execute(() =>
      Array.from(document.querySelectorAll(".cm-glossary-highlight")).map((el) => el.textContent));
    await obsidianPage.openFile("Notes.md");
    await $(".cm-glossary-highlight").waitForExist({ timeoutMsg: "Notes.md was never highlighted" });

    await browser.executeObsidian(async ({ app }) => {
      await app.vault.create("More terms.md",
        "---\ntags: [glossary]\n---\n| Acronym | Full term | Description |\n|---|---|---|\n| DOC | Documented | Written down |\n");
    });
    // The rebuild after a change is debounced by 5 seconds.
    await browser.waitUntil(async () => (await marks()).includes("documented"), {
      timeout: 15000, timeoutMsg: "the new glossary note's term was never highlighted",
    });

    await browser.executeObsidian(async ({ app, obsidian }) => {
      const file = app.vault.getAbstractFileByPath("More terms.md");
      if (file instanceof obsidian.TFile) await app.fileManager.trashFile(file);
    });
    await browser.waitUntil(async () => !(await marks()).includes("documented"), {
      timeout: 15000, timeoutMsg: "the deleted glossary note's term stayed highlighted",
    });
  });
});

// Keeps this file's names its own: a file with no import or export shares one scope with every other.
export {};

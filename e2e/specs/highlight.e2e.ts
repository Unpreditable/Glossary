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
});

// Keeps this file's names its own: a file with no import or export shares one scope with every other.
export {};

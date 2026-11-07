// The Glossary View: a glossary note opens as an editable table, and what editing, adding a term
// and resizing a column write back to the note.

// Written without imports: describe, it, expect, browser, $ and the helpers are globals the harness
// provides.

const PLUGIN = "glossary";
const VIEW_TYPE = "glossary-view";
const NOTE = "Glossary.md";

const VIEW = ".glossary-item-view";
const SECTION = ".glossary-view-section";

/** A selector for one data cell's display span: table, row and column all count from 1. */
function cell(table: number, row: number, col: number): string {
  return `${SECTION}:nth-child(${table}) tbody tr:nth-child(${row}) td:nth-child(${col}) .glossary-cell-display`;
}

/** What Obsidian keeps of its plugins that the reload test reaches for. */
interface Plugins {
  disablePlugin(id: string): Promise<void>;
  enablePlugin(id: string): Promise<void>;
}

async function openGlossary(): Promise<void> {
  // The harness's reset closes notes, not custom views: a tab left by the last test would hide
  // behind the new one and match every selector first.
  await browser.executeObsidian(({ app }, type) => app.workspace.detachLeavesOfType(type), VIEW_TYPE);
  await obsidianPage.openFile(NOTE);
  await $(`${VIEW} ${SECTION}`).waitForDisplayed({ timeoutMsg: "the glossary note never opened in the Glossary View" });
}

/**
 * Types into the cell being edited with real keys. A click selects the cell's text, so this
 * replaces it. (WebDriver's setValue blurs the input after clearing it, which ends the edit.)
 */
async function typeInCell(text: string): Promise<void> {
  await browser.keys(text.split(""));
}

/** Clicks a cell to edit it, replaces its text, and leaves it with Tab so it saves. */
async function editCell(selector: string, text: string): Promise<void> {
  await $(selector).click();
  await typeInCell(text);
  await browser.keys("Tab");
}

async function waitForNoteLine(expected: string): Promise<void> {
  await browser.waitUntil(async () => (await obsidianPage.read(NOTE)).split("\n").includes(expected), {
    timeoutMsg: `${NOTE} never held the line "${expected}"`,
  });
}

async function noteLines(): Promise<string[]> {
  return (await obsidianPage.read(NOTE)).split("\n");
}

/** The second table, from its heading to the end of the note, as it should read after a KPI edit. */
const BUSINESS_AFTER_KPI_EDIT = [
  "# Business",
  "",
  "| Acronym | Full term | Description |",
  "|---|---|---|",
  "| KPI | Key Performance Indicator | A measured target |",
  "| | | |",
  "| ROI | Return on Investment | Gain relative to cost |",
  "",
];

/** The note's lines from the second table's heading on. */
async function businessTable(): Promise<string[]> {
  const lines = await noteLines();
  return lines.slice(lines.indexOf("# Business"));
}

/** Drags the border to the right of a header cell by `dx` pixels, through mouse events in the page. */
async function dragColumnBorder(table: number, col: number, dx: number): Promise<void> {
  await browser.execute((selector, dx) => {
    const handle = document.querySelector<HTMLElement>(selector);
    if (!handle) throw new Error(`no resize handle at ${selector}`);
    const { right, top } = handle.getBoundingClientRect();
    const at = (x: number) => ({ clientX: x, clientY: top, bubbles: true });
    handle.dispatchEvent(new MouseEvent("mousedown", at(right)));
    document.dispatchEvent(new MouseEvent("mousemove", at(right + dx)));
    document.dispatchEvent(new MouseEvent("mouseup", at(right + dx)));
  }, `${SECTION}:nth-child(${table}) th:nth-child(${col}) .glossary-col-resize-handle`, dx);
}

describe("The Glossary View", () => {
  beforeEach(async () => {
    await resetState();
    await openGlossary();
  });

  it("opens a note tagged glossary as its tables", async () => {
    expect(await $$(SECTION).length).toBe(2);
    expect(await $(cell(1, 1, 1)).getText()).toBe("API");
    // The fixture's empty row in the second table is not shown.
    expect(await $$(`${SECTION}:nth-child(2) tbody tr`).length).toBe(2);
  });

  it("writes an edited cell to its own row", async () => {
    await editCell(cell(1, 2, 3), "Runs programs");
    await waitForNoteLine("| CPU | Central Processing Unit | Runs programs |");
  });

  it("writes a row that follows an empty row to the right line", async () => {
    await editCell(cell(2, 2, 3), "Return over cost");
    await waitForNoteLine("| ROI | Return on Investment | Return over cost |");
    // The empty row and KPI are untouched.
    expect(await noteLines()).toContain("| | | |");
    expect(await noteLines()).toContain("| KPI | Key Performance Indicator | A measured goal |");
  });

  it("adds a term in alphabetical order", async () => {
    await $(`${SECTION}:nth-child(1) .glossary-view-add-btn`).click();
    await typeInCell("BIOS");
    await browser.keys("Tab");
    await typeInCell("Basic Input Output System");
    // Leaving the row saves it.
    await $(cell(2, 1, 1)).click();
    await waitForNoteLine("| BIOS | Basic Input Output System |  |");
    const lines = await noteLines();
    expect(lines.indexOf("| BIOS | Basic Input Output System |  |")).toBe(
      lines.findIndex((l) => l.startsWith("| API |")) + 1,
    );
  });

  it("still writes edits to the right line in a later table after a term was added", async () => {
    await $(`${SECTION}:nth-child(1) .glossary-view-add-btn`).click();
    await typeInCell("BIOS");
    await $(cell(2, 1, 3)).click();
    await waitForNoteLine("| BIOS |  |  |");

    // The insert moved every line of the second table down by one. A stale offset writes over
    // the line above KPI's (the separator), so check the whole table, not just that the line exists.
    await typeInCell("A measured target");
    await browser.keys("Tab");
    await waitForNoteLine("| KPI | Key Performance Indicator | A measured target |");
    expect(await businessTable()).toEqual(BUSINESS_AFTER_KPI_EDIT);
  });

  it("follows a change made outside the view, and edits the right row after it", async () => {
    // As "Add to glossary" in the editor menu does it: a row inserted alphabetically, through the vault.
    await browser.executeObsidian(async ({ app, obsidian }, path) => {
      const file = app.vault.getAbstractFileByPath(path);
      if (!(file instanceof obsidian.TFile)) throw new Error(`no ${path}`);
      await app.vault.process(file, (text) => text.replace(
        "| KPI | Key Performance Indicator | A measured goal |\n",
        "| KPI | Key Performance Indicator | A measured goal |\n| NPS | Net Promoter Score | Loyalty measure |\n",
      ));
    }, NOTE);
    await browser.waitUntil(async () => (await $(cell(2, 2, 1)).getText()) === "NPS", {
      timeoutMsg: "the view never showed the row added outside it",
    });

    await editCell(cell(2, 3, 3), "Return over cost");
    await waitForNoteLine("| ROI | Return on Investment | Return over cost |");
    expect(await noteLines()).toContain("| NPS | Net Promoter Score | Loyalty measure |");
  });

  it("keeps saving to the note after it is renamed", async () => {
    const renamed = "Terms.md";
    await browser.executeObsidian(async ({ app, obsidian }, from, to) => {
      const file = app.vault.getAbstractFileByPath(from);
      if (!(file instanceof obsidian.TFile)) throw new Error(`no ${from}`);
      await app.fileManager.renameFile(file, to);
    }, NOTE, renamed);

    // The tab title follows the new name.
    await browser.waitUntil(async () => (await browser.executeObsidian(({ app }, type) =>
      app.workspace.getLeavesOfType(type)[0]?.getDisplayText(), VIEW_TYPE)) === "Terms", {
      timeoutMsg: "the Glossary View tab kept the old name",
    });

    await editCell(cell(1, 2, 3), "Runs programs");
    await browser.waitUntil(async () => (await obsidianPage.read(renamed)).includes("| CPU | Central Processing Unit | Runs programs |"), {
      timeoutMsg: `${renamed} never got the edit made after the rename`,
    });
  });

  it("filters rows by the search, and shows them all again when it is cleared", async () => {
    const shownRows = () => browser.execute((sel) =>
      Array.from(document.querySelectorAll<HTMLElement>(sel)).filter((tr) => tr.style.display !== "none").length,
    `${VIEW} tbody tr`);
    expect(await shownRows()).toBe(4);

    await $(`${VIEW} .glossary-view-search input`).click();
    await browser.keys("cpu".split(""));
    await browser.waitUntil(async () => (await shownRows()) === 1, { timeoutMsg: "searching for cpu didn't leave one row" });

    await $(`${VIEW} .glossary-view-search .search-input-clear-button`).click();
    await browser.waitUntil(async () => (await shownRows()) === 4, { timeoutMsg: "clearing the search didn't bring every row back" });
    expect(await browser.execute((sel) => document.querySelector<HTMLInputElement>(sel)?.value,
      `${VIEW} .glossary-view-search input`)).toBe("");
  });

  it("keeps a cell's size and text position when it switches to editing", async () => {
    const measure = () => browser.execute((sel) => {
      const td = document.querySelector(sel)?.closest("td");
      const shown = td?.querySelector<HTMLElement>(".glossary-cell-input:not([style*='none'])")
        ?? td?.querySelector<HTMLElement>(".glossary-cell-display");
      if (!td || !shown) throw new Error(`no cell at ${sel}`);
      const box = shown.getBoundingClientRect();
      const row = td.closest("tr")?.getBoundingClientRect();
      const css = getComputedStyle(shown);
      return { rowHeight: row?.height, height: box.height, left: box.left, paddingLeft: css.paddingLeft, fontSize: css.fontSize };
    }, cell(1, 1, 1));

    const reading = await measure();
    await $(cell(1, 1, 1)).click();
    const editing = await measure();
    expect(editing).toEqual(reading);
  });

  it("does not rewrite the note when cells are left unchanged", async () => {
    // Count writes to the note from here on.
    await browser.executeObsidian(({ app }, path) => {
      const w = window as unknown as { glossaryWrites: number; glossaryWritesRef: unknown };
      w.glossaryWrites = 0;
      w.glossaryWritesRef = app.vault.on("modify", (file) => { if (file.path === path) w.glossaryWrites++; });
    }, NOTE);

    await $(cell(1, 1, 1)).click();
    await browser.keys("Tab");
    await browser.keys("Tab");
    await browser.keys("Tab");
    // Give any save a moment to land, then make sure none did.
    await browser.pause(1000);
    const writes = await browser.executeObsidian(({ app }) => {
      const w = window as unknown as { glossaryWrites: number; glossaryWritesRef: import("obsidian").EventRef };
      app.vault.offref(w.glossaryWritesRef);
      return w.glossaryWrites;
    });
    expect(writes).toBe(0);
  });

  it("adds a row when Enter is pressed in the last row", async () => {
    await $(cell(1, 2, 2)).click();
    await browser.keys("Enter");
    const newRow = `${SECTION}:nth-child(1) tbody tr.glossary-row-new`;
    await $(newRow).waitForExist({ timeoutMsg: "Enter in the last row added no row" });
    expect(await $$(`${SECTION}:nth-child(1) tbody tr`).length).toBe(3);
    // The new row's first cell is being edited.
    const focused = await browser.execute((row) =>
      document.activeElement === document.querySelector(`${row} td:nth-child(1) input`), newRow);
    expect(focused).toBe(true);
  });

  it("saves a new row and starts another when Enter is pressed in it", async () => {
    await $(`${SECTION}:nth-child(1) .glossary-view-add-btn`).click();
    await typeInCell("BIOS");
    await browser.keys("Enter");
    await waitForNoteLine("| BIOS |  |  |");
    await browser.waitUntil(
      async () => (await $$(`${SECTION}:nth-child(1) tbody tr.glossary-row-new`).length) === 2,
      { timeoutMsg: "no second new row was started" },
    );
  });

  it("stores resized column widths in a comment above the table", async () => {
    await dragColumnBorder(2, 1, 40);
    await browser.waitUntil(
      async () => (await noteLines()).some((l) => l.startsWith("%%glossary_column_width=")),
      { timeoutMsg: "no width comment was written" },
    );
    const lines = await noteLines();
    const at = lines.findIndex((l) => l.startsWith("%%glossary_column_width="));
    // Above the second table's header, a blank line apart so the table still renders,
    // with three whole percentages that add up to 100.
    expect(lines[at + 1]).toBe("");
    expect(lines[at + 2]).toBe("| Acronym | Full term | Description |");
    expect(lines.slice(0, at)).toContain("# Business");
    const widths = lines[at].slice("%%glossary_column_width=".length, -2).split("|").map(Number);
    expect(widths).toHaveLength(3);
    expect(widths.reduce((a, b) => a + b, 0)).toBe(100);
  });

  it("keeps rows editable after a width comment shifted the lines", async () => {
    await dragColumnBorder(1, 1, 40);
    await browser.waitUntil(
      async () => (await noteLines()).some((l) => l.startsWith("%%glossary_column_width=")),
      { timeoutMsg: "no width comment was written" },
    );
    await editCell(cell(2, 1, 3), "A measured target");
    await waitForNoteLine("| KPI | Key Performance Indicator | A measured target |");
    expect(await businessTable()).toEqual(BUSINESS_AFTER_KPI_EDIT);
  });

  it("uses the widths stored in the note, also when they change while it is open", async () => {
    // Written to disk, as another program would: the view picks the change up by itself.
    await obsidianPage.write(NOTE, (await obsidianPage.read(NOTE)).replace(
      "# Tech\n\n",
      "# Tech\n\n%%glossary_column_width=50|30|20%%\n",
    ));
    await browser.waitUntil(
      async () => (await $(`${SECTION}:nth-child(1) col`).getAttribute("style")) === "width: 50%;",
      { timeoutMsg: "the stored widths were never applied" },
    );
  });

  // A reload, as Hot Reload or an update does it. Turning the plugin off in Settings
  // (disablePluginAndSave, what togglePlugin does) is different: Obsidian itself closes its views.
  it("stays open when the plugin reloads", async () => {
    await browser.executeObsidian(async ({ app }, id) => {
      const plugins = (app as unknown as { plugins: Plugins }).plugins;
      await plugins.disablePlugin(id);
      await plugins.enablePlugin(id);
    }, PLUGIN);
    await $(`${VIEW} ${SECTION}`).waitForDisplayed({ timeoutMsg: "the Glossary View did not come back" });
    const leaves = await browser.executeObsidian(({ app }, type) => app.workspace.getLeavesOfType(type).length, VIEW_TYPE);
    expect(leaves).toBe(1);
  });
});

// Keeps this file's names its own: a file with no import or export shares one scope with every other.
export {};

// The settings tab: declarative settings (Obsidian 1.13+), shown and hidden with other settings,
// and what changing them stores.

// Written without imports: describe, it, expect, browser, $ and the helpers are globals the harness
// provides.

/** What Obsidian keeps of its settings window that these tests reach for. */
interface SettingsWindow {
  open(): void;
  openTabById(id: string): void;
  close(): void;
  /** The open tab. Settings open in a window of their own, so its element isn't in `document`. */
  activeTab: { containerEl: HTMLElement } | null;
}

// executeObsidian sends its function as text, so each one finds the row itself: the row in the
// open settings tab whose name is `n`.

async function rowShown(name: string): Promise<boolean> {
  return browser.executeObsidian(({ app }, n) => {
    const tab = (app as unknown as { setting: SettingsWindow }).setting.activeTab;
    const row = Array.from(tab?.containerEl.querySelectorAll<HTMLElement>(".setting-item") ?? [])
      .find((r) => r.querySelector(".setting-item-name")?.textContent === n);
    return !!row && row.offsetParent !== null;
  }, name);
}

/** Sets a row's control the way the user's input does: the value, then its DOM events. */
async function setControl(name: string, value: string): Promise<void> {
  await browser.executeObsidian(({ app }, n, v) => {
    const tab = (app as unknown as { setting: SettingsWindow }).setting.activeTab;
    const row = Array.from(tab?.containerEl.querySelectorAll<HTMLElement>(".setting-item") ?? [])
      .find((r) => r.querySelector(".setting-item-name")?.textContent === n);
    const control = row?.querySelector<HTMLInputElement | HTMLSelectElement>("select, input");
    if (!control) throw new Error(`no control in the "${n}" row`);
    control.value = v;
    // Events built in the settings window's own realm.
    const win = control.ownerDocument.defaultView as unknown as typeof window;
    control.dispatchEvent(new win.Event("input", { bubbles: true }));
    control.dispatchEvent(new win.Event("change", { bubbles: true }));
  }, name, value);
}

async function storedSettings(): Promise<{ highlightStyle: string; excludeAcronyms: string[] }> {
  return browser.executeObsidian(({ plugins }) =>
    (plugins.glossary as unknown as { settings: { highlightStyle: string; excludeAcronyms: string[] } }).settings);
}

describe("The settings tab", () => {
  beforeEach(async () => {
    await resetState();
    await browser.executeObsidian(({ app }) => {
      const setting = (app as unknown as { setting: SettingsWindow }).setting;
      setting.open();
      setting.openTabById("glossary");
    });
    await browser.waitUntil(() => rowShown("Highlight style"), { timeoutMsg: "the Smart Glossary tab never showed its settings" });
  });

  afterEach(async () => {
    await browser.executeObsidian(({ app }) => (app as unknown as { setting: SettingsWindow }).setting.close());
  });

  it("shows the color only for the solid style, and applies the style", async () => {
    expect(await rowShown("Highlight color")).toBe(false);
    await setControl("Highlight style", "solid");
    await browser.waitUntil(() => rowShown("Highlight color"), { timeoutMsg: "the color setting never appeared for the solid style" });
    expect((await storedSettings()).highlightStyle).toBe("solid");
    expect(await browser.execute(() => document.body.classList.contains("glossary-style-solid"))).toBe(true);
  });

  it("stores a comma-separated exclusion list as a list", async () => {
    await setControl("Exclude acronyms", "API, CPU");
    await browser.waitUntil(async () => (await storedSettings()).excludeAcronyms.join("|") === "API|CPU", {
      timeoutMsg: "the exclusions were never stored as [API, CPU]",
    });
  });
});

// Keeps this file's names its own: a file with no import or export shares one scope with every other.
export {};

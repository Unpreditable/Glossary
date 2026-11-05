# GlossaryItemView — Known Bugs (post Task 5 implementation)

**Status as of 2026-11-04: all four bugs are closed.** The "Fix" sections below are the original
proposals and are kept for history. The code that shipped differs; each bug's status line says how.

| # | Bug | Status |
|---|---|---|
| 1 | `skipGlossaryRedirect` flag stays `true` | Resolved (flag removed) |
| 2 | Sort-hint badge not visible on new rows | Resolved (redesigned) |
| 3 | Column resize doesn't work | Resolved |
| 4 | Enter in last row doesn't create a new row | Cannot reproduce |

## Bug 1: `skipGlossaryRedirect` flag stays `true` permanently

**Status: Resolved (flag removed).** The flag no longer exists. A per-file
`fileViewPreference` map in `src/main.ts` records whether each note should open as source or as
the Glossary View, so nothing has to be reset after "View source".

**Symptom:** After clicking "View source" once, the file always opens in markdown — the glossary view never opens again for that session.

**Root cause:** The flag is reset inside the `file-open` event handler. But `leaf.openFile(file, { state: { mode: 'source' } })` may not fire `file-open` if the active file hasn't changed (only the view mode changed). The flag is never cleared.

**Fix:** Reset the flag with a `setTimeout` immediately after setting it, rather than relying on `file-open` to clear it:
```typescript
// In GlossaryItemView "View source" click handler:
this.plugin.skipGlossaryRedirect = true;
setTimeout(() => { this.plugin.skipGlossaryRedirect = false; }, 300);
void this.leaf.openFile(file, { state: { mode: 'source' } });
```
Remove the `this.skipGlossaryRedirect = false` line from the `file-open` interceptor in `main.ts`.

---

## Bug 2: Badge (sort hint) not visible on new rows

**Status: Resolved (redesigned).** The badge was dropped. New rows get a red corner mark in their
first cell, and a hint ("New items will appear in alphabetical order on next open") appears next to
"+ Add term" while the table has a new row. Both are plain CSS in `src/decorations/cssInjector.ts`,
so nothing is clipped.

**Symptom:** After adding a new row, no hover badge appears.

**Root cause:** Badge is `position: absolute` inside a `<td>`. With `table-layout: fixed`, the table clips overflow from cells. Even with `overflow: visible` on the cell, the table element itself clips it.

**Fix options (pick one):**
- A) Use `position: fixed` + JS to position the badge near the cursor/row on `mouseenter`
- B) Show the badge below the entire table row using a dedicated visually-full-width `<tr>` that appears on hover (CSS sibling trick with `:has()`)
- C) Simplest: replace with a tooltip using the native `title` attribute on the row

**Recommended:** Option C for now — add `tr.title = 'Will sort alphabetically on next open'` to new rows. No positioning issues.

---

## Bug 3: Column resize doesn't work

**Status: Resolved.** A JS resizer (`attachColResizer` in `src/glossary/glossaryView.ts`) drags the
`<col>` widths, close to the proposal below. Widths are saved in the note as a
`%%glossary_column_width=…%%` line above the table, not in plugin settings. Three e2e tests in
`e2e/specs/glossaryView.e2e.ts` cover saving, reading back, and editing after the line shifts rows.

**Symptom:** Resize handles appear on `<th>` corners (CSS `resize: horizontal`) but dragging them resizes only the header cell element, not the column.

**Root cause:** CSS `resize` is element-level, not table-column-level. It has no effect on `<col>` widths.

**Fix:** Implement a JS column resizer:
- On `mousedown` of a `<th>`, track `mousemove` and update `<col style="width: Xpx">` 
- Store widths in `this.colWidths: number[][]` per table (by tableIdx)
- Persist in plugin settings or just session-local

Simple approach:
```typescript
// In renderSection, after creating thead:
this.attachColResizer(thead, colgroup, table.colCount);
```

```typescript
private attachColResizer(thead: HTMLElement, colgroup: HTMLElement, colCount: number): void {
  const cols = Array.from(colgroup.children) as HTMLElement[];
  const ths = Array.from(thead.querySelectorAll('th')) as HTMLElement[];
  
  for (let i = 0; i < colCount; i++) {
    const handle = ths[i].createEl('span', { cls: 'glossary-col-resize-handle' });
    let startX = 0;
    let startW = 0;
    
    handle.addEventListener('mousedown', (e) => {
      e.preventDefault();
      startX = e.clientX;
      startW = ths[i].offsetWidth;
      
      const onMove = (mv: MouseEvent) => {
        const newW = Math.max(40, startW + mv.clientX - startX);
        cols[i].style.width = newW + 'px';
      };
      const onUp = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
  }
}
```

CSS for the handle:
```css
.glossary-view-table th { position: relative; }
.glossary-col-resize-handle {
  position: absolute;
  right: 0; top: 0; bottom: 0;
  width: 5px;
  cursor: col-resize;
}
.glossary-col-resize-handle:hover { background: var(--interactive-accent); opacity: 0.4; }
```

Also remove `resize: horizontal` from `th` CSS (it conflicts).

---

## Bug 4: Enter in last row doesn't create a new row

**Status: Cannot reproduce.** Two e2e tests added on 2026-11-04 pass in Obsidian 1.14.4: Enter in
the last existing row adds a new row with its first cell focused, and Enter in a filled new row
saves it and starts another. The investigation notes below predate that check. Reopen if it shows up
again, with the steps that trigger it.

**Symptom:** Pressing Enter in the last existing row moves focus nowhere; new row is not created.

**Root cause:** Unclear — logic looks correct. `nextTr` should be `null` for the last row, `!isNew` is `true`, so `addNewRow` should be called. Possible issue: `input.closest('tr')` may fail if the input is nested inside multiple elements (input → td → tr), but `closest` traverses upward so it should work. 

**Things to verify:**
1. Check browser console for errors when pressing Enter in last row
2. Verify `nextElementSibling` is actually `null` (not a text node or something else)
3. Verify `addNewRow` is called by adding a `console.log` before the call

**Likely fix:** The `setTimeout(..., 0)` delay may interact badly with the blur handler's own `setTimeout`. When Enter is pressed:
- `e.preventDefault()` ✓
- Timer A set: `setTimeout(checkNextRow, 0)`
- Input blurs naturally (focus leaves when?) — actually `e.preventDefault()` prevents the default Enter behavior but doesn't blur the input. The input still has focus.

Wait — if the input still has focus after Enter, `input.closest('tr')` finds the row, `nextTr` is null, `addNewRow` is called. But `addNewRow` calls `focusDisplay(inputs[0])` which calls `display.click()` which calls `input.focus()` on the new row's first cell. This should blur the current input (existing row). Then the existing row's blur handler saves.

But: `focusDisplay` might not work if `display` is not found. Let me check: in `makeCell`, the display span has class `glossary-cell-display`. `focusDisplay` does `input.parentElement?.querySelector('.glossary-cell-display')`. `input.parentElement` is the `<td>`. Inside `<td>` we have `display` span + `input`. So the querySelector should work.

Unless: when Enter is pressed in a new row that has been added (isNew=true), `!isNew` is false so `addNewRow` is NOT called. But the user says Enter doesn't create a new row for existing rows either.

Could it be that all rows are treated as `isNew = true`? Let me re-check `renderExistingRow`:
```typescript
this.wireKeys(inputs[c], c, inputs, tbody, table, false);
```
`isNew = false` here. So `!isNew` is `true`. Should call `addNewRow`.

I think the most likely issue is that the `tbody` reference passed to `wireKeys` for existing rows might be stale after a re-render. After `saveNewRow` re-renders the section, the old `tbody` reference is gone from the DOM. But for existing rows this shouldn't matter since they're rendered once.

**Simple fix to test:** Add a `console.log('addNewRow called')` right before `this.addNewRow(tbody, table)` in `wireKeys`. If it doesn't log, the condition is not being met. If it does log but no row appears, the issue is in `addNewRow`.

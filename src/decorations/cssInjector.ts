import type { GlossarySettings } from '../settings';

const STYLE_ID = 'glossary-plugin-styles';

const GRADIENTS: Record<string, string> = {
  gradient1:  'linear-gradient(90deg, #0065ff, #bf63f3, #f5e6a8)',
  gradient2:  'linear-gradient(90deg, #ff6b6b, #feca57, #48cae4)',
  gradient3:  'linear-gradient(90deg, #667eea, #764ba2, #f093fb)',
  gradient4:  'linear-gradient(90deg, #ffecd2, #fcb69f, #ff8a80)',
  gradient5:  'linear-gradient(90deg, #a8edea, #fed6e3, #ffeaa7)',
  gradient6:  'linear-gradient(90deg, #ff9a9e, #fecfef, #fecfef)',
  gradient7:  'linear-gradient(90deg, #21d4fd, #b721ff, #fcb045)',
  gradient8:  'linear-gradient(90deg, #96fbc4, #f9f586, #ff8a80)',
  gradient9:  'linear-gradient(90deg, #fbc2eb, #a6c1ee, #c2e9fb)',
  gradient10: 'linear-gradient(90deg, #84fab0, #8fd3f4, #d299c2)',
};

/**
 * Returns the CSS rule block for the .cm-glossary-highlight class
 * based on the current settings. Pure function — no DOM access.
 */
export function buildStylesheet(settings: GlossarySettings): string {
  let highlightRule: string;

  if (settings.highlightStyle === 'solid') {
    highlightRule = `
.cm-glossary-highlight, .glossary-preview {
  text-decoration: underline;
  text-decoration-color: ${settings.highlightColor};
  text-decoration-thickness: 2px;
}`;
  } else {
    const grad = GRADIENTS[settings.highlightStyle];
    highlightRule = `
.cm-glossary-highlight, .glossary-preview {
  background: ${grad};
  background-clip: text;
  -webkit-background-clip: text;
  color: transparent;
  border-bottom: 2px solid transparent;
  border-image: ${grad} 0 0 100% 0;
}`;
  }

  const staticRules = `
.cm-tooltip-glossary {
  background: var(--background-primary);
  border: 1px solid var(--background-modifier-border);
  border-radius: 4px;
  padding: 8px 12px;
  max-width: 320px;
  font-size: var(--font-ui-small);
  color: var(--text-normal);
  line-height: 1.5;
}
.glossary-preview {
  display: inline-block;
  padding: 2px 6px;
  border-radius: 2px;
  font-weight: 500;
}`;

  const modalRules = `
.glossary-add-modal input::placeholder {
  color: var(--text-faint) !important;
  opacity: 0.6;
  font-style: italic;
}
.glossary-modal-row {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
}
.glossary-modal-row input {
  flex: 1;
  min-width: 0;
}
.glossary-modal-full {
  margin-bottom: 8px;
}
.glossary-modal-full input {
  width: 100%;
  box-sizing: border-box;
}
.glossary-input-invalid {
  border-color: var(--color-red, #e03e3e) !important;
  outline-color: var(--color-red, #e03e3e) !important;
}
.glossary-modal-errors {
  margin: 8px 0 4px;
  min-height: 96px;
  font-size: var(--font-ui-small);
  color: var(--text-muted);
}
.glossary-modal-errors strong {
  color: var(--text-normal);
}
.glossary-modal-error-list {
  margin: 2px 0 0 16px;
  padding: 0;
}
.glossary-modal-duplicates {
  margin: 8px 0;
  padding: 8px 12px;
  border-radius: 4px;
  background: rgba(255, 160, 0, 0.08);
  border: 1px solid var(--background-modifier-border);
  font-size: var(--font-ui-small);
}
.glossary-modal-duplicate-list {
  margin: 4px 0 0 16px;
  padding: 0;
}`;

  const viewRules = `
.glossary-item-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}
.glossary-view-toolbar {
  display: flex;
  gap: 8px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--background-modifier-border);
  align-items: center;
  flex-shrink: 0;
  background: var(--background-primary);
}
.glossary-view-search {
  flex: 1;
  padding: 4px 8px;
  border-radius: 4px;
  border: 1px solid var(--background-modifier-border);
  background: var(--background-secondary);
  color: var(--text-normal);
  font-size: var(--font-ui-small);
}
.glossary-view-icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 3px 5px;
  cursor: pointer;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 4px;
  color: var(--text-muted);
  flex-shrink: 0;
}
.glossary-view-icon-btn:hover {
  color: var(--text-normal);
  border-color: var(--background-modifier-border);
}
.glossary-view-source-btn {
  font-size: var(--font-ui-small);
  padding: 3px 10px;
  cursor: pointer;
}
.glossary-view-body {
  flex: 1;
  overflow-y: auto;
  padding: 8px 12px;
}
.glossary-view-section {
  margin-bottom: 16px;
}
.glossary-view-table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
}
.glossary-view-table th {
  position: relative;
  text-align: left;
  padding: 4px 8px;
  font-size: var(--font-ui-small);
  color: var(--text-muted);
  font-weight: 600;
  border-bottom: 1px solid var(--background-modifier-border);
  user-select: none;
}
.glossary-col-resize-handle {
  position: absolute;
  right: 0; top: 0; bottom: 0;
  width: 5px;
  cursor: col-resize;
}
.glossary-col-resize-handle:hover { background: var(--interactive-accent); opacity: 0.4; }
.glossary-view-table td {
  padding: 1px 0;
  vertical-align: middle;
  position: relative;
}
.glossary-cell-display {
  display: block;
  padding: 3px 8px;
  font-size: var(--font-ui-small);
  color: var(--text-normal);
  cursor: text;
  white-space: pre-wrap;
  word-break: break-word;
  min-height: 1.6em;
  border: 1px solid transparent;
  border-radius: 3px;
}
.glossary-cell-display:hover {
  border-color: var(--background-modifier-border);
}
.glossary-cell-input {
  width: 100%;
  background: var(--background-primary);
  border: 1px solid var(--interactive-accent);
  border-radius: 3px;
  padding: 3px 8px;
  color: var(--text-normal);
  font-size: var(--font-ui-small);
  box-sizing: border-box;
  outline: none;
}
.glossary-row-new td:first-child { position: relative; }
.glossary-row-new td:first-child::before {
  content: '';
  position: absolute;
  top: 0; left: 0;
  border-style: solid;
  border-width: 7px 7px 0 0;
  border-color: var(--color-red, #e74c3c) transparent transparent transparent;
}
.glossary-view-add-area {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 6px;
}
.glossary-view-add-btn {
  font-size: var(--font-ui-small);
  padding: 2px 10px;
  cursor: pointer;
  border: 1px dashed var(--background-modifier-border);
  border-radius: 4px;
  background: transparent;
  color: var(--text-muted);
  flex-shrink: 0;
}
.glossary-view-add-btn:hover {
  color: var(--text-normal);
  border-color: var(--interactive-accent);
}
.glossary-view-add-hint {
  display: none;
  font-size: var(--font-ui-smaller);
  color: var(--text-faint);
}
.glossary-view-section:has(.glossary-row-new) .glossary-view-add-hint { display: inline; }
.glossary-view-add-hint::before {
  content: '';
  display: inline-block;
  border-style: solid;
  border-width: 6px 6px 0 0;
  border-color: var(--color-red, #e74c3c) transparent transparent transparent;
  margin-right: 5px;
  vertical-align: middle;
}
.glossary-view-empty {
  color: var(--text-muted);
  padding: 16px 0;
}
.glossary-source-prompt {
  display: flex;
  justify-content: flex-end;
  padding: 4px 16px;
}`;

  return highlightRule + staticRules + modalRules + viewRules;
}

/**
 * Writes a <style id="glossary-plugin-styles"> element to document.head.
 * Removes any previously injected element first to prevent duplicates.
 */
export function injectGlossaryStyles(settings: GlossarySettings): void {
  document.getElementById(STYLE_ID)?.remove();
  // eslint-disable-next-line obsidianmd/no-forbidden-elements -- dynamic CSS injection required for settings-based gradient/solid styles; cannot use static styles.css
  const styleEl = document.createElement('style');
  styleEl.id = STYLE_ID;
  styleEl.textContent = buildStylesheet(settings);
  document.head.appendChild(styleEl);
}

/**
 * Removes the glossary highlight stylesheet from document.head.
 * No-op if the element does not exist.
 */
export function removeGlossaryStyles(): void {
  document.getElementById(STYLE_ID)?.remove();
}

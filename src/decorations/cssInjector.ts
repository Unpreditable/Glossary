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

  return highlightRule + staticRules + modalRules;
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

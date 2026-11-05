import type { GlossarySettings } from '../settings';

const STYLE_CLASS_PREFIX = 'glossary-style-';

/**
 * Applies the highlight style setting to a window's <body>: styles.css styles highlights by a
 * `glossary-style-<style>` body class, and the solid style's color comes from a CSS variable.
 */
export function applyHighlightStyle(body: HTMLElement, settings: GlossarySettings): void {
  removeHighlightStyle(body);
  body.addClass(STYLE_CLASS_PREFIX + settings.highlightStyle);
  body.setCssProps({ '--glossary-highlight-color': settings.highlightColor });
}

export function removeHighlightStyle(body: HTMLElement): void {
  for (const cls of Array.from(body.classList)) {
    if (cls.startsWith(STYLE_CLASS_PREFIX)) body.removeClass(cls);
  }
  body.setCssProps({ '--glossary-highlight-color': '' });
}

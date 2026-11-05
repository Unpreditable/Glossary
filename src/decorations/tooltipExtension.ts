import { hoverTooltip, Tooltip, EditorView } from '@codemirror/view';
import type { Extension } from '@codemirror/state';
import type { createGlossaryViewPlugin } from './glossaryViewPlugin';
import type { GlossaryTerm } from '../index/termIndex';

type ViewPluginSpec = ReturnType<typeof createGlossaryViewPlugin>;

/** The tooltip body: the first definition, a count of the others, and where it comes from. */
function renderTooltip(doc: Document, terms: GlossaryTerm[]): HTMLElement {
  const term = terms[0];
  const dom = doc.createElement('div');
  dom.className = 'cm-tooltip-glossary';

  // Each part is one line; createEl sets text, so nothing from the glossary is parsed as HTML.
  const parts: Array<(el: HTMLElement) => void> = [];
  if (term.acronym) parts.push(el => el.createEl('strong', { text: term.acronym }));
  if (term.fullTerm) parts.push(el => el.createEl('strong', { text: term.fullTerm }));
  if (term.description) parts.push(el => el.appendText(term.description ?? ''));
  if (parts.length === 0) parts.push(el => el.appendText('No definition available'));
  if (terms.length > 1) {
    parts.push(el => el.createEl('small', { text: `(+${terms.length - 1} more definitions)` }));
  }
  if (term.sourceFile) {
    parts.push(el => el.createEl('small', { text: term.sourceFile, cls: 'cm-tooltip-glossary-source' }));
  }

  parts.forEach((addPart, i) => {
    if (i > 0) dom.createEl('br');
    addPart(dom);
  });
  return dom;
}

export function createTooltipExtension(viewPluginSpec: ViewPluginSpec): Extension {
  return hoverTooltip((view: EditorView, pos: number): Tooltip | null => {
    const vp = view.plugin(viewPluginSpec);
    if (!vp) return null;

    let result: Tooltip | null = null;

    vp.decorations.between(pos, pos, (from, to, deco) => {
      const attrs = (deco.spec as { attributes?: Record<string, string> }).attributes;
      const termsData = attrs?.['data-terms'];
      if (!termsData || pos < from || pos > to) return;

      const terms = JSON.parse(termsData) as GlossaryTerm[];
      result = {
        pos: from,
        end: to,
        above: true,
        // The editor's own document, which is a popout window's when the note is in one.
        create: (editor) => ({ dom: renderTooltip(editor.dom.doc, terms) }),
      };
    });

    return result;
  });
}

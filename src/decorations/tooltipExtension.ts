import { hoverTooltip, Tooltip, EditorView } from '@codemirror/view';
import type { Extension } from '@codemirror/state';
import type { createGlossaryViewPlugin } from './glossaryViewPlugin';
import type { GlossaryTerm } from '../index/termIndex';

type ViewPluginSpec = ReturnType<typeof createGlossaryViewPlugin>;

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
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
      const term = terms[0];

      result = {
        pos: from,
        end: to,
        above: true,
        create: (): { dom: HTMLElement } => {
          const dom = document.createElement('div');
          dom.className = 'cm-tooltip-glossary';

          const parts: string[] = [];
          if (term.acronym)   parts.push(`<strong>${escapeHtml(term.acronym)}</strong>`);
          if (term.fullTerm)  parts.push(`<strong>${escapeHtml(term.fullTerm)}</strong>`);
          if (term.description) parts.push(escapeHtml(term.description));
          if (parts.length === 0) parts.push('No definition available');
          if (terms.length > 1)
            parts.push(`<small>(+${terms.length - 1} more definitions)</small>`);
          if (term.sourceFile)
            parts.push(`<small style="color:var(--text-muted)">${escapeHtml(term.sourceFile)}</small>`);

          dom.innerHTML = parts.join('<br>');
          return { dom };
        },
      };
    });

    return result;
  });
}

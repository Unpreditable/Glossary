import { ViewPlugin, Decoration, DecorationSet, EditorView, ViewUpdate } from "@codemirror/view";
import { RangeSetBuilder } from "@codemirror/state";
import { isInCodeBlock } from '../matcher/codeBlockDetector';
import type { TermMatcher, TermMatch } from '../matcher/termMatcher';
import { editorInfoField } from 'obsidian';
import type { App } from 'obsidian';
import type { GlossarySettings } from '../settings';

/** Regex matching a fenced code block fence line: optional whitespace then 3+ backticks. */
const FENCE_PATTERN = /^\s*```/;

/**
 * Returns true if `pos` falls inside an inline code span in `lineText`.
 * `lineStart` is the document offset of the first character of `lineText`.
 * Handles paired backticks; ignores escaped backticks.
 */
function isInInlineCode(lineText: string, lineStart: number, pos: number): boolean {
  const localPos = pos - lineStart;
  // Find all backtick spans: pairs of ` ... `
  const backtickRegex = /`([^`]+)`/g;
  let m: RegExpExecArray | null;
  while ((m = backtickRegex.exec(lineText)) !== null) {
    // m.index = position of opening backtick, m[0].length includes both backticks
    const spanStart = m.index;
    const spanEnd = m.index + m[0].length;
    // Exclude the backtick characters themselves (spanStart+1 to spanEnd-1 is content)
    if (localPos > spanStart && localPos < spanEnd) {
      return true;
    }
  }
  return false;
}

/**
 * Structural interface for the plugin reference passed into GlossaryViewPlugin.
 * Using a local interface instead of importing GlossaryPlugin from main.ts
 * avoids a circular dependency (main.ts will import GlossaryViewPlugin).
 */
interface PluginRef {
  matcher: TermMatcher;
  app: App;
  settings: GlossarySettings;
}

/** The line cache is dropped wholesale past this many distinct lines; it refills from what's visible. */
const MAX_CACHED_LINES = 5000;

export class GlossaryViewPlugin {
  decorations: DecorationSet;
  /**
   * Matches per line, keyed by the line's text, with positions relative to the line start.
   * A line's matches depend only on its text, so entries stay valid however lines move.
   * They belong to the matcher they came from: each index build makes a new one, which empties
   * the cache (main.ts then calls workspace.updateOptions(), so every editor gets an update).
   */
  private lineCache: Map<string, TermMatch[]> = new Map();
  private cachedFor: TermMatcher | null = null;

  constructor(view: EditorView, private plugin: PluginRef) {
    this.decorations = this.buildDecorations(view);
  }

  update(update: ViewUpdate): void {
    // Cursor-only updates with the same matcher change nothing.
    if (update.docChanged || update.viewportChanged || this.plugin.matcher !== this.cachedFor) {
      this.decorations = this.buildDecorations(update.view);
    }
  }

  /** The line's matches relative to its start, from the cache or freshly computed. */
  private lineMatches(text: string, matcher: TermMatcher): TermMatch[] {
    let matches = this.lineCache.get(text);
    if (!matches) {
      if (this.lineCache.size >= MAX_CACHED_LINES) this.lineCache.clear();
      matches = matcher.findTermsInText(text, 0);
      this.lineCache.set(text, matches);
    }
    return matches;
  }

  private buildDecorations(view: EditorView): DecorationSet {
    if (!this.plugin?.matcher) {
      return new RangeSetBuilder<Decoration>().finish();
    }
    if (this.plugin.matcher !== this.cachedFor) {
      this.lineCache.clear();
      this.cachedFor = this.plugin.matcher;
    }

    // This editor's own file: in a split, the active file belongs to whichever pane has focus.
    const file = view.state.field(editorInfoField, false)?.file ?? null;
    if (!file || !this.plugin.matcher.shouldProcessFile(this.plugin.app, file)) {
      this.lineCache.clear();
      return new RangeSetBuilder<Decoration>().finish();
    }

    const builder = new RangeSetBuilder<Decoration>();
    const doc = view.state.doc;

    // Pre-compute which line offsets are inside fenced code blocks by scanning
    // from the beginning of the document. This text-based approach is reliable
    // regardless of Lezer parser node name variations across Obsidian versions.
    const fencedLineOffsets = this.computeFencedLineOffsets(view);

    // Add the matches within the visible ranges; each line is matched on first sight and cached.
    for (const range of view.visibleRanges) {
      let lineObj = doc.lineAt(range.from);
      while (lineObj.from <= range.to) {
        // Skip entire lines that are inside a fenced code block
        if (!fencedLineOffsets.has(lineObj.from)) {
          for (const match of this.lineMatches(lineObj.text, this.plugin.matcher)) {
            const from = lineObj.from + match.from;
            const to = lineObj.from + match.to;
            if (
              from >= range.from &&
              to <= range.to &&
              !isInInlineCode(lineObj.text, lineObj.from, from) &&
              !isInCodeBlock(view, from)
            ) {
              builder.add(
                from,
                to,
                Decoration.mark({
                  class: "cm-glossary-highlight",
                  attributes: { "data-terms": JSON.stringify(match.terms) },
                }),
              );
            }
          }
        }
        if (lineObj.to >= doc.length) break;
        lineObj = doc.lineAt(lineObj.to + 1);
      }
    }

    return builder.finish();
  }

  /**
   * Scans the entire document text to find line offsets that are inside fenced
   * code blocks (between matching ``` fence markers). Returns a Set of line
   * `from` offsets that must be excluded from decoration.
   *
   * Text-based detection is used as a reliable supplement to Lezer syntaxTree
   * because Obsidian's markdown parser node type names vary across versions.
   */
  private computeFencedLineOffsets(view: EditorView): Set<number> {
    const result = new Set<number>();
    const doc = view.state.doc;
    let inFenced = false;

    let lineObj = doc.lineAt(0);
    while (true) {
      if (FENCE_PATTERN.test(lineObj.text)) {
        // The fence line itself should not be decorated either
        result.add(lineObj.from);
        inFenced = !inFenced;
      } else if (inFenced) {
        result.add(lineObj.from);
      }
      if (lineObj.to >= doc.length) break;
      lineObj = doc.lineAt(lineObj.to + 1);
    }

    return result;
  }
}

/**
 * Factory that creates a ViewPlugin spec capturing the plugin reference via closure.
 * Store the returned spec in a field on GlossaryPlugin so refreshStyles() can call
 * editorView.plugin(spec) to retrieve the running instance.
 */
export function createGlossaryViewPlugin(plugin: PluginRef) {
  return ViewPlugin.fromClass(
    class extends GlossaryViewPlugin {
      constructor(view: EditorView) { super(view, plugin); }
    },
    { decorations: (v) => v.decorations },
  );
}

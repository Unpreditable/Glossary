import { ViewPlugin, Decoration, DecorationSet, EditorView, ViewUpdate } from "@codemirror/view";
import { RangeSetBuilder } from "@codemirror/state";
import { isInCodeBlock } from '../matcher/codeBlockDetector';
import type { TermMatcher, TermMatch } from '../matcher/termMatcher';
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

const LOOKAHEAD_BYTES = 4000; // approx 50 lines × 80 chars

export class GlossaryViewPlugin {
  decorations: DecorationSet;
  forceRebuild = false;
  private lineCache: Map<number, TermMatch[]> = new Map();

  constructor(view: EditorView, private plugin: PluginRef) {
    if (!this.plugin?.matcher) {
      this.decorations = new RangeSetBuilder<Decoration>().finish();
      return;
    }
    this.decorations = this.buildDecorations(view);
  }

  update(update: ViewUpdate): void {
    if (this.forceRebuild) {
      this.lineCache.clear();
      this.forceRebuild = false;
      this.decorations = this.buildDecorations(update.view);
    } else if (update.docChanged) {
      this.evictChangedLines(update);
      this.decorations = this.buildDecorations(update.view);
    } else if (update.viewportChanged) {
      this.decorations = this.buildDecorations(update.view);
    }
    // cursor-only (no docChanged, no viewportChanged): no-op
  }

  private evictChangedLines(update: ViewUpdate): void {
    update.changes.iterChanges((fromA: number) => {
      const line = update.startState.doc.lineAt(fromA);
      this.lineCache.delete(line.from);
    });
  }

  private buildDecorations(view: EditorView): DecorationSet {
    if (!this.plugin?.matcher) {
      return new RangeSetBuilder<Decoration>().finish();
    }

    const activeFile = this.plugin.app.workspace.getActiveFile();
    if (!activeFile || !this.plugin.matcher.shouldProcessFile(this.plugin.app, activeFile)) {
      this.lineCache.clear();
      return new RangeSetBuilder<Decoration>().finish();
    }

    const builder = new RangeSetBuilder<Decoration>();
    const doc = view.state.doc;

    // Pass 1: populate cache for visible ranges + lookahead
    for (const range of view.visibleRanges) {
      const lookaheadPos = Math.min(doc.length, range.to + LOOKAHEAD_BYTES);
      const scanToLine = doc.lineAt(lookaheadPos);
      const scanTo = scanToLine.to;

      let lineObj = doc.lineAt(range.from);
      while (lineObj.from <= scanTo) {
        if (!this.lineCache.has(lineObj.from)) {
          const matches = this.plugin.matcher.findTermsInText(lineObj.text, lineObj.from);
          this.lineCache.set(lineObj.from, matches);
        }
        if (lineObj.to >= doc.length) break;
        lineObj = doc.lineAt(lineObj.to + 1);
      }
    }

    // Pre-compute which line offsets are inside fenced code blocks by scanning
    // from the beginning of the document. This text-based approach is reliable
    // regardless of Lezer parser node name variations across Obsidian versions.
    const fencedLineOffsets = this.computeFencedLineOffsets(view);

    // Pass 2: add only matches within visible ranges to the builder
    for (const range of view.visibleRanges) {
      let lineObj = doc.lineAt(range.from);
      while (lineObj.from <= range.to) {
        // Skip entire lines that are inside a fenced code block
        if (!fencedLineOffsets.has(lineObj.from)) {
          const cached = this.lineCache.get(lineObj.from);
          if (cached) {
            for (const match of cached) {
              if (
                match.from >= range.from &&
                match.to <= range.to &&
                !isInInlineCode(lineObj.text, lineObj.from, match.from) &&
                !isInCodeBlock(view, match.from)
              ) {
                builder.add(
                  match.from,
                  match.to,
                  Decoration.mark({
                    class: "cm-glossary-highlight",
                    attributes: { "data-terms": JSON.stringify(match.terms) },
                  }),
                );
              }
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

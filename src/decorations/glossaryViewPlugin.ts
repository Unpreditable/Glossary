import { ViewPlugin, Decoration, DecorationSet, EditorView, ViewUpdate } from "@codemirror/view";
import { RangeSetBuilder } from "@codemirror/state";
import { isInCodeBlock } from '../matcher/codeBlockDetector';
import type { TermMatcher, TermMatch } from '../matcher/termMatcher';
import type { App } from 'obsidian';
import type { GlossarySettings } from '../settings';

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
    // Guard: if matcher is not yet initialised, return empty set.
    // shouldProcessFile is intentionally skipped here — buildGlossaryIndex()
    // only populates termIndex for processable files, so the index is already filtered.
    if (!this.plugin?.matcher) {
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

    // Pass 2: add only matches within visible ranges to the builder
    for (const range of view.visibleRanges) {
      let lineObj = doc.lineAt(range.from);
      while (lineObj.from <= range.to) {
        const cached = this.lineCache.get(lineObj.from);
        if (cached) {
          for (const match of cached) {
            if (
              match.from >= range.from &&
              match.to <= range.to &&
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
        if (lineObj.to >= doc.length) break;
        lineObj = doc.lineAt(lineObj.to + 1);
      }
    }

    return builder.finish();
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

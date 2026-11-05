/**
 * Unit tests for GlossaryViewPlugin's decorations. CM6's EditorView needs a DOM, so the plugin
 * gets a stand-in with a real EditorState and the whole document as its visible range.
 */

import { EditorState } from '@codemirror/state';
import type { EditorView, ViewUpdate } from '@codemirror/view';
import { GlossaryViewPlugin } from '../../src/decorations/glossaryViewPlugin';
import { TermMatcher } from '../../src/matcher/termMatcher';
import type { GlossarySettings } from '../../src/settings';
import type { TermIndex } from '../../src/index/termIndex';
import { makeMockApp, makeMockFile } from '../fixtures/mockApp';
import { editorInfoField } from 'obsidian';
import type { MarkdownFileInfo } from 'obsidian';

const SETTINGS: GlossarySettings = {
  matchBy: 'both',
  caseSensitive: false,
  fuzzyMatching: false,
  excludeAcronyms: [],
  excludeTerms: [],
  includeFolders: [],
  excludeFolders: [],
  highlightStyle: 'gradient1',
  highlightColor: '#ff6b35',
};

const INDEX: TermIndex = { API: [{ sourceFile: 'glossary.md', acronym: 'API' }] };

function fakeView(state: EditorState): EditorView {
  return { state, visibleRanges: [{ from: 0, to: state.doc.length }] } as unknown as EditorView;
}

/** A document open in an editor showing `path`. */
function docIn(doc: string, path = 'note.md'): EditorState {
  return EditorState.create({ doc, extensions: editorInfoField.init(() => ({ file: makeMockFile(path) }) as unknown as MarkdownFileInfo) });
}

function makePlugin(state: EditorState, activePath = 'note.md'): GlossaryViewPlugin {
  const app = makeMockApp(['glossary.md']);
  (app as unknown as { workspace: unknown }).workspace = { getActiveFile: () => makeMockFile(activePath) };
  const ref = { app, settings: SETTINGS, matcher: new TermMatcher(INDEX, SETTINGS) };
  return new GlossaryViewPlugin(fakeView(state), ref);
}

/** The text under each decoration, in document order. */
function highlighted(plugin: GlossaryViewPlugin, state: EditorState): string[] {
  const out: string[] = [];
  const iter = plugin.decorations.iter();
  while (iter.value) {
    out.push(state.sliceDoc(iter.from, iter.to));
    iter.next();
  }
  return out;
}

/** Applies a change and runs the plugin's update, as CodeMirror does after a transaction. */
function edit(plugin: GlossaryViewPlugin, state: EditorState, change: { from: number; to?: number; insert?: string }): EditorState {
  const tr = state.update({ changes: change });
  plugin.update({
    view: fakeView(tr.state), state: tr.state, startState: state,
    changes: tr.changes, docChanged: true, viewportChanged: false,
  } as unknown as ViewUpdate);
  return tr.state;
}

describe('GlossaryViewPlugin decorations', () => {
  it('highlights terms on every visible line', () => {
    const state = docIn('aa API\nbb\ncc API');
    expect(highlighted(makePlugin(state), state)).toEqual(['API', 'API']);
  });

  // A later line moving onto the start offset another line had: the old position-keyed
  // cache gave it that line's matches.
  it('keeps highlights right after an edit shifts later lines', () => {
    let state = docIn('aa API\nbb\ncc API');
    const plugin = makePlugin(state);
    state = edit(plugin, state, { from: 0, to: 3 }); // "API\nbb\ncc API": line 3 now starts where line 2 did
    expect(highlighted(plugin, state)).toEqual(['API', 'API']);
  });

  it('keeps highlights right after two lines are joined', () => {
    let state = docIn('one\nAPI two\nthree API');
    const plugin = makePlugin(state);
    state = edit(plugin, state, { from: 3, to: 4 }); // "oneAPI two\nthree API"
    expect(highlighted(plugin, state)).toEqual(['API']);
    expect(state.sliceDoc(0, 10)).toBe('oneAPI two'); // \bAPI\b doesn't match inside "oneAPI"
  });

  it('highlights a term typed into a line', () => {
    let state = docIn('first\nsecond');
    const plugin = makePlugin(state);
    state = edit(plugin, state, { from: 6, insert: 'API ' });
    expect(highlighted(plugin, state)).toEqual(['API']);
  });

  // A split: the focused pane shows another file than this editor.
  it('highlights its own note while a glossary note has focus', () => {
    const state = docIn('An API', 'note.md');
    expect(highlighted(makePlugin(state, 'glossary.md'), state)).toEqual(['API']);
  });

  it('leaves a glossary note bare while another note has focus', () => {
    const state = docIn('An API', 'glossary.md');
    expect(highlighted(makePlugin(state, 'note.md'), state)).toEqual([]);
  });

  it('does not rebuild on a cursor-only update', () => {
    const state = docIn('API');
    const plugin = makePlugin(state);
    const before = plugin.decorations;
    plugin.update({ docChanged: false, viewportChanged: false } as unknown as ViewUpdate);
    expect(plugin.decorations).toBe(before);
  });

  // An index rebuild makes a new matcher; workspace.updateOptions() then sends every editor an
  // update that changes neither the document nor the viewport.
  it('redecorates against a new matcher, dropping matches cached from the old one', () => {
    const state = docIn('An API and a CPU');
    const ref = { app: makeMockApp(), settings: SETTINGS, matcher: new TermMatcher(INDEX, SETTINGS) };
    const plugin = new GlossaryViewPlugin(fakeView(state), ref);
    expect(highlighted(plugin, state)).toEqual(['API']);

    ref.matcher = new TermMatcher({ CPU: [{ sourceFile: 'glossary.md', acronym: 'CPU' }] }, SETTINGS);
    plugin.update({ view: fakeView(state), docChanged: false, viewportChanged: false } as unknown as ViewUpdate);
    expect(highlighted(plugin, state)).toEqual(['CPU']);
  });
});

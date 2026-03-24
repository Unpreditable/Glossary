/**
 * Unit tests for GlossaryViewPlugin cache logic.
 * CM6 ViewPlugin requires DOM — these tests only exercise the Map-level
 * cache eviction and guard logic without instantiating any EditorView.
 */

import { GlossaryViewPlugin } from '../../src/decorations/glossaryViewPlugin';
import type { TermMatch } from '../../src/matcher/termMatcher';

// ─── Minimal stubs ───────────────────────────────────────────────────────────

function makeMatch(from: number, to: number): TermMatch {
  return { from, to, matched: 'test', terms: [] };
}

/**
 * Constructs a minimal GlossaryViewPlugin instance by bypassing the
 * constructor's call to buildDecorations (which needs CM6 DOM).
 * We access the protected/private fields via (instance as any).
 */
function makePlugin(): GlossaryViewPlugin {
  // Use Object.create so we skip the constructor entirely.
  const p = Object.create(GlossaryViewPlugin.prototype) as GlossaryViewPlugin;
  // Initialise the fields the class relies on in its methods.
  (p as any).lineCache = new Map<number, TermMatch[]>();
  (p as any).forceRebuild = false;
  (p as any).plugin = null;  // not needed for these tests
  return p;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('GlossaryViewPlugin cache logic', () => {

  describe('evictChangedLines', () => {
    it('deletes the entry whose line.from matches the changed position', () => {
      const plugin = makePlugin();
      const cache = (plugin as any).lineCache as Map<number, TermMatch[]>;

      // Populate cache with line entries at positions 0, 100, 200
      cache.set(0,   [makeMatch(0,  4)]);
      cache.set(100, [makeMatch(100, 104)]);
      cache.set(200, [makeMatch(200, 204)]);

      // Build a minimal ViewUpdate-like object for a change at doc position 105
      // lineAt(105) should return { from: 100 }
      const mockUpdate = {
        changes: {
          iterChanges(cb: (fromA: number) => void) {
            cb(105);  // change at doc pos 105 → line.from = 100
          },
        },
        startState: {
          doc: {
            lineAt: (pos: number) => ({ from: 100, to: 199, text: '' }),
          },
        },
      };

      (plugin as any).evictChangedLines(mockUpdate);

      expect(cache.has(100)).toBe(false);   // evicted
      expect(cache.has(0)).toBe(true);      // untouched
      expect(cache.has(200)).toBe(true);    // untouched
    });

    it('evicts multiple lines when multiple ranges changed', () => {
      const plugin = makePlugin();
      const cache = (plugin as any).lineCache as Map<number, TermMatch[]>;

      cache.set(0,   [makeMatch(0,  4)]);
      cache.set(100, [makeMatch(100, 104)]);
      cache.set(200, [makeMatch(200, 204)]);

      const mockUpdate = {
        changes: {
          iterChanges(cb: (fromA: number) => void) {
            cb(105);  // → line 100
            cb(205);  // → line 200
          },
        },
        startState: {
          doc: {
            lineAt: (pos: number) => {
              if (pos === 105) return { from: 100, to: 199, text: '' };
              return { from: 200, to: 299, text: '' };
            },
          },
        },
      };

      (plugin as any).evictChangedLines(mockUpdate);

      expect(cache.has(100)).toBe(false);
      expect(cache.has(200)).toBe(false);
      expect(cache.has(0)).toBe(true);
    });
  });

  describe('forceRebuild flag', () => {
    it('starts as false', () => {
      const plugin = makePlugin();
      expect((plugin as any).forceRebuild).toBe(false);
    });

    it('can be set to true from outside (public field)', () => {
      const plugin = makePlugin();
      plugin.forceRebuild = true;
      expect(plugin.forceRebuild).toBe(true);
    });
  });

  describe('cursor-only update guard', () => {
    it('does not call buildDecorations when docChanged=false and viewportChanged=false', () => {
      const plugin = makePlugin();
      // Give it a no-op decorations value
      (plugin as any).decorations = 'sentinel';

      const buildSpy = jest.spyOn(plugin as any, 'buildDecorations');

      const cursorOnlyUpdate = {
        docChanged: false,
        viewportChanged: false,
        changes: { iterChanges: () => undefined },
        startState: { doc: { lineAt: () => ({ from: 0 }) } },
      };

      plugin.update(cursorOnlyUpdate as any);

      expect(buildSpy).not.toHaveBeenCalled();
      expect((plugin as any).decorations).toBe('sentinel');  // unchanged
    });
  });
});

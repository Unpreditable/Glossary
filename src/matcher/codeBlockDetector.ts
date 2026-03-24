import { syntaxTree } from "@codemirror/language";
import type { EditorView } from "@codemirror/view";

/**
 * Code-related Lezer node names that Obsidian's markdown parser may produce.
 * Includes both standard @lezer/markdown names and Obsidian-specific variants.
 */
const CODE_NODE_NAMES = new Set([
  "InlineCode",
  "FencedCode",
  "CodeBlock",
  "Code",
  "inline_code",
  "fenced_code",
  "code_block",
]);

export function isInCodeBlock(view: EditorView, pos: number): boolean {
  const tree = syntaxTree(view.state);
  // Resolve at pos and pos+1 to handle boundary cases where pos is exactly
  // at the start of a code node (the backtick character).
  for (const resolvePos of [pos, pos + 1]) {
    let current: ReturnType<typeof tree.resolveInner> | null =
      tree.resolveInner(resolvePos);
    while (current) {
      if (CODE_NODE_NAMES.has(current.name)) {
        return true;
      }
      current = current.parent;
    }
  }
  return false;
}

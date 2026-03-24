import { syntaxTree } from "@codemirror/language";
import type { EditorView } from "@codemirror/view";

export function isInCodeBlock(view: EditorView, pos: number): boolean {
  const tree = syntaxTree(view.state);
  let current: ReturnType<typeof tree.resolveInner> | null = tree.resolveInner(pos);
  while (current) {
    if (
      current.name === "InlineCode" ||
      current.name === "FencedCode" ||
      current.name === "CodeBlock"
    ) {
      return true;
    }
    current = current.parent;
  }
  return false;
}

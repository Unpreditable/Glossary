import { StateField } from '@codemirror/state';

export class App {}
export class TFile {
  path: string = '';
}

/** Obsidian's per-editor file info; tests set it with `editorInfoField.init(() => ({ file }))`. */
export const editorInfoField = StateField.define<{ file: TFile | null }>({
  create: () => ({ file: null }),
  update: (value) => value,
});

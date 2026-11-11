import { defineConfig } from "eslint/config";
import tsparser from "@typescript-eslint/parser";
import * as espree from "espree";
import obsidianmd from "eslint-plugin-obsidianmd";
import globals from "globals";

// Obsidian's review bot runs obsidianmd's recommended rules on every TypeScript file in the repo
// and checks manifest.json. Keep this config the same: no rules switched off or relaxed, and no
// eslint-disable comments in the code. If a rule seems wrong, change the code.

// validate-manifest walks a JavaScript AST (an object expression statement), which no JSON
// parser produces; parsing the manifest as `(<json>)` gives it one.
const manifestParser = {
  parse: (code) => espree.parse(`(${code})`, { ecmaVersion: "latest", range: true, loc: true, tokens: true, comment: true }),
};

// The e2e harness's globals, as declared in e2e/harness.d.ts.
const harnessGlobals = Object.fromEntries([
  "$", "$$", "expect", "browser", "obsidianPage", "resetState", "restartObsidian", "togglePlugin", "setPluginSettings",
  "openEmptyNote", "noteText", "line", "type", "press", "menu", "suggesters", "consoleErrors", "allowConsoleErrors",
].map((name) => [name, "readonly"]));

export default defineConfig([
  // Build tool configs aren't plugin code.
  { ignores: ["main.js", "*.config.js", "*.config.mjs", "node_modules/", "reference/", ".planning/", "e2e/.output/"] },
  // The preset's first block has no `files`, so its JS rules would also run on manifest.json;
  // scope it to TypeScript (the only code here). Every rule stays as the preset sets it.
  ...[...obsidianmd.configs.recommended].map((c) => (c.files ? c : { ...c, files: ["**/*.ts"] })),
  {
    files: ["**/*.ts"],
    languageOptions: {
      parser: tsparser,
      parserOptions: { project: ["./tsconfig.json", "./e2e/tsconfig.json"] },
      globals: { ...globals.browser },
    },
    rules: {
      // The review turns these on (as warnings) though the preset leaves them off; see
      // buildScannerEslintConfig in obsidianmd/obsidian-workflows, src/lint.ts.
      "@typescript-eslint/no-unsafe-member-access": "error",
      "@typescript-eslint/no-unsafe-assignment": "error",
      "@typescript-eslint/no-unsafe-argument": "error",
      "@typescript-eslint/no-unsafe-call": "error",
      "@typescript-eslint/no-unsafe-return": "error",
      // Stricter than the preset: obsidianmd/regex-lookbehind should catch these but its own
      // pattern only matches the literal text "(?<!)". iOS before 16.4 can't parse a lookbehind,
      // and a regex literal is parsed when the module loads, so the plugin wouldn't load there.
      "no-restricted-syntax": ["error",
        { selector: "Literal[regex.pattern=/\\(\\?<[=!]/]", message: "No regex lookbehinds: iOS before 16.4 can't parse them." },
        { selector: "NewExpression[callee.name='RegExp'] > Literal[value=/\\(\\?<[=!]/]", message: "No regex lookbehinds: iOS before 16.4 can't parse them." },
      ],
    },
  },
  { files: ["tests/**/*.ts"], languageOptions: { globals: { ...globals.jest } } },
  { files: ["e2e/**/*.ts"], languageOptions: { globals: { ...globals.mocha, ...harnessGlobals } } },
  {
    files: ["manifest.json"],
    plugins: { obsidianmd },
    languageOptions: { parser: manifestParser },
    rules: { "obsidianmd/validate-manifest": "error" },
  },
]);

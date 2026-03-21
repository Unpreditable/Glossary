import { defineConfig } from "eslint/config";
import tsparser from "@typescript-eslint/parser";
import obsidianmd from "eslint-plugin-obsidianmd";
import globals from "globals";

export default defineConfig([
  ...obsidianmd.configs.recommended,
  {
    files: ["**/*.ts"],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        project: "./tsconfig.json",
      },
      globals: {
        ...globals.browser,
      },
    },
    rules: {
      "obsidianmd/ui/sentence-case": "off",
      "no-console": ["error", { allow: ["log", "warn", "error", "debug"] }],
    },
  },
  {
    ignores: ["main.js", "node_modules/"],
  },
]);

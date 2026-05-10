import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import prettierConfig from "eslint-config-prettier";
import js from "@eslint/js";

export default [
  {
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      "tests/fixtures/**",
      // codeWizualizer prototype files (legacy, untyped, kept for reference)
      "app.jsx",
      "data.js",
      "graph.jsx",
      "picker.jsx",
      "tweaks-panel.jsx",
      "views.jsx",
    ],
  },
  js.configs.recommended,
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parser: tsParser,
      parserOptions: { ecmaVersion: 2022, sourceType: "module" },
    },
    plugins: { "@typescript-eslint": tsPlugin },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    },
  },
  prettierConfig,
];

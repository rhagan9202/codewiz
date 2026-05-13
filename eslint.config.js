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
  // Node.js files
  {
    files: [
      "packages/cli/**/*.ts",
      "packages/server/**/*.ts",
      "packages/core/**/*.ts",
      "packages/adapters/**/*.ts",
      "tests/**/*.ts",
      "eslint.config.js",
    ],
    languageOptions: {
      parser: tsParser,
      parserOptions: { ecmaVersion: 2022, sourceType: "module" },
      globals: {
        process: "readonly",
        console: "readonly",
        Buffer: "readonly",
        URL: "readonly",
        Request: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        setTimeout: "readonly",
      },
    },
    plugins: { "@typescript-eslint": tsPlugin },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    },
  },
  // Browser files
  {
    files: ["packages/web/**/*.ts", "packages/web/**/*.tsx"],
    languageOptions: {
      parser: tsParser,
      parserOptions: { ecmaVersion: 2022, sourceType: "module" },
      globals: {
        window: "readonly",
        document: "readonly",
        fetch: "readonly",
        EventSource: "readonly",
        MessageEvent: "readonly",
        KeyboardEvent: "readonly",
        HTMLElement: "readonly",
        HTMLDivElement: "readonly",
        ResizeObserver: "readonly",
      },
    },
    plugins: { "@typescript-eslint": tsPlugin },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    },
  },
  // SDK files (can have both Node.js and browser code)
  {
    files: ["packages/sdk/**/*.ts"],
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

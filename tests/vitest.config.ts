import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Exclude Playwright spec files — those run via `pnpm test:e2e`
    exclude: ["**/*.spec.ts", "**/node_modules/**"],
  },
});

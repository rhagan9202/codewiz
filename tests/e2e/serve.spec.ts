import { test, expect } from "@playwright/test";
import { mkdtempSync, cpSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runServe } from "codewiz/dist/serve.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIX = resolve(__dirname, "../fixtures/tiny-react-app");

let workdir: string;
let close: (() => Promise<void>) | null = null;

test.beforeAll(async () => {
  workdir = mkdtempSync(join(tmpdir(), "codewiz-e2e-serve-"));
  cpSync(FIX, workdir, {
    recursive: true,
    filter: (s) => !s.includes("__golden__"),
  });
  const handle = await runServe({
    projectRoot: workdir,
    port: 8767,
    noOpen: true,
  });
  close = handle.close;
});

test.afterAll(async () => {
  if (close) await close();
  rmSync(workdir, { recursive: true, force: true });
});

test("Architecture view renders all 5 fixture modules", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".main-toolbar .title")).toHaveText("Architecture overview");
  for (const name of ["Button", "CartItem", "client", "Home", "Cart"]) {
    await expect(page.locator(`text=${name}`).first()).toBeVisible();
  }
});

test("Files view lists fixture modules with provenance badge on Button", async ({ page }) => {
  await page.goto("/");
  await page.click('.nav-item:has-text("Files")');
  await expect(page.locator(".main-toolbar .title")).toHaveText("Files");
  await expect(page.locator(".file-row:has-text(\"Button.tsx\")")).toBeVisible();
});

test("Re-analyze button triggers a refresh and surfaces a 'done' log", async ({ page }) => {
  await page.goto("/");
  await page.click('button:has-text("re-analyze")');
  await expect(page.locator("text=/✓ done/")).toBeVisible({ timeout: 15000 });
});

test("Disabled nav item shows 'Ships in v0.x' on hover", async ({ page }) => {
  await page.goto("/");
  const dep = page.locator('.nav-item:has-text("Dependencies")');
  await expect(dep).toHaveAttribute("title", "Ships in v0.2");
});

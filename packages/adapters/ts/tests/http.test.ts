import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createProject } from "../src/project.js";
import { extractHttpEndpoints } from "../src/http.js";

let dir: string;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "codewiz-http-")); });
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe("extractHttpEndpoints", () => {
  it("detects axios-style client posts", () => {
    writeFileSync(join(dir, "client.ts"), `
      import axios from "axios";
      export const postCart = (b: any) => axios.post("/cart/items", b);
    `);
    const proj = createProject(dir, ["client.ts"]);
    const endpoints = extractHttpEndpoints(proj, dir);
    expect(endpoints).toEqual([{
      side: "client",
      verb: "POST",
      pathTemplate: "/cart/items",
      module: "ts:client.ts",
      citation: { path: "client.ts", line: 3 },
    }]);
  });

  it("detects fetch() calls with method option", () => {
    writeFileSync(join(dir, "client.ts"), `
      export const get = () => fetch("/users", { method: "GET" });
    `);
    const proj = createProject(dir, ["client.ts"]);
    const endpoints = extractHttpEndpoints(proj, dir);
    expect(endpoints[0]).toMatchObject({
      side: "client", verb: "GET", pathTemplate: "/users",
    });
  });

  it("ignores non-string-literal paths (no false positives)", () => {
    writeFileSync(join(dir, "client.ts"), `
      const url = "/x";
      fetch(url);
    `);
    const proj = createProject(dir, ["client.ts"]);
    expect(extractHttpEndpoints(proj, dir)).toEqual([]);
  });
});

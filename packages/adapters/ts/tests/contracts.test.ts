import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createProject } from "../src/project.js";
import { extractContracts } from "../src/contracts.js";

let dir: string;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "codewiz-contracts-")); });
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe("extractContracts", () => {
  it("extracts an interface with field types and required flags", () => {
    writeFileSync(join(dir, "User.ts"), `
      export interface User {
        id: string;
        name?: string;
      }
    `);
    const proj = createProject(dir, ["User.ts"]);
    const contracts = extractContracts(proj, dir);
    expect(contracts.length).toBe(1);
    expect(contracts[0]).toMatchObject({
      id: "ts:User.ts::User",
      name: "User",
      language: "ts",
      fields: [
        { name: "id", type: "string", required: true },
        { name: "name", type: "string", required: false },
      ],
      producers: ["ts:User.ts"],
      consumers: [],
      issues: [],
    });
  });

  it("extracts a type alias literal as a contract", () => {
    writeFileSync(join(dir, "T.ts"), `
      export type Money = { amount: number; currency: "USD" | "EUR" };
    `);
    const proj = createProject(dir, ["T.ts"]);
    const contracts = extractContracts(proj, dir);
    expect(contracts[0].name).toBe("Money");
    expect(contracts[0].fields.map(f => f.name)).toEqual(["amount", "currency"]);
  });
});

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runReanalyze } from "../src/analyzer.js";
import { EventBus } from "../src/events.js";

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "codewiz-reanalyze-"));
  mkdirSync(join(dir, "src"));
  writeFileSync(join(dir, "src/a.ts"), "export const A = 1;");
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe("runReanalyze", () => {
  it("emits start and done events around runAnalysis", async () => {
    const bus = new EventBus();
    const events: { type: string; payload?: unknown }[] = [];
    bus.subscribe((e) => events.push(e));
    await runReanalyze({ projectRoot: dir, bus });
    expect(events[0].type).toBe("start");
    expect(events[events.length - 1].type).toBe("done");
    const done = events[events.length - 1] as { type: "done"; payload: { contentHash: string } };
    expect(done.payload.contentHash).toHaveLength(64);
  });

  it("emits an error event when analysis fails", async () => {
    rmSync(join(dir, "src"), { recursive: true });
    writeFileSync(join(dir, ".codewiz.yml"), "bad: [\nyaml");
    const bus = new EventBus();
    const events: { type: string; payload?: unknown }[] = [];
    bus.subscribe((e) => events.push(e));
    await expect(runReanalyze({ projectRoot: dir, bus })).rejects.toThrow();
    expect(events.some((e) => e.type === "error")).toBe(true);
  });
});

describe("EventBus", () => {
  it("delivers events to all subscribers and stops after unsubscribe", () => {
    const bus = new EventBus();
    const a: string[] = [];
    const b: string[] = [];
    const unsubA = bus.subscribe((e) => a.push(e.type));
    bus.subscribe((e) => b.push(e.type));
    bus.publish({ type: "ping" });
    unsubA();
    bus.publish({ type: "pong" });
    expect(a).toEqual(["ping"]);
    expect(b).toEqual(["ping", "pong"]);
  });
});

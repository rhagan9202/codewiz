import { runAnalysis, AdapterRegistry } from "@codewiz/core";
import { createTsAdapter } from "@codewiz/adapter-ts";
import type { EventBus } from "./events.js";

export interface ReanalyzeOptions {
  projectRoot: string;
  bus: EventBus;
}

export async function runReanalyze(opts: ReanalyzeOptions): Promise<void> {
  const { projectRoot, bus } = opts;
  bus.publish({ type: "start" });
  try {
    const reg = new AdapterRegistry();
    reg.register("ts", createTsAdapter);
    const manifest = await runAnalysis({
      projectRoot,
      adapters: ["ts"],
      registry: reg,
    });
    bus.publish({
      type: "done",
      payload: { contentHash: manifest.contentHash },
    });
  } catch (e) {
    const message = (e as Error).message;
    bus.publish({ type: "error", payload: { message } });
    throw e;
  }
}

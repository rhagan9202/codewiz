import { Hono } from "hono";
import { runReanalyze } from "../analyzer.js";
import type { EventBus } from "../events.js";

export function reanalyzeRoutes(projectRoot: string, bus: EventBus): Hono {
  const r = new Hono();
  r.post("/api/reanalyze", (c) => {
    // Fire and forget — events flow through the bus, errors are caught.
    runReanalyze({ projectRoot, bus }).catch(() => {
      // EventBus already received an error event; nothing more to do here.
    });
    return c.json({ queued: true }, 202);
  });
  return r;
}

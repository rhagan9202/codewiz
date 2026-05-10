import { Hono } from "hono";
import { stream } from "hono/streaming";
import type { EventBus, ServerEvent } from "../events.js";

export function eventsRoutes(bus: EventBus): Hono {
  const r = new Hono();
  r.get("/api/events", (c) => {
    c.header("Content-Type", "text/event-stream");
    c.header("Cache-Control", "no-cache");
    c.header("Connection", "keep-alive");
    return stream(c, async (s) => {
      const queue: ServerEvent[] = [];
      let wake: (() => void) | null = null;
      const wakeNow = () => { const w = wake; wake = null; w?.(); };
      const unsubscribe = bus.subscribe((event) => {
        queue.push(event);
        wakeNow();
      });
      s.onAbort(() => { wakeNow(); });
      const heartbeat = setInterval(() => { void s.write(": ping\n\n"); }, 15000);
      try {
        while (!s.aborted) {
          if (queue.length === 0) {
            await new Promise<void>((r) => { wake = r; });
            if (s.aborted) break;
          }
          const event = queue.shift();
          if (!event) continue;
          await s.write(`event: ${event.type}\n`);
          await s.write(`data: ${JSON.stringify("payload" in event ? event.payload : {})}\n\n`);
        }
      } finally {
        clearInterval(heartbeat);
        unsubscribe();
      }
    });
  });
  return r;
}

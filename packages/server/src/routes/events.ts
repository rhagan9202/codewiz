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
      let resolve: (() => void) | null = null;
      const unsubscribe = bus.subscribe((event) => {
        queue.push(event);
        if (resolve) { const r = resolve; resolve = null; r(); }
      });
      try {
        // Heartbeat so proxies don't close the stream.
        const heartbeat = setInterval(() => {
          void s.write(": ping\n\n");
        }, 15000);
        try {
          while (!s.aborted) {
            if (queue.length === 0) {
              await new Promise<void>((r) => { resolve = r; });
            }
            const event = queue.shift();
            if (event) {
              await s.write(`event: ${event.type}\n`);
              await s.write(`data: ${JSON.stringify("payload" in event ? event.payload : {})}\n\n`);
            }
          }
        } finally {
          clearInterval(heartbeat);
        }
      } finally {
        unsubscribe();
      }
    });
  });
  return r;
}

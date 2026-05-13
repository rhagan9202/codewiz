import { Hono } from "hono";
import { serve as nodeServe } from "@hono/node-server";
import { projectRoutes } from "./routes/project.js";
import { reanalyzeRoutes } from "./routes/reanalyze.js";
import { eventsRoutes } from "./routes/events.js";
import { staticRoutes } from "./static.js";
import { EventBus } from "./events.js";

export interface ServerOptions {
  projectRoot: string;
  webDist: string | null;
}

export function createServer(opts: ServerOptions): Hono {
  const app = new Hono();
  const bus = new EventBus();
  app.route("/", projectRoutes(opts.projectRoot));
  app.route("/", reanalyzeRoutes(opts.projectRoot, bus));
  app.route("/", eventsRoutes(bus));
  if (opts.webDist) {
    app.route("/", staticRoutes(opts.webDist));
  }
  return app;
}

export { EventBus } from "./events.js";
export type { ServerEvent } from "./events.js";

export interface ListenOptions extends ServerOptions {
  port: number;
  hostname?: string;   // defaults to 127.0.0.1
}

export function listen(opts: ListenOptions): { port: number; close: () => Promise<void> } {
  const app = createServer(opts);
  const server = nodeServe({
    fetch: app.fetch,
    hostname: opts.hostname ?? "127.0.0.1",
    port: opts.port,
  });
  return {
    port: opts.port,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

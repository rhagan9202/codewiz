import { Hono } from "hono";
import { projectRoutes } from "./routes/project.js";
import { reanalyzeRoutes } from "./routes/reanalyze.js";
import { eventsRoutes } from "./routes/events.js";
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
  return app;
}

export { EventBus } from "./events.js";
export type { ServerEvent } from "./events.js";

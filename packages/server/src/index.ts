import { Hono } from "hono";
import { projectRoutes } from "./routes/project.js";

export interface ServerOptions {
  projectRoot: string;
  webDist: string | null;     // path to built web bundle, or null for API-only
}

export function createServer(opts: ServerOptions): Hono {
  const app = new Hono();
  app.route("/", projectRoutes(opts.projectRoot));
  return app;
}

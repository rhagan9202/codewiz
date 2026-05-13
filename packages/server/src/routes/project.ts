import { Hono } from "hono";
import { readProject } from "../load.js";

export function projectRoutes(projectRoot: string): Hono {
  const r = new Hono();
  r.get("/api/project", async (c) => {
    try {
      const project = await readProject(projectRoot);
      return c.json(project);
    } catch (e) {
      return c.json({ error: (e as Error).message }, 500);
    }
  });
  return r;
}

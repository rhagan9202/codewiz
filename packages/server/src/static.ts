import { Hono } from "hono";
import { readFile, stat } from "node:fs/promises";
import { resolve, join, extname } from "node:path";

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js":   "application/javascript; charset=utf-8",
  ".mjs":  "application/javascript; charset=utf-8",
  ".css":  "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg":  "image/svg+xml",
  ".png":  "image/png",
  ".jpg":  "image/jpeg",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".map":  "application/json; charset=utf-8",
};

async function tryRead(p: string): Promise<{ body: Buffer; mime: string } | null> {
  try {
    const s = await stat(p);
    if (!s.isFile()) return null;
    const body = await readFile(p);
    const mime = MIME[extname(p).toLowerCase()] ?? "application/octet-stream";
    return { body, mime };
  } catch {
    return null;
  }
}

export function staticRoutes(webDist: string): Hono {
  const r = new Hono();
  const root = resolve(webDist);
  r.get("*", async (c) => {
    const url = new URL(c.req.url);
    if (url.pathname.startsWith("/api/")) return c.notFound();
    const rel = url.pathname === "/" ? "index.html" : url.pathname.slice(1);
    const target = resolve(join(root, rel));
    // Containment check: target must equal root or be a descendant of root.
    if (target !== root && !target.startsWith(root + "/")) {
      return c.notFound();
    }
    const direct = await tryRead(target);
    if (direct) {
      c.header("Content-Type", direct.mime);
      return c.body(direct.body);
    }
    // SPA fallback — always served from index.html (already inside root).
    const fallback = await tryRead(join(root, "index.html"));
    if (fallback) {
      c.header("Content-Type", fallback.mime);
      return c.body(fallback.body);
    }
    return c.notFound();
  });
  return r;
}

import { ProjectSchema, type Project } from "@codewiz/sdk";

export async function fetchProject(): Promise<Project> {
  const res = await fetch("/api/project");
  if (!res.ok) throw new Error(`fetch /api/project failed: ${res.status}`);
  const raw = await res.json();
  return ProjectSchema.parse(raw);
}

export async function postReanalyze(): Promise<void> {
  const res = await fetch("/api/reanalyze", { method: "POST" });
  if (!res.ok) throw new Error(`POST /api/reanalyze failed: ${res.status}`);
}

export type ServerEvent =
  | { type: "start"; payload: Record<string, never> }
  | { type: "log"; payload: { level: "info" | "warn" | "error"; message: string } }
  | { type: "done"; payload: { contentHash: string } }
  | { type: "error"; payload: { message: string } };

export function openEvents(onEvent: (e: ServerEvent) => void): () => void {
  const es = new EventSource("/api/events");
  const handler = (type: ServerEvent["type"]) => (ev: MessageEvent) => {
    try {
      const payload = JSON.parse(ev.data);
      onEvent({ type, payload } as ServerEvent);
    } catch {
      // ignore malformed events
    }
  };
  es.addEventListener("start", handler("start"));
  es.addEventListener("log", handler("log"));
  es.addEventListener("done", handler("done"));
  es.addEventListener("error", handler("error"));
  return () => es.close();
}

export type ServerEvent =
  | { type: "start" }
  | { type: "log"; payload: { level: "info" | "warn" | "error"; message: string } }
  | { type: "done"; payload: { contentHash: string } }
  | { type: "error"; payload: { message: string } }
  | { type: "ping" } | { type: "pong" };

type Listener = (event: ServerEvent) => void;

export class EventBus {
  private listeners = new Set<Listener>();

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => { this.listeners.delete(fn); };
  }

  publish(event: ServerEvent): void {
    for (const l of this.listeners) l(event);
  }
}

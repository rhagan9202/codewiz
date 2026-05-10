import type { Edge, HttpEndpoint } from "@codewiz/sdk";

function normalize(p: string): string {
  // Treat :id, {id}, <id> as the same wildcard token.
  return p.replace(/[:{<]([a-zA-Z_][a-zA-Z0-9_]*)[}>]?/g, ":_");
}

export function resolveBridges(endpoints: HttpEndpoint[]): Edge[] {
  const clients = endpoints.filter((e) => e.side === "client");
  const servers = endpoints.filter((e) => e.side === "server");

  // Group servers by (verb, normalized-path)
  const serverIdx = new Map<string, HttpEndpoint[]>();
  for (const s of servers) {
    const k = `${s.verb} ${normalize(s.pathTemplate)}`;
    const list = serverIdx.get(k) ?? [];
    list.push(s);
    serverIdx.set(k, list);
  }

  const edges: Edge[] = [];
  for (const c of clients) {
    const k = `${c.verb} ${normalize(c.pathTemplate)}`;
    const matches = serverIdx.get(k) ?? [];
    if (matches.length === 0) continue;
    const confidence = matches.length === 1 ? 1 : 1 / (matches.length + 1);
    for (const s of matches) {
      edges.push({
        source: c.module,
        target: s.module,
        kind: "http",
        provenance: { source: "bridge", confidence },
        evidence: [c.citation, s.citation],
      });
    }
  }
  return edges;
}

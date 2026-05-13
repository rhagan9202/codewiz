import {
  createContext, useContext, useEffect, useState, type ReactNode,
  useCallback,
} from "react";
import type { Project } from "@codewiz/sdk";
import { fetchProject } from "./api.js";

type Status = "loading" | "ready" | "error";

interface ProjectContextValue {
  status: Status;
  project: Project | null;
  error: string | null;
  refetch: () => Promise<void>;
}

const Ctx = createContext<ProjectContextValue | null>(null);

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [project, setProject] = useState<Project | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setStatus("loading");
    setError(null);
    try {
      const p = await fetchProject();
      setProject(p);
      setStatus("ready");
    } catch (e) {
      setError((e as Error).message);
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return <Ctx.Provider value={{ status, project, error, refetch }}>{children}</Ctx.Provider>;
}

export function useProject(): ProjectContextValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useProject must be used inside <ProjectProvider>");
  return ctx;
}

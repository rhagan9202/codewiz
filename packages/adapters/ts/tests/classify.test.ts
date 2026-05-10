import { describe, it, expect } from "vitest";
import { classifyKind, classifyLayer } from "../src/classify.js";

describe("classifyKind", () => {
  const cases: [string, string][] = [
    ["web/src/pages/Home.tsx", "page"],
    ["web/src/components/Button.tsx", "component"],
    ["web/src/hooks/useAuth.ts", "hook"],
    ["web/src/store/authStore.ts", "store"],
    ["web/src/api/client.ts", "client"],
    ["api/src/routes/auth.ts", "route"],
    ["api/src/services/AuthService.ts", "service"],
    ["api/src/middleware/auth.ts", "middleware"],
    ["api/src/models/User.ts", "model"],
    ["random/file.ts", "component"],  // default
  ];
  for (const [p, k] of cases) {
    it(`classifies ${p} as ${k}`, () => {
      expect(classifyKind(p)).toBe(k);
    });
  }
});

describe("classifyLayer", () => {
  const cases: [string, string][] = [
    ["web/src/pages/Home.tsx", "ui"],
    ["web/src/components/X.tsx", "ui"],
    ["web/src/hooks/useX.ts", "state"],
    ["web/src/store/y.ts", "state"],
    ["web/src/api/client.ts", "api"],
    ["api/src/routes/x.ts", "api"],
    ["api/src/services/X.ts", "service"],
    ["api/src/middleware/x.ts", "service"],
    ["api/src/models/X.ts", "data"],
    ["api/src/data/db.ts", "data"],
    ["random/file.ts", "service"],   // default
  ];
  for (const [p, l] of cases) {
    it(`classifies ${p} as layer=${l}`, () => {
      expect(classifyLayer(p)).toBe(l);
    });
  }
});

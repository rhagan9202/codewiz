import { describe, it, expect } from "vitest";

describe("workspace smoke test", () => {
  it("vitest workspace boots", () => {
    expect(1 + 1).toBe(2);
  });
});

import { describe, expect, it } from "vitest";

import {
  reconcileTools,
  isToolDataKey,
  type BatchResult,
  type ToolDTO,
} from "./tools";

const tool = (over: Partial<ToolDTO>): ToolDTO => ({
  toolId: "t",
  name: "T",
  code: "HND-001",
  categoryId: "c",
  totalQuantity: 10,
  icon: null,
  version: 1,
  free: 10,
  assignments: [],
  ...over,
});

describe("tool cache scope", () => {
  it.each([
    "/api/tools",
    "/api/tools?q=drill",
    "/api/tools/t/movements",
    "/api/sites/s/tools",
    "/api/sites/s/tools/movements?offset=50",
  ])("refreshes %s", (key) => expect(isToolDataKey(key)).toBe(true));
  it.each([
    "/api/toolsmith",
    "/api/sites/s/stages",
    "/api/sites/s",
    null,
    ["/api/tools"],
  ])("leaves unrelated keys alone: %s", (key) =>
    expect(isToolDataKey(key)).toBe(false),
  );
});

describe("reconcileTools", () => {
  it("replaces conflicted/invalid tools with fresh server state, leaves others", () => {
    const current = [
      tool({ toolId: "a", version: 1 }),
      tool({ toolId: "b", version: 1 }),
    ];
    const results: BatchResult[] = [
      {
        toolId: "a",
        status: "conflict",
        tool: tool({ toolId: "a", version: 5, totalQuantity: 20 }),
      },
    ];
    const next = reconcileTools(current, results);
    expect(next[0].version).toBe(5);
    expect(next[0].totalQuantity).toBe(20);
    expect(next[1].version).toBe(1); // untouched
  });
});

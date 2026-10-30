import { describe, expect, it } from "vitest";
import { isLiveToolPath } from "./toolRequests";

describe("live tool requests", () => {
  it.each([
    "/api/tools",
    "/api/tools/dashboard",
    "/api/sites/a/tools",
    "/api/sites/a/tools/receive-options",
    "/api/sites/a/tools/movements",
    "/app/tools",
    "/app/sites/a/tools",
  ])("bypasses persistent caches for %s", (path) => {
    expect(isLiveToolPath(path)).toBe(true);
  });
  it.each([
    "/api/toolsmith",
    "/api/sites/a",
    "/api/sites/a/toolsmith",
    "/api/entries",
    "/app/sites/a/stages",
  ])("preserves other caching for %s", (path) => {
    expect(isLiveToolPath(path)).toBe(false);
  });
});

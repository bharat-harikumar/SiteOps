import { describe, expect, it } from "vitest";

import { countActiveFilters } from "./filterCount";

describe("countActiveFilters", () => {
  it("is 0 for the defaults", () => {
    expect(countActiveFilters({ from: "", to: "", workStage: "", sort: "newest" })).toBe(0);
  });

  it("counts each applied filter, and a non-default sort", () => {
    expect(countActiveFilters({ from: "2026-11-01", to: "2026-11-19", workStage: "Roof", sort: "oldest" })).toBe(4);
  });

  it("adds extra filters a page owns (e.g. a narrowed type set)", () => {
    expect(countActiveFilters({ from: "", to: "", sort: "newest" }, 1)).toBe(1);
  });
});

import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db/client", () => ({ db: {} }));

import { getLabourProgress } from "./labourTargets";

const executorReturning = (rows: unknown) => ({ execute: vi.fn().mockResolvedValue(rows) });

describe("getLabourProgress", () => {
  it("maps driver strings to numbers and keeps a missing target as null", async () => {
    const exec = executorReturning([{ masons: "13", helpers: "7", mason_target: 60, helper_target: null }]);
    await expect(getLabourProgress("s1", "Plastering", exec)).resolves.toEqual({
      masons: 13, helpers: 7, masonTarget: 60, helperTarget: null,
    });
    expect(exec.execute).toHaveBeenCalledTimes(1);
  });

  it("reads rows wrapped in { rows } and falls back to zeros when nothing comes back", async () => {
    await expect(getLabourProgress("s1", "Plastering", executorReturning({ rows: [] }))).resolves.toEqual({
      masons: 0, helpers: 0, masonTarget: null, helperTarget: null,
    });
  });
});

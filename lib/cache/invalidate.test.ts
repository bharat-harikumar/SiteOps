import { beforeEach, describe, expect, it, vi } from "vitest";

const { del } = vi.hoisted(() => ({ del: vi.fn() }));

vi.mock("@/lib/cache/redis", () => ({ redis: { del } }));

import { CATALOG_OPERATIONS } from "@/lib/catalog/overview";

import { invalidateCatalogOverviewCache } from "./invalidate";
import { catalogListNamesCacheKey, catalogOverviewCacheKey } from "./keys";

describe("invalidateCatalogOverviewCache", () => {
  beforeEach(() => {
    del.mockReset();
    del.mockResolvedValue(1);
  });

  it("also clears the cached active-name list of every managed catalog list", async () => {
    // Entry validation and the stage summary read those names with a 10-minute TTL.
    // If a rename/add/deactivate leaves them cached, the old name stays valid for
    // new entries and the new name is rejected until the TTL runs out.
    await invalidateCatalogOverviewCache("req");

    const cleared = del.mock.calls.flat();
    expect(cleared).toContain(catalogOverviewCacheKey());
    for (const op of CATALOG_OPERATIONS) {
      for (const list of op.lists) {
        expect(cleared).toContain(catalogListNamesCacheKey(list.categoryName));
      }
    }
    expect(cleared).toContain("catalog:list:work stage:active");
  });
});

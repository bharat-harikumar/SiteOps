import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DELETE, PATCH } from "./route";

const {
  mockRequireCapability, mockSelect, mockDelete, mockInvalidateOverview, mockRunNonCritical, mockCountUsage,
  mockTransaction, mockUpdate, mockLock, mockRewrite,
} = vi.hoisted(() => ({
  mockCountUsage: vi.fn(),
  mockTransaction: vi.fn(),
  mockUpdate: vi.fn(),
  mockLock: vi.fn(),
  mockRewrite: vi.fn(),
  mockInvalidateOverview: vi.fn().mockResolvedValue(undefined),
  mockRunNonCritical: vi.fn(),
  mockRequireCapability: vi.fn(),
  mockSelect: vi.fn(),
  mockDelete: vi.fn(),
}));

vi.mock("@/lib/auth/guards", () => ({
  requireCapability: mockRequireCapability,
}));

// The guard asks the shared live-usage counter (soft-deleted sites excluded);
// its cross-table aggregation is covered by countCatalogUsage's own DB test.
vi.mock("@/lib/catalog/overviewQuery", () => ({
  countCatalogUsage: mockCountUsage,
}));

vi.mock("@/lib/db/client", () => ({
  db: { select: mockSelect, delete: mockDelete, transaction: mockTransaction },
}));

vi.mock("@/lib/catalog/rewriteEntryNames", () => ({
  lockCategoryItems: mockLock,
  rewriteEntryNames: mockRewrite,
}));

vi.mock("@/lib/cache/invalidate", () => ({
  invalidateCategoryTreeCache: vi.fn().mockResolvedValue(undefined),
  invalidateCatalogOverviewCache: mockInvalidateOverview,
}));

vi.mock("@/lib/services/nonCritical", () => ({
  runNonCritical: mockRunNonCritical,
}));

vi.mock("@/lib/utils/requestId", () => ({
  generateRequestId: () => "req_test",
}));

// Sequences the chained db.select() reads in DELETE order:
// 1. subcategory row, 2. category name row. Usage comes from countCatalogUsage.
function mockReads(subRows: unknown[], catRows: unknown[], usage = 0) {
  mockSelect
    .mockReturnValueOnce({ from: () => ({ where: () => ({ limit: () => Promise.resolve(subRows) }) }) })
    .mockReturnValueOnce({ from: () => ({ where: () => ({ limit: () => Promise.resolve(catRows) }) }) });
  mockCountUsage.mockResolvedValue(usage);
}

function deleteReq() {
  return new NextRequest("http://localhost/api/forms/subcategories/s1", { method: "DELETE" });
}
const ctx = { params: Promise.resolve({ id: "s1" }) };

describe("DELETE subcategory usage guard", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockRequireCapability.mockResolvedValue({ session: { user: { id: "u1" } } });
    mockDelete.mockReturnValue({ where: () => Promise.resolve(undefined) });
  });

  it("blocks delete with 409 when the item is still in use", async () => {
    mockReads(
      [{ categoryId: "c1", name: "Cement" }],
      [{ name: "Materials" }],
      3,
    );

    const res = await DELETE(deleteReq(), ctx);
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error.message).toMatch(/deactivate/i);
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it("deletes when usage count is zero", async () => {
    mockReads(
      [{ categoryId: "c1", name: "Cement" }],
      [{ name: "Materials" }],
      0,
    );

    const res = await DELETE(deleteReq(), ctx);
    expect(res.status).toBe(200);
    expect(mockDelete).toHaveBeenCalled();
  });

  it("deletes a subcategory whose category is not usage-tracked", async () => {
    mockReads([{ categoryId: "c1", name: "Whatever" }], [{ name: "Unmanaged" }]);

    const res = await DELETE(deleteReq(), ctx);
    expect(res.status).toBe(200);
    expect(mockDelete).toHaveBeenCalled();
  });

  it("returns 404 when the subcategory is missing", async () => {
    mockReads([], []);
    const res = await DELETE(deleteReq(), ctx);
    expect(res.status).toBe(404);
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it("counts usage by category name and item name through the shared live counter", async () => {
    mockReads([{ categoryId: "c1", name: "Basement Level" }], [{ name: "Work Stage" }], 0);

    await DELETE(deleteReq(), ctx);

    expect(mockCountUsage).toHaveBeenCalledWith(expect.anything(), "Work Stage", "Basement Level");
  });

  it("invalidates the catalog overview cache on a successful delete", async () => {
    mockInvalidateOverview.mockResolvedValue(undefined);
    mockReads([{ categoryId: "c1", name: "Cement" }], [{ name: "Materials" }], 0);

    const res = await DELETE(deleteReq(), ctx);
    expect(res.status).toBe(200);
    expect(mockRunNonCritical).toHaveBeenCalledWith(
      expect.any(String),
      "catalog_overview_cache_invalidation_failed",
      expect.anything(),
    );
    expect(mockInvalidateOverview).toHaveBeenCalledWith("req_test");
  });

  it("does NOT invalidate the catalog overview cache when the delete is blocked", async () => {
    mockReads([{ categoryId: "c1", name: "Cement" }], [{ name: "Materials" }], 3);

    const res = await DELETE(deleteReq(), ctx);
    expect(res.status).toBe(409);
    expect(mockInvalidateOverview).not.toHaveBeenCalled();
  });
});

function patchReq(body: unknown) {
  return new NextRequest("http://localhost/api/forms/subcategories/s1", {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

describe("PATCH subcategory (rename / activate)", () => {
  const tx = { update: mockUpdate };
  // 1st select: the row (for its category). 2nd: the category's name.
  function mockPatchReads(categoryName = "Work Stage") {
    mockSelect
      .mockReturnValueOnce({ from: () => ({ where: () => ({ limit: () => Promise.resolve([{ categoryId: "c1" }]) }) }) })
      .mockReturnValueOnce({ from: () => ({ where: () => ({ limit: () => Promise.resolve([{ name: categoryName }]) }) }) });
  }
  const items = [
    { subcategoryId: "s1", name: "Lintel Level", isActive: true },
    { subcategoryId: "s2", name: "Ground roof level", isActive: true },
  ];

  beforeEach(() => {
    vi.resetAllMocks();
    mockRequireCapability.mockResolvedValue({ session: { user: { id: "u1" } } });
    mockTransaction.mockImplementation(async (cb: (t: unknown) => unknown) => cb(tx));
    mockLock.mockResolvedValue(items);
    mockRewrite.mockResolvedValue(3);
    mockUpdate.mockReturnValue({
      set: (v: Record<string, unknown>) => ({
        where: () => ({ returning: () => Promise.resolve([{ subcategoryId: "s1", ...v }]) }),
      }),
    });
  });

  it("rewrites entries from the old name to the new name inside the same transaction", async () => {
    mockPatchReads();

    const res = await PATCH(patchReq({ name: "Lintel Level Ground" }), ctx);

    expect(res.status).toBe(200);
    expect(mockLock).toHaveBeenCalledWith(tx, "c1");
    expect(mockRewrite).toHaveBeenCalledWith(tx, "Work Stage", "Lintel Level", "Lintel Level Ground");
  });

  it("rewrites on a case-only rename", async () => {
    mockPatchReads();
    await PATCH(patchReq({ name: "LINTEL LEVEL" }), ctx);
    expect(mockRewrite).toHaveBeenCalledWith(tx, "Work Stage", "Lintel Level", "LINTEL LEVEL");
  });

  it("does not rewrite entries when only isActive changes", async () => {
    mockPatchReads();
    const res = await PATCH(patchReq({ isActive: false }), ctx);
    expect(res.status).toBe(200);
    expect(mockRewrite).not.toHaveBeenCalled();
  });

  it("does not rewrite entries when the name is sent back unchanged", async () => {
    mockPatchReads();
    const res = await PATCH(patchReq({ name: "Lintel Level" }), ctx);
    expect(res.status).toBe(200);
    expect(mockRewrite).not.toHaveBeenCalled();
  });

  it("409s a rename that collides with a sibling and changes nothing", async () => {
    mockPatchReads();
    const res = await PATCH(patchReq({ name: "ground  ROOF level" }), ctx);
    expect(res.status).toBe(409);
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockRewrite).not.toHaveBeenCalled();
    expect(mockInvalidateOverview).not.toHaveBeenCalled();
  });

  it("404s when the item vanished before the category lock was taken", async () => {
    mockPatchReads();
    mockLock.mockResolvedValue([{ subcategoryId: "s2", name: "Ground roof level", isActive: true }]);
    const res = await PATCH(patchReq({ name: "Anything" }), ctx);
    expect(res.status).toBe(404);
    expect(mockRewrite).not.toHaveBeenCalled();
  });

  it("fails the whole request, and clears no caches, when the entry rewrite throws", async () => {
    mockPatchReads();
    mockRewrite.mockRejectedValue(new Error("boom"));
    const res = await PATCH(patchReq({ name: "Lintel Level Ground" }), ctx);
    expect(res.status).toBe(500);
    expect(mockInvalidateOverview).not.toHaveBeenCalled();
  });

  it("invalidates the catalog caches after a successful rename", async () => {
    mockPatchReads();
    await PATCH(patchReq({ name: "Lintel Level Ground" }), ctx);
    expect(mockInvalidateOverview).toHaveBeenCalledWith("req_test");
  });
});

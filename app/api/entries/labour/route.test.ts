import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockRequireSiteAccess, mockCheckOwnership, mockFindSite,
  mockInsertLabour, mockAssertCatalog,
} = vi.hoisted(() => ({
  mockRequireSiteAccess: vi.fn(),
  mockCheckOwnership: vi.fn(),
  mockFindSite: vi.fn(),
  mockInsertLabour: vi.fn(),
  mockAssertCatalog: vi.fn(),
}));

vi.mock("@/lib/auth/guards", () => ({ requireSiteAccess: mockRequireSiteAccess }));
vi.mock("@/lib/auth/ownership", () => ({ checkOwnership: mockCheckOwnership }));
vi.mock("@/lib/db/client", () => ({
  db: { query: { sites: { findFirst: mockFindSite } } },
}));
vi.mock("@/lib/db/queries/entries", () => ({
  insertLabourEntry: mockInsertLabour,
  // findMatchingLabourEntry / mergeLabourEntry intentionally absent:
  // if the route still imports them, this mock throws at import → test fails.
}));
vi.mock("@/lib/cache/invalidate", () => ({ invalidateAdminAnalyticsCache: vi.fn() }));
vi.mock("@/lib/services/nonCritical", () => ({ runNonCritical: vi.fn() }));
vi.mock("@/lib/validation/catalogList", () => ({ assertInCatalogList: mockAssertCatalog }));

import { POST } from "./route";

function req(body: unknown) {
  return new NextRequest("http://localhost/api/entries/labour", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}
const base = {
  siteId: "11111111-1111-4111-8111-111111111111",
  date: "2026-07-15",
  workType: "Mason",
  peopleCount: 2,
  wagePerHead: 500,
  workStage: "Basement Level",
};

describe("POST labour — no consolidation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireSiteAccess.mockResolvedValue({ session: { user: { id: "u1", role: "supervisor" } } });
    mockAssertCatalog.mockResolvedValue({ ok: true, value: "Mason" });
    mockFindSite.mockResolvedValue({ supervisorId: "u1", archivedAt: null });
    mockCheckOwnership.mockReturnValue(true);
    mockInsertLabour.mockImplementation(async (d: any) => ({ labourEntryId: "l-new", ...d }));
  });

  it("always inserts (never merges) and returns 201", async () => {
    const res = await POST(req(base));
    expect(res.status).toBe(201);
    expect(mockInsertLabour).toHaveBeenCalledTimes(1);
  });

  it("second same site+date+workType entry inserts a second row (201)", async () => {
    await POST(req(base));
    const res = await POST(req(base));
    expect(res.status).toBe(201);
    expect(mockInsertLabour).toHaveBeenCalledTimes(2);
  });

  it("canonicalises and stores workStage when provided", async () => {
    mockAssertCatalog.mockResolvedValue({ ok: true, value: "Basement Level" });
    const res = await POST(req({ ...base, workStage: "basement level" }));
    expect(res.status).toBe(201);
    expect(mockAssertCatalog).toHaveBeenCalledWith("Work Stage", "basement level");
    expect(mockInsertLabour).toHaveBeenCalledWith(
      expect.objectContaining({ workStage: "Basement Level" }),
    );
  });

  it("rejects a create that omits workStage", async () => {
    // Work Stage became mandatory with the phase-costing work. The form is not
    // a security boundary, so the route must reject a direct POST too.
    const { workStage: _omitted, ...withoutStage } = base;
    const res = await POST(req(withoutStage));
    expect(res.status).toBe(400);
    expect(mockInsertLabour).not.toHaveBeenCalled();
  });
});

describe("POST labour — overtime amount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireSiteAccess.mockResolvedValue({ session: { user: { id: "u1", role: "supervisor" } } });
    mockAssertCatalog.mockResolvedValue({ ok: true, value: "Basement Level" });
    mockFindSite.mockResolvedValue({ supervisorId: "u1", archivedAt: null });
    mockCheckOwnership.mockReturnValue(true);
    mockInsertLabour.mockImplementation(async (d: any) => ({ labourEntryId: "l-new", ...d }));
  });

  it("stores the OT amount the supervisor typed, as a decimal string", async () => {
    const res = await POST(req({ ...base, otTotalAmount: 1250.5 }));
    expect(res.status).toBe(201);
    expect(mockInsertLabour).toHaveBeenCalledWith(expect.objectContaining({ otTotalAmount: "1250.5" }));
  });

  it("stores null when no OT is sent", async () => {
    await POST(req(base));
    expect(mockInsertLabour).toHaveBeenCalledWith(expect.objectContaining({ otTotalAmount: null }));
  });

  it("never writes the reserved people/hours/rate columns, even when sent", async () => {
    await POST(req({ ...base, otTotalAmount: 400, otPeopleCount: 2, otHours: 2, otRate: 100 }));
    const inserted = mockInsertLabour.mock.calls[0][0];
    expect(inserted).not.toHaveProperty("otPeopleCount");
    expect(inserted).not.toHaveProperty("otHours");
    expect(inserted).not.toHaveProperty("otRate");
  });

  it("rejects an over-cap OT amount with a 400 instead of reaching the database", async () => {
    const res = await POST(req({ ...base, otTotalAmount: 10_000_000 }));
    expect(res.status).toBe(400);
    expect(mockInsertLabour).not.toHaveBeenCalled();
  });
});


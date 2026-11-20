import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockWritable, mockUpsert } = vi.hoisted(() => ({
  mockWritable: vi.fn(),
  mockUpsert: vi.fn(),
}));

vi.mock("@/lib/auth/siteWritable", () => ({ assertSiteWritable: mockWritable }));
vi.mock("@/lib/db/queries/labourTargets", () => ({ upsertLabourTarget: mockUpsert }));

import { PUT } from "./route";

const req = (body: unknown) =>
  new NextRequest("http://localhost/api/sites/s1/labour-target", {
    method: "PUT",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
const ctx = { params: Promise.resolve({ id: "s1" }) };
const valid = { workType: "Plastering", masonTarget: 60, helperTarget: 40 };

describe("PUT /api/sites/:id/labour-target", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWritable.mockResolvedValue({ ok: true, session: { user: { id: "u1" } } });
    mockUpsert.mockResolvedValue({ masonTarget: 60, helperTarget: 40 });
  });

  it("passes through a 403 for a supervisor of another site without saving", async () => {
    mockWritable.mockResolvedValue({ ok: false, response: new Response(null, { status: 403 }) });
    expect((await PUT(req(valid), ctx)).status).toBe(403);
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it("passes through a 404 for an archived or missing site without saving", async () => {
    mockWritable.mockResolvedValue({ ok: false, response: new Response(null, { status: 404 }) });
    expect((await PUT(req(valid), ctx)).status).toBe(404);
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it("refuses an unauthenticated caller before looking at the body", async () => {
    mockWritable.mockResolvedValue({ ok: false, response: new Response(null, { status: 401 }) });
    expect((await PUT(req({ workType: "Shuttering" }), ctx)).status).toBe(401);
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it("checks writability against the site in the URL", async () => {
    await PUT(req(valid), ctx);
    expect(mockWritable).toHaveBeenCalledWith(expect.objectContaining({ siteId: "s1" }));
  });

  it("rejects a work type without masons and helpers", async () => {
    expect((await PUT(req({ ...valid, workType: "Shuttering" }), ctx)).status).toBe(400);
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it.each([
    ["negative", { masonTarget: -1 }],
    ["fractional", { masonTarget: 1.5 }],
    ["over the cap", { helperTarget: 100001 }],
    ["a numeric string", { masonTarget: "60" }],
  ])("rejects a %s target", async (_label, patch) => {
    expect((await PUT(req({ ...valid, ...patch }), ctx)).status).toBe(400);
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it("rejects a body that leaves out a target key", async () => {
    expect((await PUT(req({ workType: "Plastering", masonTarget: 60 }), ctx)).status).toBe(400);
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it("trims the work type, allows a blank target and saves as the caller", async () => {
    mockUpsert.mockResolvedValue({ masonTarget: 60, helperTarget: null });
    const res = await PUT(req({ workType: " Brick work ", masonTarget: 60, helperTarget: null }), ctx);
    expect(res.status).toBe(200);
    expect(mockUpsert).toHaveBeenCalledWith({
      siteId: "s1", workType: "Brick work", masonTarget: 60, helperTarget: null, userId: "u1",
    });
    const json = await res.json();
    expect(JSON.stringify(json)).toContain('"target":{"masonTarget":60,"helperTarget":null}');
  });
});

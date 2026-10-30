import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "./route";
import { GET as options } from "./receive-options/route";
import { GET as history } from "./movements/route";
import { MovementError } from "@/lib/tools/movement";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), move: vi.fn(), holdings: vi.fn(), options: vi.fn(), history: vi.fn() }));
vi.mock("@/lib/auth/guards", () => ({ requireCapability: mocks.auth }));
vi.mock("@/lib/tools/movement", async (original) => ({ ...await original<object>(), executeMovement: mocks.move }));
vi.mock("@/lib/tools/siteQuery", () => ({ getSiteTools: mocks.holdings, listReceiveOptions: mocks.options, listSiteToolMovements: mocks.history }));
const siteId = crypto.randomUUID(), toolId = crypto.randomUUID(), userId = crypto.randomUUID();
const ctx = { params: Promise.resolve({ id: siteId }) };
const req = (body?: unknown, path = "") => new NextRequest(`http://localhost/api/sites/${siteId}/tools${path}`, body ? { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } } : undefined);
beforeEach(() => { vi.resetAllMocks(); mocks.auth.mockResolvedValue({ session: { user: { id: userId, role: "Supervisor" } } }); });
describe("site tools routes", () => {
  it("requires authentication for every endpoint", async () => {
    mocks.auth.mockResolvedValue({ error: "UNAUTHORIZED", status: 401 });
    for (const handler of [GET, POST, options, history])
      expect((await handler(req(), ctx)).status).toBe(401);
  });
  it("returns private holdings and safe movement projection", async () => {
    mocks.holdings.mockResolvedValue({ site: { siteId, name: "A" }, items: [], itemCount: 0, toolTypeCount: 0 });
    const read = await GET(req(), ctx);
    expect(read.headers.get("cache-control")).toBe("private, no-store");
    mocks.move.mockResolvedValue({ toolId, version: 3, assignments: [{ siteId, qty: 2 }], code: "SECRET", free: 99, totalQuantity: 100 });
    const moved = await POST(req({ toolId, expectedVersion: 2, kind: "receive", quantity: 2 }), ctx);
    expect((await moved.json()).data).toEqual({ status: "ok", toolId, version: 3, quantityHere: 2 });
    expect(mocks.move).toHaveBeenCalledWith({ toolId, expectedVersion: 2, actor: { id: userId, role: "Supervisor" }, action: { kind: "send_to_site", targetSiteId: siteId, quantity: 2, note: undefined } });
  });
  it("rejects injected source keys and invalid pagination or search", async () => {
    expect((await POST(req({ toolId, expectedVersion: 0, kind: "return", quantity: 1, fromSiteId: crypto.randomUUID() }), ctx)).status).toBe(400);
    expect((await options(req(undefined, "/receive-options?q=" + "x".repeat(121)), ctx)).status).toBe(400);
    expect((await history(req(undefined, "/movements?limit=201"), ctx)).status).toBe(400);
    expect((await GET(req(), { params: Promise.resolve({ id: "bad" }) })).status).toBe(400);
  });
  it("maps domain errors to real HTTP errors without tool state", async () => {
    for (const [reason, status] of [["stale_version", 409], ["forbidden_site", 403], ["site_unavailable", 404], ["tool_not_found", 404], ["insufficient_source", 400]] as const) {
      mocks.move.mockRejectedValue(new MovementError(reason, reason === "insufficient_source" ? 2 : undefined));
      const response = await POST(req({ toolId, expectedVersion: 0, kind: "return", quantity: 3 }), ctx);
      expect(response.status).toBe(status);
      const body = await response.json();
      expect(body.success).toBe(false);
      expect(body.data).toBeUndefined();
      expect(body.error.details).toEqual(reason === "insufficient_source" ? { reason, available: 2 } : { reason });
    }
  });
  it("returns validated options and movement pagination", async () => {
    mocks.options.mockResolvedValue([]);
    mocks.history.mockResolvedValue([]);
    expect((await (await options(req(undefined, "/receive-options?q=%20drill%20"), ctx)).json()).data).toEqual({ tools: [] });
    expect((await (await history(req(undefined, "/movements?limit=10&offset=2"), ctx)).json()).data).toEqual({ movements: [], limit: 10, offset: 2 });
  });
  it("keeps failed scoped reads private and uncacheable",async()=>{
    mocks.holdings.mockRejectedValue(new Error("database unavailable"));
    const response=await GET(req(),ctx);
    expect(response.status).toBe(500);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });

});

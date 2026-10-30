import { NextRequest } from "next/server";
import { beforeEach, expect, it, vi } from "vitest";
import { POST } from "./route";
import { MovementError } from "@/lib/tools/movement";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), move: vi.fn() }));
vi.mock("@/lib/auth/guards", () => ({ requireCapability: mocks.auth }));
vi.mock("@/lib/tools/movement", async (original) => ({ ...await original<object>(), executeMovement: mocks.move }));
const toolId = crypto.randomUUID(), id = crypto.randomUUID();
const ctx = { params: Promise.resolve({ id: toolId }) };
const req = (body: unknown) => new NextRequest(`http://localhost/api/tools/${toolId}/move`, { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } });
beforeEach(() => { vi.resetAllMocks(); mocks.auth.mockResolvedValue({ session: { user: { id, role: "Admin" } } }); });
it("requires an observed version and projects the existing admin response", async () => {
  expect((await POST(req({ kind: "add_stock", quantity: 1 }), ctx)).status).toBe(400);
  mocks.move.mockResolvedValue({ toolId, version: 1 });
  const response = await POST(req({ kind: "add_stock", quantity: 1, expectedVersion: 0 }), ctx);
  expect(response.status).toBe(200);
  expect((await response.json()).data).toEqual({ toolId, status: "ok", tool: { toolId, version: 1 } });
  expect(mocks.move).toHaveBeenCalledWith({ toolId, expectedVersion: 0, actor: { id, role: "Admin" }, action: { kind: "add_stock", quantity: 1 } });
});
it("returns 409 for stale version and 400 for insufficient source", async () => {
  for (const [reason, status] of [["stale_version", 409], ["insufficient_source", 400]] as const) {
    mocks.move.mockRejectedValue(new MovementError(reason));
    expect((await POST(req({ kind: "add_stock", quantity: 1, expectedVersion: 0 }), ctx)).status).toBe(status);
  }
});

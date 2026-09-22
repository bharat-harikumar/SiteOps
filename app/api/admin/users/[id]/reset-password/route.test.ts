import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockRequireCapability,
  mockGetActorRole,
  mockInvalidateClaims,
  mockInvalidateProfile,
  mockRevokeSessions,
  mockScheduleAudit,
  mockUpdateUserById,
  mockTargetLookup,
  mockFlagUpdate,
  mockSet,
} = vi.hoisted(() => ({
  mockRequireCapability: vi.fn(),
  mockGetActorRole: vi.fn(),
  mockInvalidateClaims: vi.fn(),
  mockInvalidateProfile: vi.fn(),
  mockRevokeSessions: vi.fn(),
  mockScheduleAudit: vi.fn(),
  mockUpdateUserById: vi.fn(),
  mockTargetLookup: vi.fn(),
  mockFlagUpdate: vi.fn(),
  mockSet: vi.fn(),
}));

vi.mock("@/lib/auth/guards", () => ({ requireCapability: mockRequireCapability }));
vi.mock("@/lib/auth/actorRole", () => ({ getActorRoleFromDb: mockGetActorRole }));
vi.mock("@/lib/auth/refreshClaims", () => ({ invalidateUserClaims: mockInvalidateClaims }));
vi.mock("@/lib/auth/sessions", () => ({ revokeUserSessions: mockRevokeSessions }));
vi.mock("@/lib/cache/invalidate", () => ({ invalidateUserProfileCache: mockInvalidateProfile }));
vi.mock("@/lib/audit/log", () => ({ scheduleAudit: mockScheduleAudit }));
vi.mock("@/lib/auth/config", () => ({
  createSupabaseServiceClient: () => ({ auth: { admin: { updateUserById: mockUpdateUserById } } }),
}));
vi.mock("@/lib/db/client", () => ({
  db: {
    select: () => ({ from: () => ({ where: () => ({ limit: mockTargetLookup }) }) }),
    update: () => ({ set: (values: unknown) => { mockSet(values); return { where: mockFlagUpdate }; } }),
  },
}));
vi.mock("@/lib/utils/requestId", () => ({ generateRequestId: () => "req_test" }));

import { POST } from "./route";

const TEMP = "Temp-pass-2026";

function reset(id: string, body: unknown = { tempPassword: TEMP }) {
  const req = new NextRequest(`http://localhost/api/admin/users/${id}/reset-password`, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
  return POST(req, { params: Promise.resolve({ id }) });
}

describe("POST /api/admin/users/[id]/reset-password", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireCapability.mockResolvedValue({ session: { user: { id: "admin-1", role: "Admin" } } });
    mockGetActorRole.mockResolvedValue("Admin");
    mockTargetLookup.mockResolvedValue([{ userId: "u2" }]);
    mockUpdateUserById.mockResolvedValue({ data: { user: { id: "u2" } }, error: null });
    mockFlagUpdate.mockResolvedValue(undefined);
  });

  it("asks for the reset_password capability and passes its refusal through", async () => {
    mockRequireCapability.mockResolvedValue({ error: "UNAUTHORIZED", status: 401 });
    const res = await reset("u2");
    expect(res.status).toBe(401);
    expect(mockRequireCapability).toHaveBeenCalledWith(expect.anything(), "user:reset_password");
    expect(mockUpdateUserById).not.toHaveBeenCalled();
  });

  it("403s when the actor's DB role is no longer admin (stale token)", async () => {
    mockGetActorRole.mockResolvedValue("Supervisor");
    const res = await reset("u2");
    expect(res.status).toBe(403);
    expect(mockUpdateUserById).not.toHaveBeenCalled();
  });

  it("400s a temp password shorter than 10 characters", async () => {
    const res = await reset("u2", { tempPassword: "short" });
    expect(res.status).toBe(400);
    expect(mockUpdateUserById).not.toHaveBeenCalled();
  });

  it("400s unknown body fields", async () => {
    const res = await reset("u2", { tempPassword: TEMP, role: "Admin" });
    expect(res.status).toBe(400);
  });

  it("refuses an admin resetting their own password", async () => {
    const res = await reset("admin-1");
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(JSON.stringify(body)).toContain("Change password");
    expect(mockUpdateUserById).not.toHaveBeenCalled();
  });

  it("404s a user without a profile", async () => {
    mockTargetLookup.mockResolvedValue([]);
    const res = await reset("ghost");
    expect(res.status).toBe(404);
    expect(mockUpdateUserById).not.toHaveBeenCalled();
  });

  it("changes nothing else when the auth provider rejects the password", async () => {
    mockUpdateUserById.mockResolvedValue({ data: null, error: { message: "Password is too weak", status: 422 } });
    const res = await reset("u2");
    expect(res.status).toBe(400);
    expect(mockFlagUpdate).not.toHaveBeenCalled();
    expect(mockRevokeSessions).not.toHaveBeenCalled();
    expect(mockScheduleAudit).not.toHaveBeenCalled();
  });

  it("500s when the DB flag update fails after the password was set (safe to retry)", async () => {
    mockFlagUpdate.mockRejectedValue(new Error("connection reset"));
    const res = await reset("u2");
    expect(res.status).toBe(500);
    expect(mockScheduleAudit).not.toHaveBeenCalled();
  });

  it("sets the password, forces a change, re-mints claims and signs the user out everywhere", async () => {
    const res = await reset("u2");
    expect(res.status).toBe(200);
    expect(mockUpdateUserById).toHaveBeenCalledWith("u2", { password: TEMP });
    expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({ mustChangePassword: true }));
    expect(mockInvalidateClaims).toHaveBeenCalledWith("u2");
    expect(mockInvalidateProfile).toHaveBeenCalledWith("u2", expect.any(String));
    expect(mockRevokeSessions).toHaveBeenCalledWith("u2");
  });

  it("audits the reset without the password", async () => {
    await reset("u2");
    expect(mockScheduleAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "user.password_reset", resourceId: "u2", actorUserId: "admin-1" }),
    );
    expect(JSON.stringify(mockScheduleAudit.mock.calls)).not.toContain(TEMP);
  });

  it("never returns the password", async () => {
    const res = await reset("u2");
    const text = await res.text();
    expect(text).not.toContain(TEMP);
    expect(JSON.parse(text).data).toEqual({ userId: "u2", mustChangePassword: true });
  });

  it("does not cache the response", async () => {
    const res = await reset("u2");
    expect(res.headers.get("cache-control")).toContain("no-store");
  });
});

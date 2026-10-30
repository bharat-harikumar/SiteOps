import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ session: vi.fn(), site: vi.fn() }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next/navigation", () => ({
  redirect: () => {
    throw new Error("redirect");
  },
  notFound: () => {
    throw new Error("not-found");
  },
}));
vi.mock("@/lib/auth/session", () => ({
  safeGetSessionFromHeaders: mocks.session,
}));
vi.mock("@/lib/db/queries/sites", () => ({ getSiteById: mocks.site }));
import SiteToolsPage from "./page";
beforeEach(() => {
  mocks.session.mockReturnValue({ user: { id: "u", role: "Supervisor" } });
  mocks.site.mockResolvedValue({
    siteId: "s",
    name: "Kollam",
    supervisorId: "u",
    archivedAt: null,
    isDeleted: false,
  });
});
it("redirects a signed-out visitor before reading site data", async () => {
  mocks.site.mockClear();
  mocks.session.mockReturnValue(null);
  await expect(
    SiteToolsPage({ params: Promise.resolve({ id: "s" }) }),
  ).rejects.toThrow("redirect");
  expect(mocks.site).not.toHaveBeenCalled();
});
it("does not expose somebody else's site", async () => {
  mocks.site.mockResolvedValue({ supervisorId: "other" });
  await expect(
    SiteToolsPage({ params: Promise.resolve({ id: "s" }) }),
  ).rejects.toThrow("not-found");
});
it("does not expose an archived or deleted site", async () => {
  for (const state of [{ archivedAt: new Date() }, { isDeleted: true }]) {
    mocks.site.mockResolvedValue({ supervisorId: "u", ...state });
    await expect(
      SiteToolsPage({ params: Promise.resolve({ id: "s" }) }),
    ).rejects.toThrow("not-found");
  }
});
it("opens the assigned site's tools", async () => {
  const result = await SiteToolsPage({ params: Promise.resolve({ id: "s" }) });
  expect(result.props).toMatchObject({ siteId: "s", siteName: "Kollam" });
});

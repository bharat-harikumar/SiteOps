import { PgDialect } from "drizzle-orm/pg-core";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { where } = vi.hoisted(() => ({ where: vi.fn() }));

vi.mock("@/lib/db/client", () => ({
  db: { select: () => ({ from: () => ({ where }) }) },
}));

import { getSiteById } from "./sites";

function renderedWhere() {
  return new PgDialect().sqlToQuery(where.mock.calls[0][0]);
}

describe("getSiteById", () => {
  beforeEach(() => {
    where.mockReset();
    where.mockResolvedValue([]);
  });

  it("never returns a soft-deleted site, with or without includeArchived", async () => {
    // Every stage/operations page and API resolves its site through here, so
    // excluding is_deleted once keeps a deleted site a 404 everywhere.
    for (const includeArchived of [false, true]) {
      where.mockClear();
      await getSiteById("site-1", { includeArchived });
      const { sql: rendered } = renderedWhere();
      expect(rendered).toContain('"is_deleted" = $');
    }
  });

  it("still excludes archived sites by default", async () => {
    await getSiteById("site-1");
    expect(renderedWhere().sql).toContain('"archived_at" is null');
  });

  it("returns the first row, or null when nothing matches", async () => {
    expect(await getSiteById("site-1")).toBeNull();
    where.mockResolvedValue([{ siteId: "site-1" }]);
    expect(await getSiteById("site-1")).toEqual({ siteId: "site-1" });
  });
});

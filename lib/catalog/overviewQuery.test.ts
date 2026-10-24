import { describe, expect, it } from "vitest";

import { countCatalogUsage, fetchUsageCounts } from "@/lib/catalog/overviewQuery";
import { describeDb, seedSite, withRollback } from "@/lib/db/testing";
import { labourEntries, materialEntries, sites } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

describe("fetchUsageCounts (unit, mocked executor)", () => {
  it("sums counts across multiple tables that share a category name and value", async () => {
    // "Work Stage" spans material/labour/machinery/expense — two tables can report
    // the same value (e.g. "Basement Level"). The map must sum, not overwrite.
    const fakeExecutor = {
      execute: async () => [
        { category_name: "Work Stage", value: "Basement Level", n: 50 },
        { category_name: "Work Stage", value: "Basement Level", n: 10 },
      ],
    };

    const counts = await fetchUsageCounts(fakeExecutor as any);

    expect(counts.get("Work Stage")?.get("Basement Level")).toBe(60);
  });
});

describeDb("fetchUsageCounts", () => {
  it("counts free-text usages grouped by value, keyed by category name", async () => {
    await withRollback(async (tx) => {
      const { userId, siteId } = await seedSite(tx);
      // The catalog overview counts usage across ALL sites, and this rolled-back
      // tx still sees committed production rows — so use unique sentinel values
      // that cannot pre-exist, making the expected counts exact.
      const wt = `WT_${userId.slice(0, 8)}`;
      const mt = `MT_${userId.slice(0, 8)}`;
      const ws = `WS_${userId.slice(0, 8)}`;
      await tx.insert(labourEntries).values([
        { siteId, createdBy: userId, date: "2026-06-22", workType: wt, peopleCount: 1 },
        { siteId, createdBy: userId, date: "2026-06-22", workType: wt, peopleCount: 2 },
      ]);
      await tx.insert(materialEntries).values([
        { siteId, createdBy: userId, date: "2026-06-22", materialType: mt, workStage: ws, quantity: "5", cost: "10.00" },
      ]);

      const counts = await fetchUsageCounts(tx);

      expect(counts.get("Labour")?.get(wt)).toBe(2);
      expect(counts.get("Materials")?.get(mt)).toBe(1);
      expect(counts.get("Work Stage")?.get(ws)).toBe(1);
      // Every source key is present even when it has no matching rows.
      expect(counts.has("Incident Severity")).toBe(true);
    });
  });
});

describeDb("fetchUsageCounts and soft-deleted sites", () => {
  it("counts live and archived sites but not soft-deleted ones", async () => {
    await withRollback(async (tx) => {
      const live = await seedSite(tx);
      const archived = await seedSite(tx);
      const deleted = await seedSite(tx);
      await tx.update(sites).set({ archivedAt: new Date() }).where(eq(sites.siteId, archived.siteId));
      await tx.update(sites).set({ archivedAt: new Date(), isDeleted: true }).where(eq(sites.siteId, deleted.siteId));

      // Unique sentinels: this tx still sees committed production rows.
      const ws = `WS_${live.userId.slice(0, 8)}`;
      const wt = `WT_${live.userId.slice(0, 8)}`;
      for (const { siteId, userId } of [live, archived, deleted]) {
        await tx.insert(materialEntries).values({
          siteId, createdBy: userId, date: "2026-06-22", materialType: "Cement",
          workStage: ws, quantity: "1", cost: "1.00",
        });
        await tx.insert(labourEntries).values({
          siteId, createdBy: userId, date: "2026-06-22", workType: wt, peopleCount: 1,
        });
      }

      const counts = await fetchUsageCounts(tx);

      // live + archived = 2; the soft-deleted site's row is excluded.
      expect(counts.get("Work Stage")?.get(ws)).toBe(2);
      expect(counts.get("Labour")?.get(wt)).toBe(2);
    });
  });
});

describeDb("countCatalogUsage", () => {
  it("sums one item's usage across every source table, ignoring soft-deleted sites", async () => {
    await withRollback(async (tx) => {
      const live = await seedSite(tx);
      const deleted = await seedSite(tx);
      await tx.update(sites).set({ archivedAt: new Date(), isDeleted: true }).where(eq(sites.siteId, deleted.siteId));
      const ws = `WS_${live.userId.slice(0, 8)}`;

      await tx.insert(materialEntries).values({
        siteId: live.siteId, createdBy: live.userId, date: "2026-06-22", materialType: "Cement",
        workStage: ws, quantity: "1", cost: "1.00",
      });
      await tx.insert(labourEntries).values({
        siteId: live.siteId, createdBy: live.userId, date: "2026-06-22", workType: "Mason", peopleCount: 1, workStage: ws,
      });
      await tx.insert(labourEntries).values({
        siteId: deleted.siteId, createdBy: deleted.userId, date: "2026-06-22", workType: "Mason", peopleCount: 1, workStage: ws,
      });

      expect(await countCatalogUsage(tx, "Work Stage", ws)).toBe(2);
      expect(await countCatalogUsage(tx, "Work Stage", `${ws}_unused`)).toBe(0);
    });
  });

  it("is 0 for a category that has no usage sources", async () => {
    await withRollback(async (tx) => {
      expect(await countCatalogUsage(tx, "No Such Category", "x")).toBe(0);
    });
  });
});

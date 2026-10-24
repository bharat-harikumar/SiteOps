import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import { CatalogChangedError, lockCatalogMembers } from "@/lib/catalog/lockCatalogMembers";
import { categories, subcategories } from "@/lib/db/schema";
import { describeDb, withRollback } from "@/lib/db/testing";

describeDb("lockCatalogMembers", () => {
  async function seedList(tx: Parameters<Parameters<typeof withRollback>[0]>[0]) {
    const tag = randomUUID().slice(0, 8);
    const listKey = `List_${tag}`;
    const [cat] = await tx.insert(categories).values({ name: listKey }).returning();
    await tx.insert(subcategories).values([
      { categoryId: cat.categoryId, name: `Live_${tag}`, isActive: true },
      { categoryId: cat.categoryId, name: `Off_${tag}`, isActive: false },
    ]);
    return { tag, listKey };
  }

  it("passes when every value is an active item of its list under the exact stored name", async () => {
    await withRollback(async (tx) => {
      const { tag, listKey } = await seedList(tx);
      await expect(lockCatalogMembers(tx, [[listKey, `Live_${tag}`]])).resolves.toBeUndefined();
    });
  });

  it("throws CatalogChangedError for an inactive item", async () => {
    await withRollback(async (tx) => {
      const { tag, listKey } = await seedList(tx);
      await expect(lockCatalogMembers(tx, [[listKey, `Off_${tag}`]])).rejects.toBeInstanceOf(CatalogChangedError);
    });
  });

  it("throws CatalogChangedError for a name that no longer exists (e.g. renamed away)", async () => {
    await withRollback(async (tx) => {
      const { listKey } = await seedList(tx);
      await expect(lockCatalogMembers(tx, [[listKey, "Old Name"]])).rejects.toThrow(/just renamed or removed/);
    });
  });

  it("requires the exact stored text, not a case-insensitive match", async () => {
    await withRollback(async (tx) => {
      const { tag, listKey } = await seedList(tx);
      await expect(
        lockCatalogMembers(tx, [[listKey, `live_${tag}`]]),
      ).rejects.toBeInstanceOf(CatalogChangedError);
    });
  });

  it("skips null, undefined and empty values (an un-tagged optional field)", async () => {
    await withRollback(async (tx) => {
      const { listKey } = await seedList(tx);
      await expect(
        lockCatalogMembers(tx, [[listKey, null], [listKey, undefined], [listKey, ""]]),
      ).resolves.toBeUndefined();
    });
  });
});

import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import { lockCategoryItems, rewriteEntryNames } from "@/lib/catalog/rewriteEntryNames";
import {
  categories,
  expenseEntries,
  labourEntries,
  machineryEntries,
  materialEntries,
  subcategories,
} from "@/lib/db/schema";
import { describeDb, seedSite, withRollback } from "@/lib/db/testing";

describeDb("rewriteEntryNames", () => {
  it("rewrites the category's own column in every source table and nothing else", async () => {
    await withRollback(async (tx) => {
      const { userId, siteId } = await seedSite(tx);
      // Unique sentinels: this tx still sees committed production rows.
      const tag = userId.slice(0, 8);
      const from = `OLD_${tag}`;
      const to = `NEW_${tag}`;
      const other = `OTHER_${tag}`;
      const base = { siteId, createdBy: userId, date: "2026-06-22" };

      await tx.insert(materialEntries).values([
        { ...base, materialType: "Cement", quantity: "1", workStage: from },
        { ...base, materialType: "Cement", quantity: "1", workStage: other },
      ]);
      await tx.insert(labourEntries).values([
        { ...base, workType: "Mason", peopleCount: 1, workStage: from },
        // Same text in a DIFFERENT column must be left alone: "Work Stage"
        // rewrites work_stage only, never work_type.
        { ...base, workType: from, peopleCount: 1, workStage: other },
      ]);
      await tx.insert(machineryEntries).values({
        ...base, equipmentType: "Hitachi", count: 1, totalCost: "1", workStage: from,
      });
      await tx.insert(expenseEntries).values({
        ...base, category: "Misc", description: "d", amount: "1", workStage: from,
      });

      const rewritten = await rewriteEntryNames(tx, "Work Stage", from, to);

      expect(rewritten).toBe(4);
      const stages = async (table: typeof materialEntries | typeof labourEntries | typeof machineryEntries | typeof expenseEntries) =>
        (await tx.select({ s: table.workStage }).from(table)).map((r) => r.s);
      expect(await stages(materialEntries)).toEqual(expect.arrayContaining([to, other]));
      expect(await stages(materialEntries)).not.toContain(from);
      expect(await stages(labourEntries)).not.toContain(from);
      expect(await stages(machineryEntries)).not.toContain(from);
      expect(await stages(expenseEntries)).not.toContain(from);
      const labourTypes = (await tx.select({ t: labourEntries.workType }).from(labourEntries)).map((r) => r.t);
      expect(labourTypes).toContain(from); // work_type untouched
    });
  });

  it("returns 0 and writes nothing for an unknown category", async () => {
    await withRollback(async (tx) => {
      expect(await rewriteEntryNames(tx, "No Such Category", "a", "b")).toBe(0);
    });
  });
});

describeDb("lockCategoryItems", () => {
  it("returns every item of the category (active and inactive) and no other category's", async () => {
    await withRollback(async (tx) => {
      const tag = randomUUID().slice(0, 8);
      const [cat] = await tx.insert(categories).values({ name: `Cat_${tag}` }).returning();
      const [otherCat] = await tx.insert(categories).values({ name: `OtherCat_${tag}` }).returning();
      await tx.insert(subcategories).values([
        { categoryId: cat.categoryId, name: `A_${tag}`, isActive: true },
        { categoryId: cat.categoryId, name: `B_${tag}`, isActive: false },
        { categoryId: otherCat.categoryId, name: `C_${tag}` },
      ]);

      const items = await lockCategoryItems(tx, cat.categoryId);

      expect(items.map((i) => i.name).sort()).toEqual([`A_${tag}`, `B_${tag}`]);
      expect(items.find((i) => i.name === `B_${tag}`)?.isActive).toBe(false);
    });
  });
});

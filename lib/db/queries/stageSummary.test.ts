import { describe, expect, it } from "vitest";

import { labourEntries, materialEntries } from "@/lib/db/schema";
import { describeDb, seedSite, withRollback } from "@/lib/db/testing";

import { getStageAggregates, getStageComposition } from "./stageSummary";

describeDb("getStageAggregates", () => {
  it("groups spend and dates by stage, keeping untagged rows as a null stage", async () => {
    await withRollback(async (tx) => {
      const { userId, siteId } = await seedSite(tx);

      await tx.insert(labourEntries).values([
        { siteId, date: "2026-08-01", workType: "Mason", peopleCount: 2,
          wagePerHead: "700", workStage: "Basement Level", createdBy: userId },
        { siteId, date: "2026-08-05", workType: "Helper", peopleCount: 1,
          wagePerHead: "500", workStage: "Basement Level", createdBy: userId },
        { siteId, date: "2026-02-01", workType: "Piling", peopleCount: 1,
          wagePerHead: "40000", workStage: null, createdBy: userId },
      ]);
      await tx.insert(materialEntries).values([
        { siteId, date: "2026-08-03", materialType: "Cement", quantity: "50",
          unit: "Bag", workStage: "Basement Level", cost: "20000", createdBy: userId },
      ]);

      const rows = await getStageAggregates(tx, siteId);

      const labourBasement = rows.find(
        (r) => r.entryType === "labour" && r.stage === "Basement Level",
      );
      expect(labourBasement).toMatchObject({
        entryCount: 2,
        firstDate: "2026-08-01",
        lastDate: "2026-08-05",
        spend: 1900, // 2×700 + 1×500
      });

      const labourUntagged = rows.find(
        (r) => r.entryType === "labour" && r.stage === null,
      );
      expect(labourUntagged).toMatchObject({ entryCount: 1, spend: 40000 });

      const material = rows.find((r) => r.entryType === "material");
      expect(material).toMatchObject({ stage: "Basement Level", entryCount: 1, spend: 20000 });
    });
  });

  it("applies the mason/helper split precedence, not a naive sum", async () => {
    await withRollback(async (tx) => {
      const { userId, siteId } = await seedSite(tx);
      await tx.insert(labourEntries).values([
        // 2 masons @1300 + 2 helpers @1100 = 4800. A naive column sum reads 2400.
        // salaryAmount is also set, to prove split wins the precedence.
        { siteId, date: "2026-08-01", workType: "Mason", peopleCount: 4,
          wagePerHead: "0", salaryAmount: "9999", masonCount: 2, masonSalaryAmount: "1300",
          helperCount: 2, helperSalaryAmount: "1100",
          workStage: "Basement Level", createdBy: userId },
      ]);

      const rows = await getStageAggregates(tx, siteId);
      expect(rows.find((r) => r.entryType === "labour")!.spend).toBe(4800);
    });
  });

  it("splits untagged rows by whether the entry predates the work_stage column", async () => {
    await withRollback(async (tx) => {
      const { userId, siteId } = await seedSite(tx);
      await tx.insert(labourEntries).values([
        // created_at is defaulted to now(), so force it explicitly.
        { siteId, date: "2026-02-01", workType: "Piling", peopleCount: 1,
          wagePerHead: "1000", workStage: null, createdBy: userId,
          createdAt: new Date("2026-07-01T00:00:00Z") },
        { siteId, date: "2026-08-01", workType: "Helper", peopleCount: 1,
          wagePerHead: "500", workStage: null, createdBy: userId,
          createdAt: new Date("2026-08-01T00:00:00Z") },
      ]);

      const rows = await getStageAggregates(tx, siteId);
      const legacy = rows.find((r) => r.stage === null && r.legacy);
      const skipped = rows.find((r) => r.stage === null && !r.legacy);

      expect(legacy).toMatchObject({ entryCount: 1, spend: 1000 });
      expect(skipped).toMatchObject({ entryCount: 1, spend: 500 });
    });
  });

  it("never marks a tagged row legacy, however old it is", async () => {
    await withRollback(async (tx) => {
      const { userId, siteId } = await seedSite(tx);
      await tx.insert(labourEntries).values({
        siteId, date: "2026-01-01", workType: "Mason", peopleCount: 1,
        wagePerHead: "700", workStage: "Basement Level", createdBy: userId,
        createdAt: new Date("2026-01-01T00:00:00Z"),
      });
      const rows = await getStageAggregates(tx, siteId);
      expect(rows.every((r) => r.legacy === false)).toBe(true);
    });
  });

  it("returns nothing for a site with no entries", async () => {
    await withRollback(async (tx) => {
      const { siteId } = await seedSite(tx);
      expect(await getStageAggregates(tx, siteId)).toEqual([]);
    });
  });

  it("does not leak another site's entries", async () => {
    await withRollback(async (tx) => {
      const a = await seedSite(tx);
      const b = await seedSite(tx);
      await tx.insert(labourEntries).values({
        siteId: b.siteId, date: "2026-08-01", workType: "Mason", peopleCount: 9,
        wagePerHead: "1000", workStage: "Roof Level", createdBy: b.userId,
      });
      expect(await getStageAggregates(tx, a.siteId)).toEqual([]);
    });
  });

  it("rejects a siteId that is not a uuid", async () => {
    await withRollback(async (tx) => {
      await expect(getStageAggregates(tx, "not-a-uuid")).rejects.toThrow();
    });
  });
});

describeDb("getStageComposition", () => {
  it("groups material by type and labour by work type", async () => {
    await withRollback(async (tx) => {
      const { userId, siteId } = await seedSite(tx);
      await tx.insert(materialEntries).values([
        { siteId, date: "2026-08-01", materialType: "Cement", quantity: "100",
          unit: "Bag", workStage: "Basement Level", cost: "50000", createdBy: userId },
        { siteId, date: "2026-08-02", materialType: "Cement", quantity: "175",
          unit: "Bag", workStage: "Basement Level", cost: "38000", createdBy: userId },
        { siteId, date: "2026-08-03", materialType: "Metal", quantity: "10",
          unit: "CFT", workStage: "Basement Level", cost: "97950", createdBy: userId },
      ]);
      await tx.insert(labourEntries).values([
        { siteId, date: "2026-08-01", workType: "Steel work", peopleCount: 3,
          wagePerHead: "1000", workStage: "Basement Level", createdBy: userId },
      ]);

      const rows = await getStageComposition(tx, siteId, "Basement Level");

      expect(rows.find((r) => r.name === "Cement")).toMatchObject({
        entryType: "material", entryCount: 2, quantity: 275, unit: "Bag", spend: 88000,
      });
      expect(rows.find((r) => r.name === "Steel work")).toMatchObject({
        entryType: "labour", entryCount: 1, headCount: 3, spend: 3000,
      });
    });
  });

  it("selects only the skipped bucket when the stage is null", async () => {
    await withRollback(async (tx) => {
      const { userId, siteId } = await seedSite(tx);
      await tx.insert(labourEntries).values([
        { siteId, date: "2026-02-01", workType: "Piling", peopleCount: 1,
          wagePerHead: "40000", workStage: null, createdBy: userId,
          createdAt: new Date("2026-07-01T00:00:00Z") },
        { siteId, date: "2026-08-01", workType: "Helper", peopleCount: 1,
          wagePerHead: "500", workStage: null, createdBy: userId,
          createdAt: new Date("2026-08-01T00:00:00Z") },
        { siteId, date: "2026-08-02", workType: "Mason", peopleCount: 1,
          wagePerHead: "700", workStage: "Roof Level", createdBy: userId },
      ]);

      expect((await getStageComposition(tx, siteId, null)).map((r) => r.name))
        .toEqual(["Helper"]);
      expect((await getStageComposition(tx, siteId, null, { legacy: true })).map((r) => r.name))
        .toEqual(["Piling"]);
    });
  });

  it("does not leak another site's entries", async () => {
    await withRollback(async (tx) => {
      const a = await seedSite(tx);
      const b = await seedSite(tx);
      await tx.insert(labourEntries).values({
        siteId: b.siteId, date: "2026-08-01", workType: "Mason", peopleCount: 9,
        wagePerHead: "1000", workStage: "Roof Level", createdBy: b.userId,
      });
      expect(await getStageComposition(tx, a.siteId, "Roof Level")).toEqual([]);
    });
  });

  it("sums split-labour manpower per role, costing each head at its own wage", async () => {
    await withRollback(async (tx) => {
      const { userId, siteId } = await seedSite(tx);
      // Split entries carry no people_count — the form drops it (lib/services/entries.ts).
      await tx.insert(labourEntries).values([
        { siteId, date: "2026-08-01", workType: "Brick work", peopleCount: 0,
          wagePerHead: "0", masonCount: 2, masonSalaryAmount: "1300.00",
          helperCount: 3, helperSalaryAmount: "1100.00",
          workStage: "Basement Level", createdBy: userId },
        { siteId, date: "2026-08-02", workType: "Brick work", peopleCount: 0,
          wagePerHead: "0", masonCount: 2, masonSalaryAmount: "1300.00",
          helperCount: 2, helperSalaryAmount: "1100.00",
          workStage: "Basement Level", createdBy: userId },
      ]);

      const rows = await getStageComposition(tx, siteId, "Basement Level");

      expect(rows.find((r) => r.name === "Brick work")).toMatchObject({
        masonCount: 4, masonSalary: 5200, // (2+2) heads, 2×1300 + 2×1300
        helperCount: 5, helperSalary: 5500, // (3+2) heads, 3×1100 + 2×1100
        spend: 10700, // manpower must reconcile with the row total
      });
    });
  });

  it("reports the OT lump sum per work type, already inside spend", async () => {
    await withRollback(async (tx) => {
      const { userId, siteId } = await seedSite(tx);
      await tx.insert(materialEntries).values({
        siteId, date: "2026-08-01", materialType: "Cement", quantity: "10",
        unit: "Bag", workStage: "Basement Level", cost: "5000", createdBy: userId,
      });
      await tx.insert(labourEntries).values([
        // One OT amount covers masons and helpers together.
        { siteId, date: "2026-08-01", workType: "Brick work", peopleCount: 0,
          wagePerHead: "0", masonCount: 2, masonSalaryAmount: "1300.00",
          helperCount: 3, helperSalaryAmount: "1100.00", otTotalAmount: "800.00",
          workStage: "Basement Level", createdBy: userId },
        { siteId, date: "2026-08-02", workType: "Brick work", peopleCount: 0,
          wagePerHead: "0", masonCount: 1, masonSalaryAmount: "1300.00",
          workStage: "Basement Level", createdBy: userId },
      ]);

      const rows = await getStageComposition(tx, siteId, "Basement Level");

      expect(rows.find((r) => r.name === "Brick work")).toMatchObject({
        otSpend: 800,
        spend: 2600 + 3300 + 800 + 1300,
      });
      expect(rows.find((r) => r.name === "Cement")).toMatchObject({ otSpend: null });
    });
  });

  it("reports no manpower for material rows or ordinary people-count labour", async () => {
    await withRollback(async (tx) => {
      const { userId, siteId } = await seedSite(tx);
      await tx.insert(materialEntries).values({
        siteId, date: "2026-08-01", materialType: "Cement", quantity: "10",
        unit: "Bag", workStage: "Roof Level", cost: "5000", createdBy: userId,
      });
      await tx.insert(labourEntries).values({
        siteId, date: "2026-08-01", workType: "Steel work", peopleCount: 3,
        wagePerHead: "1000", workStage: "Roof Level", createdBy: userId,
      });

      const rows = await getStageComposition(tx, siteId, "Roof Level");

      // Material has no manpower columns at all.
      expect(rows.find((r) => r.name === "Cement")).toMatchObject({
        masonCount: null, masonSalary: null, helperCount: null, helperSalary: null,
      });
      // Labour on the ordinary path has the columns, but nobody in either role.
      expect(rows.find((r) => r.name === "Steel work")).toMatchObject({
        masonCount: 0, masonSalary: 0, helperCount: 0, helperSalary: 0, headCount: 3,
      });
    });
  });

  it("applies the legacy cut to manpower exactly as it does to spend", async () => {
    await withRollback(async (tx) => {
      const { userId, siteId } = await seedSite(tx);
      await tx.insert(labourEntries).values([
        { siteId, date: "2026-02-01", workType: "Brick work", peopleCount: 0,
          wagePerHead: "0", masonCount: 1, masonSalaryAmount: "1000.00",
          workStage: null, createdBy: userId,
          createdAt: new Date("2026-07-01T00:00:00Z") },
        { siteId, date: "2026-08-01", workType: "Brick work", peopleCount: 0,
          wagePerHead: "0", masonCount: 2, masonSalaryAmount: "1000.00",
          workStage: null, createdBy: userId,
          createdAt: new Date("2026-08-01T00:00:00Z") },
      ]);

      expect(await getStageComposition(tx, siteId, null)).toMatchObject([
        { masonCount: 2, masonSalary: 2000 },
      ]);
      expect(await getStageComposition(tx, siteId, null, { legacy: true })).toMatchObject([
        { masonCount: 1, masonSalary: 1000 },
      ]);
    });
  });

  it("treats a stage name containing SQL metacharacters as a literal", async () => {
    await withRollback(async (tx) => {
      const { userId, siteId } = await seedSite(tx);
      await tx.insert(labourEntries).values({
        siteId, date: "2026-08-01", workType: "Mason", peopleCount: 1,
        wagePerHead: "700", workStage: "Roof Level", createdBy: userId,
      });
      // If this were interpolated rather than bound, the OR would match everything.
      expect(await getStageComposition(tx, siteId, "' OR 1=1 --")).toEqual([]);
    });
  });
});

// Driver-level mapping, no database: postgres returns numerics as strings, and
// the material arm selects SQL NULL for every manpower column. Both have to
// survive the trip into StageCompositionRow with their meaning intact — null
// ("this row has no roles") must not collapse into 0 ("both roles are empty").
describe("getStageComposition row mapping", () => {
  const stubExecutor = (rows: unknown[]) => ({ execute: async () => rows });

  it("coerces numeric strings and preserves null manpower separately from zero", async () => {
    const rows = await getStageComposition(
      stubExecutor([
        { entry_type: "material", name: "Cement", entry_count: "2", quantity: "275",
          unit: "Bag", head_count: null, spend: "88000",
          mason_count: null, mason_salary: null, helper_count: null, helper_salary: null,
          ot_spend: null },
        { entry_type: "labour", name: "Brick work", entry_count: "2", quantity: null,
          unit: null, head_count: "0", spend: "10700",
          mason_count: "4", mason_salary: "5200", helper_count: "5", helper_salary: "5500",
          ot_spend: "0" },
      ]),
      "11111111-1111-1111-1111-111111111111",
      "Basement Level",
    );

    expect(rows[0]).toMatchObject({
      entryType: "material", quantity: 275, spend: 88000,
      masonCount: null, masonSalary: null, helperCount: null, helperSalary: null, otSpend: null,
    });
    expect(rows[1]).toMatchObject({
      entryType: "labour", spend: 10700,
      masonCount: 4, masonSalary: 5200, helperCount: 5, helperSalary: 5500, otSpend: 0,
    });
  });
});

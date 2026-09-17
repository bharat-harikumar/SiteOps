import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { siteOperationSummary } from "@/lib/db/queries/entries";
import { calculateSiteTrackedSpend } from "@/lib/db/queries/operationTotals";
import { searchRemarks } from "@/lib/db/queries/search";
import { getSiteTrackedSpend, siteTrackedSpend } from "@/lib/db/queries/sites";
import { labourSpend } from "@/lib/services/labourSpend";
import { describeDb, seedSite, withRollback } from "@/lib/db/testing";
import {
  expenseEntries,
  labourEntries,
  machineryEntries,
  materialEntries,
} from "@/lib/db/schema";

describe("siteTrackedSpend with OT (unit)", () => {
  it("includes OT in calculateSiteTrackedSpend", () => {
    const total = calculateSiteTrackedSpend({
      labour: [
        { peopleCount: 3, wagePerHead: "1300.00", salaryAmount: "3900.00", otTotalAmount: "400.00" },
        { masonCount: 2, masonSalaryAmount: "1000.00", helperCount: 2, helperSalaryAmount: "500.00", otTotalAmount: "450.00" },
      ],
      material: [{ cost: "300.50" }],
      machinery: [{ totalCost: "750.00" }],
      expense: [{ amount: "40.00" }],
    });
    // labour: (3900 + 400) + (3000 + 450) = 7750
    // material: 300.50, machinery: 750, expense: 40
    // total = 7750 + 300.50 + 750 + 40 = 8840.50
    expect(total).toBeCloseTo(8840.5, 2);
  });
});

describeDb("siteTrackedSpend", () => {
  it("SQL total matches the row-based calculateSiteTrackedSpend", async () => {
    await withRollback(async (tx) => {
      const { userId, siteId } = await seedSite(tx);
      await tx.insert(labourEntries).values([
        { siteId, createdBy: userId, date: "2026-06-22", workType: "A", peopleCount: 2, wagePerHead: "500.00" },
        { siteId, createdBy: userId, date: "2026-06-22", workType: "A", peopleCount: 1, salaryAmount: "1200.00" },
        { siteId, createdBy: userId, date: "2026-06-22", workType: "A", peopleCount: 0, masonCount: 2, masonSalaryAmount: "300.00", helperCount: 3, helperSalaryAmount: "200.00" },
        { siteId, createdBy: userId, date: "2026-06-22", workType: "A", peopleCount: 2, wagePerHead: "500.00", salaryAmount: "1000.00", otTotalAmount: "400.00" },
      ]);
      await tx.insert(materialEntries).values([
        { siteId, createdBy: userId, date: "2026-06-22", materialType: "M", quantity: "1", cost: "300.50" },
      ]);
      await tx.insert(machineryEntries).values([
        { siteId, createdBy: userId, date: "2026-06-22", equipmentType: "E", count: 1, totalCost: "750.00" },
      ]);
      await tx.insert(expenseEntries).values([
        { siteId, createdBy: userId, date: "2026-06-22", category: "Misc", description: "x", amount: "40.00" },
      ]);

      const [labour, material, machinery, expense] = await Promise.all([
        tx.select().from(labourEntries).where(eq(labourEntries.siteId, siteId)),
        tx.select().from(materialEntries).where(eq(materialEntries.siteId, siteId)),
        tx.select().from(machineryEntries).where(eq(machineryEntries.siteId, siteId)),
        tx.select().from(expenseEntries).where(eq(expenseEntries.siteId, siteId)),
      ]);
      const expected = calculateSiteTrackedSpend({ labour, material, machinery, expense });

      const actual = Number(await siteTrackedSpend(tx, siteId));

      expect(actual).toBeCloseTo(expected, 2);
      // labour (2*500 + 1200 + (2*300 + 3*200) + (1000 + 400)) + material 300.50 + machinery 750 + expense 40 = 5890.50
      expect(actual).toBeCloseTo(5890.5, 2);
    });
  });

  it("returns '0' for an unknown site", async () => {
    const total = await getSiteTrackedSpend("00000000-0000-0000-0000-000000000000");
    expect(total).toBe("0");
  });
});

// SQL↔TS parity. Three SQL copies of the labour precedence exist
// (entries.ts labourSpendExpr, sites.ts siteTrackedSpend, search.ts). A change
// to one that is not mirrored in labourSpend() makes list totals silently
// disagree with summary totals. This inserts rows exercising every precedence
// branch and asserts each SQL sum equals the TS sum.
describeDb("labour spend SQL/TS parity", () => {
  const DATE = "2026-06-23";

  // A: split wins over both the stored salary and people × wage, and each role
  //    costs count × per-person wage
  // B: no split -> stored salary wins over people × wage
  // C: nothing stored -> people × wage
  // D: split columns explicitly 0 -> must fall through to the stored salary,
  //    NOT report 0. This is exactly where a naive `> 0` SQL check and a naive
  //    TS truthiness check diverge.
  // E: nothing to compute from -> 0
  // F: a per-person wage with no head count -> 0, in SQL as well as in TS. The
  //    multiplication has to be inside the WHEN guard too, or SQL reports the
  //    bare wage here while TS reports 0.
  // G: regular labour + OT lump sum -> regular salary + ot_total_amount
  // H: split labour + OT lump sum -> split cost + ot_total_amount (one amount
  //    covering masons and helpers together)
  const rowsFor = (siteId: string, userId: string) => [
    { siteId, createdBy: userId, date: DATE, workType: "A", peopleCount: 10, wagePerHead: "1000.00", salaryAmount: "999.00", masonCount: 2, masonSalaryAmount: "5000.00", helperCount: 3, helperSalaryAmount: "3000.00" },
    { siteId, createdBy: userId, date: DATE, workType: "B", peopleCount: 10, wagePerHead: "1000.00", salaryAmount: "12345.00" },
    { siteId, createdBy: userId, date: DATE, workType: "C", peopleCount: 4, wagePerHead: "600.00" },
    { siteId, createdBy: userId, date: DATE, workType: "D", peopleCount: 0, masonCount: 0, masonSalaryAmount: "0.00", helperCount: 0, helperSalaryAmount: "0.00", salaryAmount: "7000.00" },
    { siteId, createdBy: userId, date: DATE, workType: "E", peopleCount: 0 },
    { siteId, createdBy: userId, date: DATE, workType: "F", peopleCount: 0, masonCount: 0, masonSalaryAmount: "1500.00" },
    { siteId, createdBy: userId, date: DATE, workType: "G", peopleCount: 3, wagePerHead: "1000.00", salaryAmount: "3000.00", otTotalAmount: "400.00" },
    { siteId, createdBy: userId, date: DATE, workType: "H", peopleCount: 0, masonCount: 2, masonSalaryAmount: "1000.00", helperCount: 2, helperSalaryAmount: "500.00", otTotalAmount: "450.00" },
  ];

  const EXPECTED = 19000 + 12345 + 2400 + 7000 + 0 + 0 + 3400 + 3450;

  it("siteOperationSummary's labour spend equals sum(labourSpend(row))", async () => {
    await withRollback(async (tx) => {
      const { userId, siteId } = await seedSite(tx);
      await tx.insert(labourEntries).values(rowsFor(siteId, userId));

      const rows = await tx.select().from(labourEntries).where(eq(labourEntries.siteId, siteId));
      const tsTotal = rows.reduce((sum, row) => sum + labourSpend(row), 0);
      expect(tsTotal).toBeCloseTo(EXPECTED, 2);

      const summary = await siteOperationSummary(tx, siteId, DATE);
      expect(Number(summary.labour.todaySpend)).toBeCloseTo(tsTotal, 2);
      expect(Number(summary.labour.totalSpend)).toBeCloseTo(tsTotal, 2);
      // OT is also reported on its own, and is already inside the spend above.
      expect(summary.labour.todayOtSpend).toBeCloseTo(850, 2);
      expect(summary.labour.totalOtSpend).toBeCloseTo(850, 2);
    });
  });

  it("siteTrackedSpend's labour SQL equals sum(labourSpend(row))", async () => {
    await withRollback(async (tx) => {
      const { userId, siteId } = await seedSite(tx);
      await tx.insert(labourEntries).values(rowsFor(siteId, userId));

      const rows = await tx.select().from(labourEntries).where(eq(labourEntries.siteId, siteId));
      const tsTotal = rows.reduce((sum, row) => sum + labourSpend(row), 0);

      expect(Number(await siteTrackedSpend(tx, siteId))).toBeCloseTo(tsTotal, 2);
    });
  });

  it("search's labour amount column equals labourSpend(row) per row", async () => {
    await withRollback(async (tx) => {
      const { userId, siteId } = await seedSite(tx);
      await tx.insert(labourEntries).values(
        rowsFor(siteId, userId).map((row) => ({ ...row, remarks: `parity ${row.workType}` })),
      );

      const rows = await tx.select().from(labourEntries).where(eq(labourEntries.siteId, siteId));
      const { hits } = await searchRemarks({
        q: "parity",
        limit: 50,
        offset: 0,
        scope: { isAdmin: true, siteIds: [] },
        tx,
      });
      const byId = new Map(
        hits
          .filter((hit) => hit.source === "labour")
          .map((hit) => [hit.entryId, Number(hit.amount ?? 0)]),
      );

      expect(byId.size).toBe(rows.length);
      for (const row of rows) {
        expect(byId.get(row.labourEntryId), row.workType ?? "")
          .toBeCloseTo(labourSpend(row), 2);
      }
    });
  });
});

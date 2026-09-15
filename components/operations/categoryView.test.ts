import { describe, expect, it } from "vitest";
import {
  buildCategorySummaries,
  entryMatchesSearch,
  buildGroupedRows,
  entrySuccessDestination,
  buildMaterialQuantitySummary,
} from "./categoryView";

const m = (over: Record<string, unknown>) => ({
  materialEntryId: Math.random().toString(), materialType: "Metals", workStage: "Foundation",
  quantity: "1", cost: "100", date: "2026-07-10", createdAt: "2026-07-10T00:00:00Z", ...over,
});

describe("buildCategorySummaries", () => {
  it("groups material by materialType (ignores work-stage) with count/spend/last-activity", () => {
    const entries = [
      m({ materialType: "Metals", cost: "100", date: "2026-07-10" }),
      m({ materialType: "Metals", workStage: "Slab", cost: "50", date: "2026-07-12" }),
      m({ materialType: "Cement", cost: "30", date: "2026-07-11" }),
    ];
    const out = buildCategorySummaries(entries as any, "material");
    const metals = out.find((c) => c.key === "Metals")!;
    expect(metals.count).toBe(2);
    expect(metals.totalSpend).toBe(150);
    expect(metals.lastActivity).toBe("2026-07-12");
    expect(out.map((c) => c.key).sort()).toEqual(["Cement", "Metals"]);
  });
});

describe("entryMatchesSearch", () => {
  it("matches remarks case-insensitively", () => {
    expect(entryMatchesSearch(m({ remarks: "Site A delivery" }) as any, "material", "delivery")).toBe(true);
  });
  it("matches amount as text", () => {
    expect(entryMatchesSearch(m({ cost: "1500" }) as any, "material", "1500")).toBe(true);
  });
  it("empty query matches everything", () => {
    expect(entryMatchesSearch(m({}) as any, "material", "")).toBe(true);
  });
  it("non-match returns false", () => {
    expect(entryMatchesSearch(m({ remarks: "abc", cost: "10" }) as any, "material", "zzz")).toBe(false);
  });
});

describe("buildGroupedRows", () => {
  it("renders each entry as its own independent card for every spend type", () => {
    const entries = [
      { expenseEntryId: "e1", category: "Materials", amount: "100", date: "2026-07-10", createdAt: "2026-07-10T01:00:00Z" },
      { expenseEntryId: "e2", category: "Materials", amount: "200", date: "2026-07-10", createdAt: "2026-07-10T02:00:00Z" },
    ];
    const { groupedRows, totalSpend } = buildGroupedRows(entries as any, "expense", "newest");
    const day = groupedRows.find((g) => g.date === "2026-07-10")!;
    expect(day.rows).toHaveLength(2);          // NOT visually merged
    expect(day.rows.every((r) => r.editable)).toBe(true);
    expect(totalSpend).toBe(300);
  });
});

describe("entrySuccessDestination", () => {
  it("routes a created material to its category detail with highlight", () => {
    const entry = { materialEntryId: "m1", materialType: "Ready Mix" };
    expect(entrySuccessDestination(entry as any, "material", "s1")).toBe(
      "/app/sites/s1/operations/material/Ready%20Mix?highlight=m1",
    );
  });
  it("routes expense by category", () => {
    const entry = { expenseEntryId: "e1", category: "Materials" };
    expect(entrySuccessDestination(entry as any, "expense", "s1")).toBe(
      "/app/sites/s1/operations/expense/Materials?highlight=e1",
    );
  });
  it("falls back to site page when siteId missing", () => {
    expect(entrySuccessDestination({} as any, "expense", "")).toBe("/app/dashboard");
  });
});

describe("buildMaterialQuantitySummary", () => {
  it("returns safe empty result for empty entries", () => {
    const result = buildMaterialQuantitySummary([]);
    expect(result).toEqual({
      totalQuantity: null,
      formattedQuantity: null,
      unit: null,
      isMixed: false,
      displayText: null,
    });
  });

  it("handles a single entry with unit", () => {
    const entries = [m({ quantity: "25.00", unit: "BAG" })];
    const result = buildMaterialQuantitySummary(entries as any);
    expect(result).toEqual({
      totalQuantity: 25,
      formattedQuantity: "25.00",
      unit: "BAG",
      isMixed: false,
      displayText: "25.00 BAG",
    });
  });

  it("sums multiple same-unit entries with exact 2-decimal formatting", () => {
    const entries = [
      m({ quantity: "25", unit: "BAG" }),
      m({ quantity: "50", unit: "BAG" }),
      m({ quantity: 100, unit: "BAG" }),
    ];
    const result = buildMaterialQuantitySummary(entries as any);
    expect(result).toEqual({
      totalQuantity: 175,
      formattedQuantity: "175.00",
      unit: "BAG",
      isMixed: false,
      displayText: "175.00 BAG",
    });
  });

  it("handles decimal precision without floating point inaccuracies", () => {
    const entries = [
      m({ quantity: "12.25", unit: "M³" }),
      m({ quantity: "0.25", unit: "M³" }),
    ];
    const result = buildMaterialQuantitySummary(entries as any);
    expect(result).toEqual({
      totalQuantity: 12.5,
      formattedQuantity: "12.50",
      unit: "M³",
      isMixed: false,
      displayText: "12.50 M³",
    });
  });

  it("formats very small quantities with 2 decimals", () => {
    const entries = [
      m({ quantity: "0.01", unit: "BAG" }),
      m({ quantity: "0.01", unit: "BAG" }),
    ];
    const result = buildMaterialQuantitySummary(entries as any);
    expect(result.displayText).toBe("0.02 BAG");
  });

  it("safely detects mixed units and returns MIXED UNITS without combining quantities", () => {
    const entries = [
      m({ quantity: "10", unit: "BAG" }),
      m({ quantity: "20", unit: "BAG" }),
      m({ quantity: "5", unit: "KG" }),
    ];
    const result = buildMaterialQuantitySummary(entries as any);
    expect(result).toEqual({
      totalQuantity: null,
      formattedQuantity: null,
      unit: null,
      isMixed: true,
      displayText: "MIXED UNITS",
    });
  });

  it("normalizes units consistently according to displayUnitName behavior", () => {
    // Bag, BAG, bag are treated as the same unit and not flagged as mixed
    const entries = [
      m({ quantity: "25", unit: "Bag" }),
      m({ quantity: "50", unit: "BAG" }),
      m({ quantity: "100", unit: "bag" }),
    ];
    const result = buildMaterialQuantitySummary(entries as any);
    expect(result.isMixed).toBe(false);
    expect(result.totalQuantity).toBe(175);
    expect(result.formattedQuantity).toBe("175.00");
    expect(result.displayText).toBe("175.00 Bag");
  });

  it("normalizes display overrides like kg and kilogram to KG", () => {
    const entries = [
      m({ quantity: "10", unit: "kg" }),
      m({ quantity: "15", unit: "kilogram" }),
    ];
    const result = buildMaterialQuantitySummary(entries as any);
    expect(result.isMixed).toBe(false);
    expect(result.totalQuantity).toBe(25);
    expect(result.unit).toBe("KG");
    expect(result.displayText).toBe("25.00 KG");
  });

  it("protects against invalid numeric values without producing NaN or Infinity", () => {
    const entries = [
      m({ quantity: "invalid", unit: "BAG" }),
      m({ quantity: NaN, unit: "BAG" }),
      m({ quantity: Infinity, unit: "BAG" }),
      m({ quantity: -10, unit: "BAG" }),
      m({ quantity: null, unit: "BAG" }),
    ];
    const result = buildMaterialQuantitySummary(entries as any);
    expect(result.displayText).toBeNull();
    expect(result.totalQuantity).toBeNull();
  });

  it("safely sums valid entries while ignoring invalid ones", () => {
    const entries = [
      m({ quantity: "25", unit: "BAG" }),
      m({ quantity: "invalid", unit: "BAG" }),
      m({ quantity: null, unit: "BAG" }),
    ];
    const result = buildMaterialQuantitySummary(entries as any);
    expect(result).toEqual({
      totalQuantity: 25,
      formattedQuantity: "25.00",
      unit: "BAG",
      isMixed: false,
      displayText: "25.00 BAG",
    });
  });

  it("handles missing/empty unit gracefully without crashing or showing undefined/null", () => {
    const entries = [
      m({ quantity: "25", unit: "" }),
      m({ quantity: "50", unit: null }),
    ];
    const result = buildMaterialQuantitySummary(entries as any);
    expect(result.isMixed).toBe(false);
    expect(result.totalQuantity).toBe(75);
    expect(result.formattedQuantity).toBe("75.00");
    expect(result.displayText).toBe("75.00");
  });

  it("flags mixed units if some entries have a unit and others have empty unit", () => {
    const entries = [
      m({ quantity: "25", unit: "BAG" }),
      m({ quantity: "50", unit: "" }),
    ];
    const result = buildMaterialQuantitySummary(entries as any);
    expect(result.isMixed).toBe(true);
    expect(result.displayText).toBe("MIXED UNITS");
  });

  it("returns null displayText when all quantities are zero", () => {
    const entries = [
      m({ quantity: "0", unit: "BAG" }),
      m({ quantity: 0, unit: "BAG" }),
    ];
    const result = buildMaterialQuantitySummary(entries as any);
    expect(result.displayText).toBeNull();
    expect(result.totalQuantity).toBeNull();
  });

  it("updates correctly with search-filtered entries", () => {
    const allEntries = [
      m({ quantity: "25", unit: "BAG", remarks: "supplier A" }),
      m({ quantity: "50", unit: "BAG", remarks: "supplier B" }),
    ];
    // Filter simulating active search
    const filtered = allEntries.filter((e) => entryMatchesSearch(e as any, "material", "supplier A"));
    const result = buildMaterialQuantitySummary(filtered as any);
    expect(result.displayText).toBe("25.00 BAG");
    expect(result.totalQuantity).toBe(25);
  });
});


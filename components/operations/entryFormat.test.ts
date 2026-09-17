import { describe, expect, it } from "vitest";

import { buildCombinedRows, computeCappedTypes, formatQuantityTotals, swapDateRangeIfInverted } from "./entryFormat";

const grouped = {
  labour: [
    { labourEntryId: "l1", date: "2026-07-01", salaryAmount: "1000.00" },
    { labourEntryId: "l2", date: "2026-07-02", salaryAmount: "500.00" },
  ],
  material: [
    { materialEntryId: "m1", date: "2026-07-01", cost: "300.00" },
  ],
  machinery: [] as Array<Record<string, any>>,
  expense: [
    { expenseEntryId: "e1", date: "2026-07-03", amount: "40.00" },
  ],
};

describe("buildCombinedRows", () => {
  it("flattens all 4 spend types into one array with type/id/date/spend", () => {
    const rows = buildCombinedRows(grouped);
    expect(rows).toHaveLength(4);
    expect(rows).toContainEqual(expect.objectContaining({ type: "labour", id: "l1", date: "2026-07-01", spend: 1000 }));
    expect(rows).toContainEqual(expect.objectContaining({ type: "labour", id: "l2", date: "2026-07-02", spend: 500 }));
    expect(rows).toContainEqual(expect.objectContaining({ type: "material", id: "m1", date: "2026-07-01", spend: 300 }));
    expect(rows).toContainEqual(expect.objectContaining({ type: "expense", id: "e1", date: "2026-07-03", spend: 40 }));
  });

  it("never includes an incident row (excluded type entirely)", () => {
    const rows = buildCombinedRows(grouped);
    const types: string[] = rows.map((row) => row.type);
    expect(types).not.toContain("incident");
  });

  it("returns an empty array when every spend type is empty", () => {
    expect(buildCombinedRows({ labour: [], material: [], machinery: [], expense: [] })).toEqual([]);
  });
});

describe("computeCappedTypes", () => {
  it("returns spend types whose list length equals the cap", () => {
    const capped = computeCappedTypes({ labour: [{}, {}], material: [{}], machinery: [], expense: [{}, {}] }, 2);
    expect(capped.sort()).toEqual(["expense", "labour"]);
  });

  it("returns an empty array when no type hits the cap", () => {
    const capped = computeCappedTypes({ labour: [{}], material: [], machinery: [], expense: [] }, 200);
    expect(capped).toEqual([]);
  });
});

describe("swapDateRangeIfInverted", () => {
  it("swaps from/to when from is after to (E3)", () => {
    expect(swapDateRangeIfInverted("2026-07-10", "2026-07-01")).toEqual({
      from: "2026-07-01",
      to: "2026-07-10",
      swapped: true,
    });
  });

  it("leaves an ordered range untouched", () => {
    expect(swapDateRangeIfInverted("2026-07-01", "2026-07-10")).toEqual({
      from: "2026-07-01",
      to: "2026-07-10",
      swapped: false,
    });
  });

  it("does not swap when either bound is empty (open-ended range)", () => {
    expect(swapDateRangeIfInverted("", "2026-07-10")).toEqual({ from: "", to: "2026-07-10", swapped: false });
    expect(swapDateRangeIfInverted("2026-07-10", "")).toEqual({ from: "2026-07-10", to: "", swapped: false });
    expect(swapDateRangeIfInverted("", "")).toEqual({ from: "", to: "", swapped: false });
  });

  it("leaves an equal from/to range untouched", () => {
    expect(swapDateRangeIfInverted("2026-07-10", "2026-07-10")).toEqual({
      from: "2026-07-10",
      to: "2026-07-10",
      swapped: false,
    });
  });
});

describe("renderEntrySummary — labour overtime", () => {
  async function labourHtml(entry: Record<string, unknown>) {
    const { renderToStaticMarkup } = await import("react-dom/server");
    const { renderEntrySummary } = await import("./entryFormat");
    return renderToStaticMarkup(renderEntrySummary({ workType: "General", peopleCount: 2, wagePerHead: "600", ...entry }, "labour"));
  }

  it("shows the OT lump sum on its own line", async () => {
    const html = await labourHtml({ otTotalAmount: "400.00" });
    expect(html).toContain("OT: <span");
    expect(html).toContain("₹400");
  });

  it("says the amount covers masons and helpers on split labour", async () => {
    const html = await labourHtml({
      workType: "Plastering", peopleCount: 0, masonCount: 2, masonSalaryAmount: "1000",
      helperCount: 1, helperSalaryAmount: "500", otTotalAmount: "300.00",
    });
    expect(html).toContain("OT (masons + helpers): <span");
  });

  it("includes OT in the entry total", async () => {
    const html = await labourHtml({ otTotalAmount: "400.00" });
    expect(html).toContain("₹1,600");
  });

  it("hides the OT line when there is no OT, a zero amount, or a non-numeric value", async () => {
    for (const otTotalAmount of [undefined, null, "0", "0.00", "abc"]) {
      const html = await labourHtml({ otTotalAmount });
      expect(html).not.toContain("OT");
      expect(html).not.toContain("NaN");
    }
  });
});

describe("formatQuantityTotals", () => {
  it("returns null when there is nothing to show", () => {
    expect(formatQuantityTotals([])).toBeNull();
  });

  it("shows a single unit plainly", () => {
    expect(formatQuantityTotals([{ unit: "BAG", total: 175 }])).toBe("175.00 BAG");
  });

  it("lists each unit side by side", () => {
    expect(formatQuantityTotals([{ unit: "BAG", total: 120 }, { unit: "KG", total: 5 }])).toBe("120.00 BAG · 5.00 KG");
  });

  it("marks a unit-less group only when other units are present", () => {
    expect(formatQuantityTotals([{ unit: null, total: 75 }])).toBe("75.00");
    expect(formatQuantityTotals([{ unit: "BAG", total: 25 }, { unit: null, total: 5 }])).toBe("25.00 BAG · 5.00 (no unit)");
  });

  it("caps the list and says how many more there are", () => {
    const totals = [
      { unit: "BAG", total: 4 }, { unit: "KG", total: 3 }, { unit: "CFT", total: 2 }, { unit: "Tonne", total: 1 },
    ];
    expect(formatQuantityTotals(totals)).toBe("4.00 BAG · 3.00 KG · 2.00 CFT +1 more");
  });
});


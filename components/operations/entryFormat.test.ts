import { describe, expect, it } from "vitest";

import { buildCombinedRows, computeCappedTypes, swapDateRangeIfInverted } from "./entryFormat";

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
  it("renders OT breakdown when all OT fields are valid and positive", async () => {
    const { renderToStaticMarkup } = await import("react-dom/server");
    const { renderEntrySummary } = await import("./entryFormat");
    const jsx = renderEntrySummary({
      workType: "General",
      peopleCount: 2,
      wagePerHead: "600",
      otPeopleCount: 2,
      otHours: "2",
      otRate: "100",
      otTotalAmount: "400.00",
    }, "labour");
    const html = renderToStaticMarkup(jsx);
    expect(html).toContain("OT: 2 people × 2 hrs");
    expect(html).toContain("₹400");
  });

  it("renders singular 'person' when otPeopleCount is 1", async () => {
    const { renderToStaticMarkup } = await import("react-dom/server");
    const { renderEntrySummary } = await import("./entryFormat");
    const jsx = renderEntrySummary({
      workType: "General",
      peopleCount: 1,
      wagePerHead: "600",
      otPeopleCount: 1,
      otHours: "3",
      otRate: "150",
      otTotalAmount: "450.00",
    }, "labour");
    const html = renderToStaticMarkup(jsx);
    expect(html).toContain("OT: 1 person × 3 hrs");
    expect(html).toContain("₹450");
  });

  it("does not render OT breakdown when OT fields are absent", async () => {
    const { renderToStaticMarkup } = await import("react-dom/server");
    const { renderEntrySummary } = await import("./entryFormat");
    const jsx = renderEntrySummary({
      workType: "General",
      peopleCount: 2,
      wagePerHead: "600",
    }, "labour");
    const html = renderToStaticMarkup(jsx);
    expect(html).not.toContain("OT:");
  });

  it("suppresses OT breakdown when otTotalAmount is present but triad is missing or null", async () => {
    const { renderToStaticMarkup } = await import("react-dom/server");
    const { renderEntrySummary } = await import("./entryFormat");
    const jsx = renderEntrySummary({
      workType: "General",
      peopleCount: 2,
      wagePerHead: "600",
      otTotalAmount: "500.00",
    }, "labour");
    const html = renderToStaticMarkup(jsx);
    expect(html).not.toContain("OT:");
    expect(html).not.toContain("0 people");
  });

  it("suppresses OT breakdown on partial triad (missing hours or rate)", async () => {
    const { renderToStaticMarkup } = await import("react-dom/server");
    const { renderEntrySummary } = await import("./entryFormat");
    const jsx = renderEntrySummary({
      workType: "General",
      peopleCount: 2,
      wagePerHead: "600",
      otPeopleCount: 2,
      otHours: null,
      otRate: "100",
      otTotalAmount: "200.00",
    }, "labour");
    const html = renderToStaticMarkup(jsx);
    expect(html).not.toContain("OT:");
  });

  it("suppresses OT breakdown when otTotalAmount is missing even if triad is present", async () => {
    const { renderToStaticMarkup } = await import("react-dom/server");
    const { renderEntrySummary } = await import("./entryFormat");
    const jsx = renderEntrySummary({
      workType: "General",
      peopleCount: 2,
      wagePerHead: "600",
      otPeopleCount: 2,
      otHours: "2",
      otRate: "100",
      otTotalAmount: null,
    }, "labour");
    const html = renderToStaticMarkup(jsx);
    expect(html).not.toContain("OT:");
  });

  it("suppresses OT breakdown and never renders NaN or ₹NaN when values are non-numeric", async () => {
    const { renderToStaticMarkup } = await import("react-dom/server");
    const { renderEntrySummary } = await import("./entryFormat");
    const jsx = renderEntrySummary({
      workType: "General",
      peopleCount: 2,
      wagePerHead: "600",
      otPeopleCount: "invalid",
      otHours: "abc",
      otRate: "xyz",
      otTotalAmount: "invalid",
    }, "labour");
    const html = renderToStaticMarkup(jsx);
    expect(html).not.toContain("OT:");
    expect(html).not.toContain("NaN");
  });

  it("suppresses OT breakdown when any OT field is zero or negative", async () => {
    const { renderToStaticMarkup } = await import("react-dom/server");
    const { renderEntrySummary } = await import("./entryFormat");
    for (const corrupt of [
      { otPeopleCount: 0, otHours: "2", otRate: "100", otTotalAmount: "0" },
      { otPeopleCount: 2, otHours: "0", otRate: "100", otTotalAmount: "0" },
      { otPeopleCount: 2, otHours: "2", otRate: "0", otTotalAmount: "0" },
      { otPeopleCount: 2, otHours: "2", otRate: "100", otTotalAmount: "0" },
      { otPeopleCount: -1, otHours: "2", otRate: "100", otTotalAmount: "-200" },
      { otPeopleCount: 2, otHours: "-1", otRate: "100", otTotalAmount: "-200" },
      { otPeopleCount: 2, otHours: "2", otRate: "-100", otTotalAmount: "-400" },
    ]) {
      const jsx = renderEntrySummary({
        workType: "General",
        peopleCount: 2,
        wagePerHead: "600",
        ...corrupt,
      }, "labour");
      const html = renderToStaticMarkup(jsx);
      expect(html).not.toContain("OT:");
    }
  });
});


import { describe, expect, it } from "vitest";

import { mapEntryToFormValues } from "./mapEntryToFormValues";

const categoryId = "cat-1";

describe("mapEntryToFormValues — workStage prefill", () => {
  it("prefills workStage for labour when set", () => {
    const values = mapEntryToFormValues({ workStage: "Roof Level" }, "labour", categoryId);
    expect(values.workStage).toBe("Roof Level");
  });

  it("prefills workStage as empty string for labour when null", () => {
    const values = mapEntryToFormValues({ workStage: null }, "labour", categoryId);
    expect(values.workStage).toBe("");
  });

  it("prefills workStage for machinery when set", () => {
    const values = mapEntryToFormValues({ workStage: "Roof Level" }, "machinery", categoryId);
    expect(values.workStage).toBe("Roof Level");
  });

  it("prefills workStage for expense when set", () => {
    const values = mapEntryToFormValues({ workStage: "Roof Level" }, "expense", categoryId);
    expect(values.workStage).toBe("Roof Level");
  });
});

describe("mapEntryToFormValues — overtime prefill", () => {
  it("prefills OT as disabled and empty strings when OT is not present", () => {
    const values = mapEntryToFormValues(
      { peopleCount: 5, wagePerHead: "600" },
      "labour",
      categoryId,
    );
    expect(values.otEnabled).toBe(false);
    expect(values.otPeopleCount).toBe("");
    expect(values.otHours).toBe("");
    expect(values.otRate).toBe("");
    expect(values.otTotalAmount).toBe("");
  });

  it("prefills OT as enabled with stringified values when OT fields exist", () => {
    const values = mapEntryToFormValues(
      {
        peopleCount: 5,
        wagePerHead: "600",
        otPeopleCount: 2,
        otHours: "2.50",
        otRate: "100.00",
        otTotalAmount: "500.00",
      },
      "labour",
      categoryId,
    );
    expect(values.otEnabled).toBe(true);
    expect(values.otPeopleCount).toBe("2");
    expect(values.otHours).toBe("2.50");
    expect(values.otRate).toBe("100.00");
    expect(values.otTotalAmount).toBe("500.00");
  });

  it("detects otEnabled when any OT field is populated", () => {
    const values = mapEntryToFormValues(
      { otTotalAmount: "400.00" },
      "labour",
      categoryId,
    );
    expect(values.otEnabled).toBe(true);
  });
});


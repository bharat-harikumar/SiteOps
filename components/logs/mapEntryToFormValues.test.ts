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
  it("starts with OT off and an empty box when the entry has no OT", () => {
    const values = mapEntryToFormValues({ peopleCount: 5, wagePerHead: "600" }, "labour", categoryId);
    expect(values.otEnabled).toBe(false);
    expect(values.otTotalAmount).toBe("");
  });

  it("starts with OT on and the saved amount when the entry has OT", () => {
    const values = mapEntryToFormValues({ otTotalAmount: "500.00" }, "labour", categoryId);
    expect(values.otEnabled).toBe(true);
    expect(values.otTotalAmount).toBe("500.00");
  });

  it("does not prefill the reserved people/hours/rate fields", () => {
    const values = mapEntryToFormValues(
      { otTotalAmount: "500.00", otPeopleCount: 2, otHours: "2", otRate: "100" },
      "labour",
      categoryId,
    );
    expect(values).not.toHaveProperty("otPeopleCount");
    expect(values).not.toHaveProperty("otHours");
    expect(values).not.toHaveProperty("otRate");
  });
});

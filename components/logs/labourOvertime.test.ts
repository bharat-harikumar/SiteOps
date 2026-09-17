import { describe, expect, it } from "vitest";

import { ENTRY_FIELD_CONSTRAINTS } from "@/lib/entryTypes/constraints";

import { OT_AMOUNT_FIELD, overtimeHint, overtimePayload } from "./labourOvertime";

describe("OT_AMOUNT_FIELD", () => {
  it("takes its bounds from the shared constraints", () => {
    expect(OT_AMOUNT_FIELD).toMatchObject({ name: "otTotalAmount", kind: "number", ...ENTRY_FIELD_CONSTRAINTS.otTotalAmount });
  });
});

describe("overtimeHint", () => {
  it("tells split-labour users the amount covers masons and helpers together", () => {
    expect(overtimeHint(true)).toBe("Total overtime paid for all masons and helpers on this entry.");
  });

  it("tells ordinary labour users the amount covers the whole crew", () => {
    expect(overtimeHint(false)).toBe("Total overtime paid for all workers on this entry.");
  });
});

describe("overtimePayload", () => {
  it("sends the typed amount when OT is on", () => {
    expect(overtimePayload({ otEnabled: true, isEdit: false, hadInitialOt: false, amount: "1250.50" }))
      .toEqual({ otTotalAmount: 1250.5 });
  });

  it("sends nothing on create when OT is off", () => {
    expect(overtimePayload({ otEnabled: false, isEdit: false, hadInitialOt: false, amount: "" })).toEqual({});
  });

  it("clears OT with null when an entry that had OT is saved with OT off", () => {
    expect(overtimePayload({ otEnabled: false, isEdit: true, hadInitialOt: true, amount: "500" }))
      .toEqual({ otTotalAmount: null });
  });

  it("leaves OT untouched when editing an entry that never had OT", () => {
    expect(overtimePayload({ otEnabled: false, isEdit: true, hadInitialOt: false, amount: "" })).toEqual({});
  });
});

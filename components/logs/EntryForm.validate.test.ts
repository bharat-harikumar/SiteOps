import { describe, expect, it } from "vitest";

import { applyWorkStageRequirement, resolveEntryFields, type EntryField } from "./entryFieldRegistry";
import { clearsFieldError, validateEntryValues } from "./EntryForm.validate";

const dateField: EntryField = { name: "date", label: "Date", kind: "date", required: true };
const workTypeField: EntryField = {
  name: "workType", label: "Work Type", kind: "subcategory", required: true, subcategoryHint: "labour",
};
const peopleField: EntryField = {
  name: "peopleCount", label: "People Count", kind: "number", required: true, min: 1, max: 10000, step: 1,
};
const wageField: EntryField = {
  name: "wagePerHead", label: "Per Head Salary", kind: "number", required: true, min: 0.01, step: 0.01,
};
const remarksField: EntryField = { name: "remarks", label: "Remarks", kind: "textarea" };

const base = {
  fields: [dateField, workTypeField, peopleField, wageField, remarksField],
  values: {
    date: "2026-08-06",
    workType: { subcategoryId: "s1", name: "Masonry" },
    peopleCount: "4",
    wagePerHead: "600",
    remarks: "",
  } as Record<string, unknown>,
  siteId: "site-1" as string | null,
  isEdit: false,
  splitLabour: false,
};

describe("validateEntryValues", () => {
  it("returns null when every required field is filled", () => {
    expect(validateEntryValues(base)).toBeNull();
  });

  it("requires a site on create", () => {
    expect(validateEntryValues({ ...base, siteId: null })).toEqual({
      field: "siteId",
      message: "Site is required",
    });
  });

  it("does not require a site on edit", () => {
    expect(validateEntryValues({ ...base, siteId: null, isEdit: true })).toBeNull();
  });

  it("reports the first missing required field by name and label", () => {
    expect(
      validateEntryValues({ ...base, values: { ...base.values, workType: null } }),
    ).toEqual({ field: "workType", message: "Work Type is required" });
  });

  it("treats empty string as missing for scalar fields", () => {
    expect(
      validateEntryValues({ ...base, values: { ...base.values, peopleCount: "" } }),
    ).toEqual({ field: "peopleCount", message: "People Count is required" });
  });

  it("treats null and undefined as missing for scalar fields", () => {
    expect(
      validateEntryValues({ ...base, values: { ...base.values, peopleCount: null } }),
    ).toEqual({ field: "peopleCount", message: "People Count is required" });
    expect(
      validateEntryValues({ ...base, values: { ...base.values, peopleCount: undefined } }),
    ).toEqual({ field: "peopleCount", message: "People Count is required" });
  });

  it("ignores optional fields left blank", () => {
    expect(validateEntryValues({ ...base, values: { ...base.values, remarks: "" } })).toBeNull();
  });

  it("skips peopleCount/wagePerHead when the work type is a split-labour type", () => {
    expect(
      validateEntryValues({
        ...base,
        splitLabour: true,
        values: {
          ...base.values,
          peopleCount: "", wagePerHead: "", masonCount: "3", masonSalaryAmount: "1300",
        },
      }),
    ).toBeNull();
  });

  // A role costs count × per-person salary, so one without the other is free
  // labour or a wage nobody earns. Caught inline rather than as a 400 toast.
  it("requires a split role's count and salary to be filled in together", () => {
    expect(
      validateEntryValues({
        ...base,
        splitLabour: true,
        values: { ...base.values, peopleCount: "", wagePerHead: "", masonCount: "3" },
      }),
    ).toEqual({ field: "masonCount", message: "Mason salary is required when a Mason count is entered" });

    expect(
      validateEntryValues({
        ...base,
        splitLabour: true,
        values: { ...base.values, peopleCount: "", wagePerHead: "", helperSalaryAmount: "1100" },
      }),
    ).toEqual({ field: "masonCount", message: "Helper count is required when a Helper salary is entered" });
  });

  it("requires at least one mason or helper value when split labour is active", () => {
    expect(
      validateEntryValues({
        ...base,
        splitLabour: true,
        values: {
          ...base.values,
          peopleCount: "", wagePerHead: "",
          masonCount: "0", masonSalaryAmount: "0", helperCount: "0", helperSalaryAmount: "0",
        },
      }),
    ).toEqual({ field: "masonCount", message: "Mason or Helper values are required" });
  });

  it("accepts a helper-only split entry", () => {
    expect(
      validateEntryValues({
        ...base,
        splitLabour: true,
        values: { ...base.values, peopleCount: "", wagePerHead: "", helperCount: "2", helperSalaryAmount: "900" },
      }),
    ).toBeNull();
  });
});

describe("work stage validation", () => {
  const base = { siteId: "site-1", isEdit: false, splitLabour: false };

  it("blocks create when Work Stage is empty", () => {
    expect(
      validateEntryValues({
        ...base,
        fields: resolveEntryFields("labour"),
        values: {
          date: "2026-09-05",
          workType: { subcategoryId: "w1", name: "Mason", categoryId: "c1" },
          peopleCount: 2,
          wagePerHead: 700,
          workStage: null,
        },
      }),
    ).toEqual({ field: "workStage", message: "Work Stage is required" });
  });

  it("permits saving a legacy untagged entry", () => {
    expect(
      validateEntryValues({
        ...base,
        isEdit: true,
        fields: applyWorkStageRequirement(resolveEntryFields("labour"), {
          isEdit: true,
          existingWorkStage: null,
          entryCreatedAt: "2026-07-01T00:00:00Z",
        }),
        values: {
          date: "2026-02-04",
          workType: { subcategoryId: "w1", name: "Piling", categoryId: "c1" },
          peopleCount: 1,
          wagePerHead: 40000,
          workStage: null,
        },
      }),
    ).toBeNull();
  });
});

describe("overtime amount validation", () => {
  const withOt = (otTotalAmount: unknown) => ({
    ...base,
    otEnabled: true,
    values: { ...base.values, otTotalAmount },
  });

  it("ignores the OT box when OT is switched off", () => {
    expect(validateEntryValues({ ...base, otEnabled: false, values: { ...base.values, otTotalAmount: "" } })).toBeNull();
    expect(validateEntryValues({ ...base, values: { ...base.values, otTotalAmount: "abc" } })).toBeNull();
  });

  it("requires an amount when OT is switched on", () => {
    expect(validateEntryValues(withOt(""))).toEqual({ field: "otTotalAmount", message: "OT amount is required" });
    expect(validateEntryValues(withOt(undefined))).toEqual({ field: "otTotalAmount", message: "OT amount is required" });
  });

  it("rejects zero, negative, non-numeric and over-cap amounts", () => {
    const outOfRange = { field: "otTotalAmount", message: "OT amount must be between ₹0.01 and ₹99,99,999.99" };
    expect(validateEntryValues(withOt("0"))).toEqual(outOfRange);
    expect(validateEntryValues(withOt("-5"))).toEqual(outOfRange);
    expect(validateEntryValues(withOt("abc"))).toEqual(outOfRange);
    expect(validateEntryValues(withOt("10000000"))).toEqual(outOfRange);
  });

  it("rejects more than 2 decimal places", () => {
    expect(validateEntryValues(withOt("100.555"))).toEqual({
      field: "otTotalAmount",
      message: "OT amount must have at most 2 decimal places",
    });
  });

  it("accepts a valid amount", () => {
    expect(validateEntryValues(withOt("1250.50"))).toBeNull();
    expect(validateEntryValues(withOt("9999999.99"))).toBeNull();
  });
});

describe("clearsFieldError", () => {
  it("clears an error when the field it points at is edited", () => {
    expect(clearsFieldError("otTotalAmount", "otTotalAmount")).toBe(true);
  });

  it("keeps an OT error when a different field is edited", () => {
    expect(clearsFieldError("otTotalAmount", "remarks")).toBe(false);
  });

  it("clears the split-labour aggregate error on any edit, as before", () => {
    expect(clearsFieldError("masonCount", "helperSalaryAmount")).toBe(true);
  });
});

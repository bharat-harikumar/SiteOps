import { describe, expect, it } from "vitest";

import {
  entryDateSchema,
  expenseEntrySchema,
  incidentEntrySchema,
  labourEntrySchema,
  labourSplitWorkTypes,
  machineryEntrySchema,
  materialEntrySchema,
  materialWorkStages,
  updateExpenseEntrySchema,
  updateIncidentEntrySchema,
  updateLabourEntrySchema,
  updateMachineryEntrySchema,
  updateMaterialEntrySchema,
} from "@/lib/validation/schemas";
import { ENTRY_FIELD_CONSTRAINTS } from "@/lib/entryTypes/constraints";

const validSiteId = "550e8400-e29b-41d4-a716-446655440000";
const validTypeId = "550e8400-e29b-41d4-a716-446655440001";
const validUnitId = "550e8400-e29b-41d4-a716-446655440002";
const validEntryDate = new Date().toISOString().slice(0, 10);

describe("incident schemas", () => {
  it("accepts valid incident create payload", () => {
    const result = incidentEntrySchema.safeParse({
      siteId: validSiteId,
      incidentType: "Safety",
      severity: "High",
      description: "Scaffolding issue",
      durationEstimate: 120,
    });

    expect(result.success).toBe(true);
  });

  it("allows patch payload without siteId", () => {
    const result = updateIncidentEntrySchema.safeParse({
      description: "Updated detail",
      severity: "Low",
    });

    expect(result.success).toBe(true);
  });

  it("rejects negative duration", () => {
    const result = updateIncidentEntrySchema.safeParse({
      durationEstimate: -1,
    });

    expect(result.success).toBe(false);
  });
});

describe("labour schemas", () => {
  it("requires wagePerHead on create", () => {
    const result = labourEntrySchema.safeParse({
      siteId: validSiteId,
      date: validEntryDate,
      peopleCount: 8,
      workTypeMode: "default_enum",
      workTypeEnum: "Brick work",
    });

    expect(result.success).toBe(false);
  });

  it("accepts valid wagePerHead on create", () => {
    const result = labourEntrySchema.safeParse({
      siteId: validSiteId,
      date: validEntryDate,
      peopleCount: 8,
      wagePerHead: 650.5,
      workTypeMode: "default_enum",
      workTypeEnum: "Brick work",
      workStage: "Roof Level",
    });

    expect(result.success).toBe(true);
  });

  it("accepts wagePerHead with valid 2 decimal places", () => {
    const result = labourEntrySchema.safeParse({
      siteId: validSiteId,
      date: validEntryDate,
      peopleCount: 8,
      wagePerHead: 1.11,
      workTypeMode: "default_enum",
      workTypeEnum: "Brick work",
      workStage: "Roof Level",
    });

    expect(result.success).toBe(true);
  });

  it("rejects zero wagePerHead on create", () => {
    const result = labourEntrySchema.safeParse({
      siteId: validSiteId,
      date: validEntryDate,
      peopleCount: 8,
      wagePerHead: 0,
      workTypeMode: "default_enum",
      workTypeEnum: "Brick work",
    });

    expect(result.success).toBe(false);
  });

  it("rejects wagePerHead with more than 2 decimal places", () => {
    const result = labourEntrySchema.safeParse({
      siteId: validSiteId,
      date: validEntryDate,
      peopleCount: 8,
      wagePerHead: 650.555,
      workTypeMode: "default_enum",
      workTypeEnum: "Brick work",
    });

    expect(result.success).toBe(false);
  });

  it("accepts optional wagePerHead on update", () => {
    const result = updateLabourEntrySchema.safeParse({
      remarks: "Adjusted crew notes",
    });

    expect(result.success).toBe(true);
  });
});

describe("labour overtime schemas", () => {
  const baseLabour = {
    siteId: validSiteId,
    date: validEntryDate,
    workTypeMode: "default_enum" as const,
    workTypeEnum: "Steel work" as const,
    peopleCount: 3,
    wagePerHead: 1300,
    workStage: "Basement Level",
  };

  it("accepts valid OT on create", () => {
    const result = labourEntrySchema.safeParse({
      ...baseLabour,
      otPeopleCount: 2,
      otHours: 2.5,
      otRate: 150,
    });
    expect(result.success).toBe(true);
  });

  it("accepts payload with no OT fields present", () => {
    const result = labourEntrySchema.safeParse(baseLabour);
    expect(result.success).toBe(true);
  });

  it("accepts payload where all OT fields are explicitly null", () => {
    const result = labourEntrySchema.safeParse({
      ...baseLabour,
      otPeopleCount: null,
      otHours: null,
      otRate: null,
    });
    expect(result.success).toBe(true);
  });

  it("rejects partial OT input (missing hours)", () => {
    const result = labourEntrySchema.safeParse({
      ...baseLabour,
      otPeopleCount: 2,
      otHours: null,
      otRate: 100,
    });
    expect(result.success).toBe(false);
  });

  it("rejects partial OT input (missing rate)", () => {
    const result = labourEntrySchema.safeParse({
      ...baseLabour,
      otPeopleCount: 2,
      otHours: 2,
      otRate: null,
    });
    expect(result.success).toBe(false);
  });

  it("rejects partial OT input (missing people count)", () => {
    const result = labourEntrySchema.safeParse({
      ...baseLabour,
      otPeopleCount: null,
      otHours: 2,
      otRate: 100,
    });
    expect(result.success).toBe(false);
  });

  it("rejects partial OT input (only people count provided)", () => {
    const result = labourEntrySchema.safeParse({
      ...baseLabour,
      otPeopleCount: 2,
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-integer OT people count", () => {
    const result = labourEntrySchema.safeParse({
      ...baseLabour,
      otPeopleCount: 2.5,
      otHours: 2,
      otRate: 100,
    });
    expect(result.success).toBe(false);
  });

  it("rejects zero or negative OT people count", () => {
    expect(labourEntrySchema.safeParse({ ...baseLabour, otPeopleCount: 0, otHours: 2, otRate: 100 }).success).toBe(false);
    expect(labourEntrySchema.safeParse({ ...baseLabour, otPeopleCount: -1, otHours: 2, otRate: 100 }).success).toBe(false);
  });

  it("enforces OT people count bounds (1 to 10000)", () => {
    expect(labourEntrySchema.safeParse({ ...baseLabour, otPeopleCount: 1, otHours: 2, otRate: 100 }).success).toBe(true);
    expect(labourEntrySchema.safeParse({ ...baseLabour, otPeopleCount: 10000, otHours: 2, otRate: 100 }).success).toBe(true);
    expect(labourEntrySchema.safeParse({ ...baseLabour, otPeopleCount: 10001, otHours: 2, otRate: 100 }).success).toBe(false);
  });

  it("rejects negative or below-minimum OT hours", () => {
    expect(labourEntrySchema.safeParse({ ...baseLabour, otPeopleCount: 2, otHours: 0, otRate: 100 }).success).toBe(false);
    expect(labourEntrySchema.safeParse({ ...baseLabour, otPeopleCount: 2, otHours: -2, otRate: 100 }).success).toBe(false);
    expect(labourEntrySchema.safeParse({ ...baseLabour, otPeopleCount: 2, otHours: 0.05, otRate: 100 }).success).toBe(false);
  });

  it("enforces OT hours bounds (0.1 to 24, max 2 decimals)", () => {
    expect(labourEntrySchema.safeParse({ ...baseLabour, otPeopleCount: 2, otHours: 0.1, otRate: 100 }).success).toBe(true);
    expect(labourEntrySchema.safeParse({ ...baseLabour, otPeopleCount: 2, otHours: 24, otRate: 100 }).success).toBe(true);
    expect(labourEntrySchema.safeParse({ ...baseLabour, otPeopleCount: 2, otHours: 24.1, otRate: 100 }).success).toBe(false);
    expect(labourEntrySchema.safeParse({ ...baseLabour, otPeopleCount: 2, otHours: 2.25, otRate: 100 }).success).toBe(true);
    expect(labourEntrySchema.safeParse({ ...baseLabour, otPeopleCount: 2, otHours: 2.333, otRate: 100 }).success).toBe(false);
  });

  it("enforces OT rate bounds (0.01 to 1000000, max 2 decimals)", () => {
    expect(labourEntrySchema.safeParse({ ...baseLabour, otPeopleCount: 2, otHours: 2, otRate: 0.01 }).success).toBe(true);
    expect(labourEntrySchema.safeParse({ ...baseLabour, otPeopleCount: 2, otHours: 2, otRate: 1000000 }).success).toBe(true);
    expect(labourEntrySchema.safeParse({ ...baseLabour, otPeopleCount: 2, otHours: 2, otRate: 0 }).success).toBe(false);
    expect(labourEntrySchema.safeParse({ ...baseLabour, otPeopleCount: 2, otHours: 2, otRate: -50 }).success).toBe(false);
    expect(labourEntrySchema.safeParse({ ...baseLabour, otPeopleCount: 2, otHours: 2, otRate: 1000000.01 }).success).toBe(false);
    expect(labourEntrySchema.safeParse({ ...baseLabour, otPeopleCount: 2, otHours: 2, otRate: 150.55 }).success).toBe(true);
    expect(labourEntrySchema.safeParse({ ...baseLabour, otPeopleCount: 2, otHours: 2, otRate: 150.555 }).success).toBe(false);
  });

  describe("updateLabourEntrySchema OT handling", () => {
    it("accepts PATCH with OT omitted", () => {
      const result = updateLabourEntrySchema.safeParse({ remarks: "only update remarks" });
      expect(result.success).toBe(true);
    });

    it("accepts PATCH clearing OT via explicit nulls", () => {
      const result = updateLabourEntrySchema.safeParse({
        otPeopleCount: null,
        otHours: null,
        otRate: null,
      });
      expect(result.success).toBe(true);
    });

    it("accepts PATCH with complete valid OT update", () => {
      const result = updateLabourEntrySchema.safeParse({
        otPeopleCount: 4,
        otHours: 3.5,
        otRate: 120,
      });
      expect(result.success).toBe(true);
    });

    it("rejects PATCH with partial OT update", () => {
      expect(updateLabourEntrySchema.safeParse({ otPeopleCount: 4 }).success).toBe(false);
      expect(updateLabourEntrySchema.safeParse({ otPeopleCount: 4, otHours: null, otRate: 120 }).success).toBe(false);
      expect(updateLabourEntrySchema.safeParse({ otPeopleCount: 4, otHours: 2, otRate: null }).success).toBe(false);
    });
  });
});

describe("material schemas", () => {
  it("exports the allowed material work stages", () => {
    expect(materialWorkStages).toEqual([
      "Basement Level",
      "Brick Level",
      "Lintel Level",
      "Roof Level",
      "Compound Wall",
      "Other",
    ]);
  });

  it("requires workStage and cost on create", () => {
    const result = materialEntrySchema.safeParse({
      siteId: validSiteId,
      date: validEntryDate,
      quantity: 25,
      materialTypeMode: "default_enum",
      materialTypeEnum: "Cement",
      unitMode: "master",
      unitMasterId: validUnitId,
    });

    expect(result.success).toBe(false);
  });

  it("accepts valid workStage and cost on create", () => {
    const result = materialEntrySchema.safeParse({
      siteId: validSiteId,
      date: validEntryDate,
      quantity: 25,
      cost: 4200.75,
      workStage: "Roof Level",
      materialTypeMode: "custom",
      materialTypeCustomId: validTypeId,
      unitMode: "master",
      unitMasterId: validUnitId,
    });

    expect(result.success).toBe(true);
  });

  it("accepts cost with valid 2 decimal places", () => {
    const result = materialEntrySchema.safeParse({
      siteId: validSiteId,
      date: validEntryDate,
      quantity: 25,
      cost: 0.29,
      workStage: "Roof Level",
      materialTypeMode: "default_enum",
      materialTypeEnum: "Cement",
      unitMode: "master",
      unitMasterId: validUnitId,
    });

    expect(result.success).toBe(true);
  });

  it("accepts an arbitrary non-empty workStage at the schema level (membership is checked at the route via assertInCatalogList)", () => {
    // workStage is now a managed catalog list, not a pg enum: the schema only
    // enforces shape; valid-value membership moved to the route.
    const result = materialEntrySchema.safeParse({
      siteId: validSiteId,
      date: validEntryDate,
      quantity: 25,
      cost: 4200.75,
      workStage: "Ground Floor",
      materialTypeMode: "default_enum",
      materialTypeEnum: "Cement",
      unitMode: "master",
      unitMasterId: validUnitId,
    });

    expect(result.success).toBe(true);
  });

  it("rejects an empty workStage on create", () => {
    const result = materialEntrySchema.safeParse({
      siteId: validSiteId,
      date: validEntryDate,
      quantity: 25,
      cost: 4200.75,
      workStage: "",
      materialTypeMode: "default_enum",
      materialTypeEnum: "Cement",
      unitMode: "master",
      unitMasterId: validUnitId,
    });

    expect(result.success).toBe(false);
  });

  it("rejects invalid cost on create", () => {
    const result = materialEntrySchema.safeParse({
      siteId: validSiteId,
      date: validEntryDate,
      quantity: 25,
      cost: 0,
      workStage: "Roof Level",
      materialTypeMode: "default_enum",
      materialTypeEnum: "Cement",
      unitMode: "master",
      unitMasterId: validUnitId,
    });

    expect(result.success).toBe(false);
  });

  it("rejects cost with more than 2 decimal places", () => {
    const result = materialEntrySchema.safeParse({
      siteId: validSiteId,
      date: validEntryDate,
      quantity: 25,
      cost: 4200.999,
      workStage: "Roof Level",
      materialTypeMode: "default_enum",
      materialTypeEnum: "Cement",
      unitMode: "master",
      unitMasterId: validUnitId,
    });

    expect(result.success).toBe(false);
  });

  it("accepts optional omission of workStage and cost on update", () => {
    const result = updateMaterialEntrySchema.safeParse({
      remarks: "Supplier updated",
    });

    expect(result.success).toBe(true);
  });
});

describe("operation consolidation schema additions", () => {
  it("exports the labour work types that use Mason and Helper sections", () => {
    expect(labourSplitWorkTypes).toEqual(["Plastering", "Brick work", "Brickwork"]);
  });

  it("accepts split labour payload for Plastering with Mason and Helper amounts", () => {
    const result = labourEntrySchema.safeParse({
      siteId: validSiteId,
      date: validEntryDate,
      workType: "Plastering",
      masonCount: 2,
      masonSalaryAmount: 2600,
      helperCount: 1,
      helperSalaryAmount: 900,
      workStage: "Roof Level",
    });

    expect(result.success).toBe(true);
  });

  it("rejects split labour payload when both Mason and Helper are empty", () => {
    const result = labourEntrySchema.safeParse({
      siteId: validSiteId,
      date: validEntryDate,
      workType: "Brickwork",
      masonCount: 0,
      masonSalaryAmount: 0,
      helperCount: 0,
      helperSalaryAmount: 0,
    });

    expect(result.success).toBe(false);
  });

  // A role costs count × per-person salary, so a lone count or a lone salary
  // contributes nothing to the site total — it must never reach the database.
  it("rejects a split role that has a salary but no head count", () => {
    const result = labourEntrySchema.safeParse({
      siteId: validSiteId,
      date: validEntryDate,
      workType: "Brickwork",
      masonCount: 0,
      masonSalaryAmount: 1300,
      helperCount: 0,
      helperSalaryAmount: 0,
    });

    expect(result.success).toBe(false);
  });

  it("rejects a split role that has a head count but no salary", () => {
    const result = labourEntrySchema.safeParse({
      siteId: validSiteId,
      date: validEntryDate,
      workType: "Brickwork",
      masonCount: 2,
      masonSalaryAmount: 1300,
      helperCount: 2,
      helperSalaryAmount: 0,
    });

    expect(result.success).toBe(false);
  });

  it("rejects split labour payload for non-split work types", () => {
    const result = labourEntrySchema.safeParse({
      siteId: validSiteId,
      date: validEntryDate,
      workType: "Plumbing",
      masonCount: 2,
      masonSalaryAmount: 2600,
      helperCount: 1,
      helperSalaryAmount: 900,
    });

    expect(result.success).toBe(false);
  });

  it("requires machinery totalCost on create", () => {
    const result = machineryEntrySchema.safeParse({
      siteId: validSiteId,
      date: validEntryDate,
      equipmentType: "JCB",
      count: 1,
      hoursActive: 4,
    });

    expect(result.success).toBe(false);
  });

  it("accepts valid machinery totalCost on create", () => {
    const result = machineryEntrySchema.safeParse({
      siteId: validSiteId,
      date: validEntryDate,
      equipmentType: "JCB",
      count: 1,
      hoursActive: 4,
      totalCost: 10000,
      workStage: "Roof Level",
    });

    expect(result.success).toBe(true);
  });

  it("allows machinery totalCost on update", () => {
    const result = updateMachineryEntrySchema.safeParse({
      totalCost: 12000,
    });

    expect(result.success).toBe(true);
  });

  it("accepts new default material types", () => {
    for (const materialTypeEnum of ["Steel", "Red Brick", "Cement Block 6in", "Cement Block 4in"] as const) {
      const result = materialEntrySchema.safeParse({
        siteId: validSiteId,
        date: validEntryDate,
        quantity: 25,
        cost: 4200,
        workStage: "Roof Level",
        materialTypeMode: "default_enum",
        materialTypeEnum,
        unitMode: "master",
        unitMasterId: validUnitId,
      });

      expect(result.success).toBe(true);
    }
  });
});

describe("global work stage on labour/machinery/expense", () => {
  const validLabourPayload = {
    siteId: validSiteId,
    date: validEntryDate,
    peopleCount: 8,
    wagePerHead: 650.5,
    workTypeMode: "default_enum" as const,
    workTypeEnum: "Brick work" as const,
  };

  const validMachineryPayload = {
    siteId: validSiteId,
    date: validEntryDate,
    equipmentType: "JCB",
    count: 1,
    hoursActive: 4,
    totalCost: 10000,
  };

  const validExpensePayload = {
    siteId: validSiteId,
    date: validEntryDate,
    description: "Site supplies",
    amount: 500,
    category: "Miscellaneous",
  };

  it("requires workStage on labour create", () => {
    expect(labourEntrySchema.safeParse({ ...validLabourPayload, workStage: "Basement Level" }).success).toBe(true);
    expect(labourEntrySchema.safeParse(validLabourPayload).success).toBe(false);
  });

  it("requires workStage on machinery create", () => {
    expect(machineryEntrySchema.safeParse({ ...validMachineryPayload, workStage: "Basement Level" }).success).toBe(true);
    expect(machineryEntrySchema.safeParse(validMachineryPayload).success).toBe(false);
  });

  it("requires workStage on expense create", () => {
    expect(expenseEntrySchema.safeParse({ ...validExpensePayload, workStage: "Basement Level" }).success).toBe(true);
    expect(expenseEntrySchema.safeParse(validExpensePayload).success).toBe(false);
  });

  it("update schemas reject an explicit null workStage, so an entry cannot be un-tagged", () => {
    for (const schema of [updateLabourEntrySchema, updateMachineryEntrySchema, updateExpenseEntrySchema]) {
      expect(schema.safeParse({ workStage: null }).success).toBe(false);
    }
  });

  it("update schemas still accept workStage set or omitted", () => {
    // Omitted matters: legacy untagged entries are PATCHed without the field,
    // and the route only catalog-checks fields present in the body.
    for (const schema of [updateLabourEntrySchema, updateMachineryEntrySchema, updateExpenseEntrySchema]) {
      expect(schema.safeParse({ workStage: "Roof Level" }).success).toBe(true);
      expect(schema.safeParse({}).success).toBe(true);
    }
  });

  it("update schemas reject an empty string workStage", () => {
    for (const schema of [updateLabourEntrySchema, updateMachineryEntrySchema, updateExpenseEntrySchema]) {
      expect(schema.safeParse({ workStage: "" }).success).toBe(false);
    }
  });
});

describe("entryDateSchema", () => {
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

  it("accepts today", () => {
    expect(entryDateSchema.safeParse(today).success).toBe(true);
  });
  it("accepts dates far in the past", () => {
    expect(entryDateSchema.safeParse("2020-01-01").success).toBe(true);
  });
  it("rejects future dates", () => {
    expect(entryDateSchema.safeParse(tomorrow).success).toBe(false);
  });
});

// F18: the zod schemas and the form field registry must enforce the same
// numeric bounds. Both now read ENTRY_FIELD_CONSTRAINTS; these cases prove the
// server side actually honours it, so a constant change cannot quietly loosen
// validation while only moving the browser's `max` attribute.
describe("numeric bounds come from ENTRY_FIELD_CONSTRAINTS", () => {
  const base = {
    labour: {
      siteId: validSiteId, date: validEntryDate, workType: "Steel work",
      workTypeMode: "custom" as const, workTypeCustomId: validTypeId,
      peopleCount: 2, wagePerHead: 500, workStage: "Roof Level",
    },
    material: {
      siteId: validSiteId, date: validEntryDate, materialType: "Cement",
      materialTypeMode: "custom" as const, materialTypeCustomId: validTypeId,
      unit: "bag", unitId: validUnitId, quantity: 5, workStage: "Roof Level",
    },
    machinery: {
      siteId: validSiteId, date: validEntryDate, equipmentType: "JCB",
      equipmentTypeMode: "custom" as const, equipmentTypeCustomId: validTypeId,
      count: 1, hoursActive: 2, totalCost: 1000, workStage: "Roof Level",
    },
    expense: {
      siteId: validSiteId, date: validEntryDate, category: "Misc",
      description: "x", amount: 100, workStage: "Roof Level",
    },
    incident: {
      siteId: validSiteId, incidentType: "Safety", description: "x",
    },
  };

  const cases = [
    ["labour", "peopleCount", labourEntrySchema, base.labour],
    ["labour", "wagePerHead", labourEntrySchema, base.labour],
    ["material", "quantity", materialEntrySchema, base.material],
    ["machinery", "count", machineryEntrySchema, base.machinery],
    ["machinery", "hoursActive", machineryEntrySchema, base.machinery],
    ["machinery", "totalCost", machineryEntrySchema, base.machinery],
    ["expense", "amount", expenseEntrySchema, base.expense],
    ["incident", "durationEstimate", incidentEntrySchema, base.incident],
  ] as const;

  for (const [type, field, schema, payload] of cases) {
    it(`${type}.${field} accepts its max and rejects just above it`, () => {
      const { max } = ENTRY_FIELD_CONSTRAINTS[field];
      expect(schema.safeParse({ ...payload, [field]: max }).success, `${field} = max`).toBe(true);
      expect(schema.safeParse({ ...payload, [field]: max + 1 }).success, `${field} > max`).toBe(false);
    });

    it(`${type}.${field} rejects zero and negatives`, () => {
      expect(schema.safeParse({ ...payload, [field]: 0 }).success, `${field} = 0`).toBe(false);
      expect(schema.safeParse({ ...payload, [field]: -1 }).success, `${field} < 0`).toBe(false);
    });
  }
});


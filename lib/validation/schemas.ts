import { z } from "zod";

// F18: numeric bounds live in one place, shared with the form field registry.
import { ENTRY_FIELD_CONSTRAINTS } from "@/lib/entryTypes/constraints";

export const uuidSchema = z.string().uuid();
export const emailSchema = z.string().email().max(255);

function positiveDecimalSchema(max: number) {
  return z
    .number()
    .positive()
    .max(max)
    .refine((value) => Number(value.toFixed(2)) === value, {
      message: "Value must have at most 2 decimal places",
    });
}

const nonNegativeMoneySchema = z
  .number()
  .min(0)
  .max(100000000)
  .refine((value) => Number(value.toFixed(2)) === value, {
    message: "Value must have at most 2 decimal places",
  });

export const labourDefaultTypes = [
  "Steel work",
  "Shuttering",
  "Brick work",
  "Concrete work",
  "Plastering",
  "Electric work",
  "Plumbing",
  "Tile work",
  "Wood work",
  "Paint work",
] as const;

export const labourSplitWorkTypes = ["Plastering", "Brick work", "Brickwork"] as const;

export function isSplitLabourWorkType(value: string | null | undefined) {
  const normalized = String(value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  return normalized === "plastering" || normalized === "brick work" || normalized === "brickwork";
}

function labourWorkTypeFromPayload(value: Record<string, unknown>) {
  if (typeof value.workType === "string" && value.workType.trim()) return value.workType;
  if (typeof value.workTypeEnum === "string" && value.workTypeEnum.trim()) return value.workTypeEnum;
  return null;
}

export const materialDefaultTypes = [
  "Cement",
  "M sand",
  "P sand",
  "Metal",
  "Steel",
  "Red Brick",
  "Cement Block 6in",
  "Cement Block 4in",
] as const;
export const materialWorkStages = [
  "Basement Level",
  "Brick Level",
  "Lintel Level",
  "Roof Level",
  "Compound Wall",
  "Other",
] as const;

export const entryDateSchema = z.string().date().refine(
  (d) => {
    // No-future guard only; backdating is unlimited. Compare date strings in UTC
    // to avoid timezone-offset issues (new Date("2026-05-13") is UTC midnight).
    const todayUtc = new Date().toISOString().slice(0, 10);
    return d <= todayUtc;
  },
  { message: "Entry date cannot be in the future" }
);

const labourLegacyShape = z.object({
  workType: z.string().min(1).max(50),
});

const labourDefaultMode = z.object({
  workTypeMode: z.literal("default_enum"),
  workTypeEnum: z.enum(labourDefaultTypes),
  workTypeCustomId: z.never().optional(),
  workType: z.string().optional(),
});

const labourCustomMode = z.object({
  workTypeMode: z.literal("custom"),
  workTypeEnum: z.never().optional(),
  workTypeCustomId: uuidSchema,
  workType: z.string().optional(),
});

const labourCommonCreateShape = z.object({
  siteId: uuidSchema,
  date: entryDateSchema,
  remarks: z.string().max(500).optional(),
  // Shape only; membership checked at the route via assertInCatalogList ("Work Stage").
  // Required: an optional stage left ~42% of post-launch entries untagged.
  workStage: z.string().min(1).max(100),
});

const labourOrdinaryCostShape = z.object({
  peopleCount: z.number().int().positive().max(ENTRY_FIELD_CONSTRAINTS.peopleCount.max),
  wagePerHead: positiveDecimalSchema(ENTRY_FIELD_CONSTRAINTS.wagePerHead.max),
  salaryAmount: positiveDecimalSchema(100000000).optional(),
});

const labourSplitCostShape = z.object({
  masonCount: z.number().int().min(0).max(10000).default(0),
  masonSalaryAmount: nonNegativeMoneySchema.default(0),
  helperCount: z.number().int().min(0).max(10000).default(0),
  helperSalaryAmount: nonNegativeMoneySchema.default(0),
}).refine(
  (value) =>
    value.masonCount > 0 ||
    value.helperCount > 0 ||
    value.masonSalaryAmount > 0 ||
    value.helperSalaryAmount > 0,
  { message: "Mason or Helper values are required" },
).superRefine((value, ctx) => {
  for (const issue of labourSplitPairingIssues(value)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: issue.message, path: [issue.field] });
  }
});

// The salary amount is a PER-PERSON wage, so a role's cost is count × wage. A
// wage with no head count therefore costs nothing and a head count with no wage
// is free labour — either one silently loses money from the site total, so both
// are rejected at the edge rather than stored and mis-read later.
//
// Exported because the PATCH schema has every field optional: the route merges
// the body over the stored row and runs the same check on the result.
export function labourSplitPairingIssues(value: {
  masonCount?: number | null;
  masonSalaryAmount?: number | null;
  helperCount?: number | null;
  helperSalaryAmount?: number | null;
}): Array<{ field: string; message: string }> {
  const issues: Array<{ field: string; message: string }> = [];
  for (const [role, countField, amountField] of [
    ["Mason", "masonCount", "masonSalaryAmount"],
    ["Helper", "helperCount", "helperSalaryAmount"],
  ] as const) {
    const count = Number(value[countField] ?? 0);
    const amount = Number(value[amountField] ?? 0);
    if (amount > 0 && count <= 0) {
      issues.push({ field: countField, message: `${role} count is required when a ${role} salary is entered` });
    } else if (count > 0 && amount <= 0) {
      issues.push({ field: amountField, message: `${role} salary is required when a ${role} count is entered` });
    }
  }
  return issues;
}

const otPeopleCountSchema = z
  .number()
  .int()
  .min(ENTRY_FIELD_CONSTRAINTS.otPeopleCount.min)
  .max(ENTRY_FIELD_CONSTRAINTS.otPeopleCount.max);

const otHoursSchema = z
  .number()
  .min(ENTRY_FIELD_CONSTRAINTS.otHours.min)
  .max(ENTRY_FIELD_CONSTRAINTS.otHours.max)
  .refine((value) => Number(value.toFixed(2)) === value, {
    message: "Value must have at most 2 decimal places",
  });

const otRateSchema = z
  .number()
  .min(ENTRY_FIELD_CONSTRAINTS.otRate.min)
  .max(ENTRY_FIELD_CONSTRAINTS.otRate.max)
  .refine((value) => Number(value.toFixed(2)) === value, {
    message: "Value must have at most 2 decimal places",
  });

export function labourOtPairingIssues(value: {
  otPeopleCount?: number | null;
  otHours?: number | null;
  otRate?: number | null;
}): Array<{ field: string; message: string }> {
  const hasPeople = value.otPeopleCount != null;
  const hasHours = value.otHours != null;
  const hasRate = value.otRate != null;

  if (!hasPeople && !hasHours && !hasRate) return [];
  if (hasPeople && hasHours && hasRate) return [];

  const issues: Array<{ field: string; message: string }> = [];
  if (!hasPeople) {
    issues.push({ field: "otPeopleCount", message: "OT people count is required when overtime is entered" });
  }
  if (!hasHours) {
    issues.push({ field: "otHours", message: "OT hours is required when overtime is entered" });
  }
  if (!hasRate) {
    issues.push({ field: "otRate", message: "OT rate is required when overtime is entered" });
  }
  return issues;
}

const labourOtShape = z.object({
  otPeopleCount: otPeopleCountSchema.nullable().optional(),
  otHours: otHoursSchema.nullable().optional(),
  otRate: otRateSchema.nullable().optional(),
  otTotalAmount: z.number().nullable().optional(),
});

export const labourEntrySchema = labourCommonCreateShape
  .and(z.union([labourLegacyShape, labourDefaultMode, labourCustomMode]))
  .and(z.union([labourOrdinaryCostShape, labourSplitCostShape]))
  .and(labourOtShape)
  .superRefine((value, ctx) => {
    const workType = labourWorkTypeFromPayload(value);
    const hasSplitFields =
      "masonCount" in value ||
      "masonSalaryAmount" in value ||
      "helperCount" in value ||
      "helperSalaryAmount" in value;

    if (hasSplitFields && !isSplitLabourWorkType(workType)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Mason and Helper values are only supported for Plastering and Brickwork",
        path: ["workType"],
      });
    }

    for (const issue of labourOtPairingIssues(value)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: issue.message,
        path: [issue.field],
      });
    }
  });

export const updateLabourEntrySchema = z.object({
  date: entryDateSchema.optional(),
  peopleCount: z.number().int().positive().max(ENTRY_FIELD_CONSTRAINTS.peopleCount.max).optional(),
  wagePerHead: positiveDecimalSchema(ENTRY_FIELD_CONSTRAINTS.wagePerHead.max).optional(),
  salaryAmount: positiveDecimalSchema(100000000).optional(),
  masonCount: z.number().int().min(0).max(10000).optional(),
  masonSalaryAmount: nonNegativeMoneySchema.optional(),
  helperCount: z.number().int().min(0).max(10000).optional(),
  helperSalaryAmount: nonNegativeMoneySchema.optional(),
  otPeopleCount: otPeopleCountSchema.nullable().optional(),
  otHours: otHoursSchema.nullable().optional(),
  otRate: otRateSchema.nullable().optional(),
  otTotalAmount: z.number().nullable().optional(),
  remarks: z.string().max(500).optional(),
  workType: z.string().min(1).max(50).optional(),
  workTypeMode: z.enum(["default_enum", "custom"]).optional(),
  workTypeEnum: z.enum(labourDefaultTypes).optional(),
  workTypeCustomId: uuidSchema.optional(),
  workStage: z.string().min(1).max(100).optional(),
}).superRefine((value, ctx) => {
  const hasPeople = value.otPeopleCount !== undefined;
  const hasHours = value.otHours !== undefined;
  const hasRate = value.otRate !== undefined;

  // Case 1: omitted entirely -> valid (preserve existing)
  if (!hasPeople && !hasHours && !hasRate) return;

  // Case 3: explicitly clearing all OT fields -> all must be null
  if (value.otPeopleCount === null && value.otHours === null && value.otRate === null) return;

  // Case 2: updating OT -> all three must be provided and valid (non-null)
  if (value.otPeopleCount == null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "OT people count is required when overtime is entered",
      path: ["otPeopleCount"],
    });
  }
  if (value.otHours == null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "OT hours is required when overtime is entered",
      path: ["otHours"],
    });
  }
  if (value.otRate == null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "OT rate is required when overtime is entered",
      path: ["otRate"],
    });
  }
});

const materialLegacyShape = z.object({
  materialType: z.string().min(1).max(100),
  unit: z.string().min(1).max(50),
});

const materialDefaultMode = z.object({
  materialTypeMode: z.literal("default_enum"),
  materialTypeEnum: z.enum(materialDefaultTypes),
  materialTypeCustomId: z.never().optional(),
  materialType: z.string().optional(),
});

const materialCustomMode = z.object({
  materialTypeMode: z.literal("custom"),
  materialTypeEnum: z.never().optional(),
  materialTypeCustomId: uuidSchema,
  materialType: z.string().optional(),
});

const materialMasterUnit = z.object({
  unitMode: z.literal("master"),
  unitMasterId: uuidSchema,
  unitCustomId: z.never().optional(),
  unit: z.string().optional(),
});

const materialCustomUnit = z.object({
  unitMode: z.literal("custom"),
  unitMasterId: z.never().optional(),
  unitCustomId: uuidSchema,
  unit: z.string().optional(),
});

export const materialEntrySchema = z
  .object({
    siteId: uuidSchema,
    date: entryDateSchema,
    quantity: z.number().positive().max(ENTRY_FIELD_CONSTRAINTS.quantity.max),
    // Shape only; membership checked at the route via assertInCatalogList
    // ("Work Stage") against the active managed list.
    workStage: z.string().min(1).max(100),
    cost: positiveDecimalSchema(ENTRY_FIELD_CONSTRAINTS.cost.max).optional(),
    remarks: z.string().max(500).optional(),
  })
  .and(z.union([materialLegacyShape, z.intersection(z.union([materialDefaultMode, materialCustomMode]), z.union([materialMasterUnit, materialCustomUnit]))]));

export const updateMaterialEntrySchema = z.object({
  date: entryDateSchema.optional(),
  quantity: z.number().positive().max(ENTRY_FIELD_CONSTRAINTS.quantity.max).optional(),
  workStage: z.string().min(1).max(100).optional(),
  cost: positiveDecimalSchema(ENTRY_FIELD_CONSTRAINTS.cost.max).optional(),
  remarks: z.string().max(500).optional(),
  materialType: z.string().min(1).max(100).optional(),
  materialTypeMode: z.enum(["default_enum", "custom"]).optional(),
  materialTypeEnum: z.enum(materialDefaultTypes).optional(),
  materialTypeCustomId: uuidSchema.optional(),
  unit: z.string().min(1).max(50).optional(),
  unitMode: z.enum(["master", "custom"]).optional(),
  unitMasterId: uuidSchema.optional(),
  unitCustomId: uuidSchema.optional(),
});

const machineryLegacyShape = z.object({
  equipmentType: z.string().min(1).max(100),
  hoursActive: z.number().positive().max(ENTRY_FIELD_CONSTRAINTS.hoursActive.max),
});

const machineryDefaultMode = z.object({
  equipmentTypeMode: z.literal("default_enum"),
  equipmentTypeCustomId: z.never().optional(),
  equipmentType: z.string().optional(),
  hoursActive: z.number().positive().max(ENTRY_FIELD_CONSTRAINTS.hoursActive.max).optional(),
});

const machineryCustomMode = z.object({
  equipmentTypeMode: z.literal("custom"),
  equipmentTypeCustomId: uuidSchema,
  equipmentType: z.string().optional(),
  hoursActive: z.number().positive().max(ENTRY_FIELD_CONSTRAINTS.hoursActive.max).optional(),
});

export const machineryEntrySchema = z
  .object({
    siteId: uuidSchema,
    date: entryDateSchema,
    count: z.number().int().positive().max(ENTRY_FIELD_CONSTRAINTS.count.max),
    totalCost: positiveDecimalSchema(ENTRY_FIELD_CONSTRAINTS.totalCost.max),
    remarks: z.string().max(500).optional(),
    // Shape only; membership checked at the route via assertInCatalogList ("Work Stage").
    workStage: z.string().min(1).max(100),
  })
  .and(z.union([machineryLegacyShape, machineryDefaultMode, machineryCustomMode]));

export const updateMachineryEntrySchema = z.object({
  date: entryDateSchema.optional(),
  count: z.number().int().positive().max(ENTRY_FIELD_CONSTRAINTS.count.max).optional(),
  totalCost: positiveDecimalSchema(ENTRY_FIELD_CONSTRAINTS.totalCost.max).optional(),
  remarks: z.string().max(500).optional(),
  equipmentType: z.string().min(1).max(100).optional(),
  equipmentTypeMode: z.enum(["default_enum", "custom"]).optional(),
  equipmentTypeCustomId: uuidSchema.optional(),
  hoursActive: z.number().positive().max(ENTRY_FIELD_CONSTRAINTS.hoursActive.max).optional(),
  workStage: z.string().min(1).max(100).optional(),
});

export const expenseEntrySchema = z.object({
  siteId: uuidSchema,
  date: entryDateSchema,
  description: z.string().min(1).max(500),
  amount: z.number().positive().max(ENTRY_FIELD_CONSTRAINTS.amount.max),
  // Shape only; membership checked at the route ("Expense Category").
  category: z.string().min(1).max(100),
  // Shape only; membership checked at the route via assertInCatalogList ("Work Stage").
  // Not nullable: the derived update schema (.partial()) must reject an explicit
  // null, or a PATCH could un-tag an entry the form no longer lets you clear.
  workStage: z.string().min(1).max(100),
});

export const updateExpenseEntrySchema = expenseEntrySchema.partial().omit({ siteId: true });

export const incidentEntrySchema = z.object({
  siteId: uuidSchema,
  // Shape only; membership checked at the route ("Incident Type"/"Incident Severity").
  incidentType: z.string().min(1).max(100),
  severity: z.string().min(1).max(50).optional(),
  description: z.string().min(1).max(2000),
  durationEstimate: z.number().int().positive().max(ENTRY_FIELD_CONSTRAINTS.durationEstimate.max).optional(),
});

export const updateIncidentEntrySchema = incidentEntrySchema.partial().omit({ siteId: true });

export const resourceRequestSchema = z.object({
  siteId: uuidSchema,
  type: z.enum(["Labour", "Materials", "Money", "Machinery"]),
  details: z.string().min(10).max(1000),
  reason: z.string().min(10).max(500),
});

export const updateResourceRequestSchema = z.object({
  status: z.enum(["Approved", "Declined"]),
});

export const dynamicEntrySchema = z.object({
  siteId: uuidSchema,
  date: entryDateSchema,
  fieldDefinitionId: uuidSchema,
  value: z.union([z.string(), z.number(), z.boolean()]),
});

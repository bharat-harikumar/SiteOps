import { labourSplitPairingIssues } from "@/lib/validation/schemas";

import type { EntryField } from "./entryFieldRegistry";

export type ValidationFailure = { field: string; message: string };

export type ValidateInput = {
  fields: EntryField[];
  values: Record<string, unknown>;
  siteId: string | null;
  isEdit: boolean;
  splitLabour: boolean;
  otEnabled?: boolean;
};

// Pure mirror of the checks EntryForm used to run inline. Returns the FIRST
// failure so the form can focus that field; null when the form is submittable.
// Message strings are user-visible and are intentionally identical to the
// pre-extraction strings — changing them changes what supervisors read.
export function validateEntryValues(input: ValidateInput): ValidationFailure | null {
  const { fields, values, siteId, isEdit, splitLabour, otEnabled } = input;

  if (!siteId && !isEdit) {
    return { field: "siteId", message: "Site is required" };
  }

  for (const f of fields) {
    // Split-labour work types replace these two fields with the mason/helper
    // grid, so they are not required in that mode.
    if (splitLabour && (f.name === "peopleCount" || f.name === "wagePerHead")) continue;
    if (!f.required) continue;

    const v = values[f.name];
    if (f.kind === "subcategory" || f.kind === "unit") {
      // These hold an object (or null) — falsy means nothing was picked.
      if (!v) return { field: f.name, message: `${f.label} is required` };
      continue;
    }
    if (v === "" || v === null || v === undefined) {
      return { field: f.name, message: `${f.label} is required` };
    }
  }

  if (splitLabour) {
    const masonCount = Number(values.masonCount || 0);
    const masonSalaryAmount = Number(values.masonSalaryAmount || 0);
    const helperCount = Number(values.helperCount || 0);
    const helperSalaryAmount = Number(values.helperSalaryAmount || 0);
    if (masonCount <= 0 && masonSalaryAmount <= 0 && helperCount <= 0 && helperSalaryAmount <= 0) {
      // Anchored to masonCount so the form can scroll to the split grid.
      return { field: "masonCount", message: "Mason or Helper values are required" };
    }
    // A role costs count × per-person salary, so one without the other costs
    // nothing. The API rejects it too; catching it here keeps the error inline
    // instead of arriving as a toast after a round trip.
    const [pairing] = labourSplitPairingIssues({
      masonCount, masonSalaryAmount, helperCount, helperSalaryAmount,
    });
    if (pairing) return { field: "masonCount", message: pairing.message };
  }

  if (otEnabled) {
    const rawPeople = values.otPeopleCount;
    if (rawPeople === "" || rawPeople === null || rawPeople === undefined) {
      return { field: "otPeopleCount", message: "OT people count is required" };
    }
    const people = Number(rawPeople);
    if (!Number.isFinite(people) || !Number.isInteger(people) || people < 1 || people > 10000) {
      return { field: "otPeopleCount", message: "OT people count must be a whole number between 1 and 10,000" };
    }

    const rawHours = values.otHours;
    if (rawHours === "" || rawHours === null || rawHours === undefined) {
      return { field: "otHours", message: "OT hours is required" };
    }
    const hours = Number(rawHours);
    if (!Number.isFinite(hours) || hours < 0.1 || hours > 24) {
      return { field: "otHours", message: "OT hours must be between 0.1 and 24" };
    }
    if (Number(hours.toFixed(2)) !== hours) {
      return { field: "otHours", message: "OT hours must have at most 2 decimal places" };
    }

    const rawRate = values.otRate;
    if (rawRate === "" || rawRate === null || rawRate === undefined) {
      return { field: "otRate", message: "OT rate is required" };
    }
    const rate = Number(rawRate);
    if (!Number.isFinite(rate) || rate < 0.01 || rate > 1000000) {
      return { field: "otRate", message: "OT rate must be between 0.01 and 1,000,000" };
    }
    if (Number(rate.toFixed(2)) !== rate) {
      return { field: "otRate", message: "OT rate must have at most 2 decimal places" };
    }
  }

  return null;
}

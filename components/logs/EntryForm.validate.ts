import { ENTRY_FIELD_CONSTRAINTS } from "@/lib/entryTypes/constraints";
import { labourSplitPairingIssues } from "@/lib/validation/schemas";

import type { EntryField } from "./entryFieldRegistry";

const rupees = (value: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2 }).format(value);

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
    const raw = values.otTotalAmount;
    if (raw === "" || raw === null || raw === undefined) {
      return { field: "otTotalAmount", message: "OT amount is required" };
    }
    const { min, max } = ENTRY_FIELD_CONSTRAINTS.otTotalAmount;
    const amount = Number(raw);
    if (!Number.isFinite(amount) || amount < min || amount > max) {
      return { field: "otTotalAmount", message: `OT amount must be between ${rupees(min)} and ${rupees(max)}` };
    }
    if (Number(amount.toFixed(2)) !== amount) {
      return { field: "otTotalAmount", message: "OT amount must have at most 2 decimal places" };
    }
  }

  return null;
}

// Editing the field an error points at clears that error — a stale "X is
// required" under a now-filled field is worse than no message. The split-labour
// aggregate error is anchored to masonCount but satisfied by editing any of the
// four role fields, so it clears on any edit.
export function clearsFieldError(errorField: string, editedField: string): boolean {
  return errorField === editedField || errorField === "masonCount";
}

import { ENTRY_FIELD_CONSTRAINTS } from "@/lib/entryTypes/constraints";

import type { EntryField } from "./entryFieldRegistry";

// Overtime is one lump-sum box for the whole crew, shown only when the user
// switches OT on. It is not in REGISTRY_BY_TYPE because it is conditional.
export const OT_AMOUNT_FIELD: EntryField = {
  name: "otTotalAmount",
  label: "OT Amount",
  kind: "number",
  required: true,
  placeholder: "e.g. 1500",
  ...ENTRY_FIELD_CONSTRAINTS.otTotalAmount,
};

export function overtimeHint(splitLabour: boolean): string {
  return splitLabour
    ? "Total overtime paid for all masons and helpers on this entry."
    : "Total overtime paid for all workers on this entry.";
}

// What the form sends for OT. Omitting the key leaves the stored amount alone;
// null clears it — only needed when an entry that had OT is saved with OT off.
export function overtimePayload(input: {
  otEnabled: boolean;
  isEdit: boolean;
  hadInitialOt: boolean;
  amount: unknown;
}): { otTotalAmount?: number | null } {
  if (input.otEnabled) return { otTotalAmount: Number(input.amount) };
  if (input.isEdit && input.hadInitialOt) return { otTotalAmount: null };
  return {};
}

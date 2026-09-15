// The one TS home for "what did this labour row cost?".
// Precedence: mason+helper split → stored salaryAmount → peopleCount × wagePerHead.
//
// mason/helperSalaryAmount are PER-PERSON wages, exactly like wagePerHead on the
// ordinary path — so a role costs count × wage. Summing the two wage columns
// without their counts under-reported every split entry (2 masons at ₹1,300 plus
// 2 helpers at ₹1,100 read as ₹2,400 instead of ₹4,800).
//
// It lives here, outside lib/db/queries/, so callers that must not root their
// import graph in the Drizzle layer (entryFormat, the client entry-type
// descriptor) have a clean path to it. `calculateLabourTotal` in
// lib/db/queries/operationTotals.ts is now a re-export of this function, so the
// two can never drift.
//
// The three SQL copies (entries.ts labourSpendExpr, sites.ts siteTrackedSpend,
// search.ts) must stay in agreement with this; lib/db/queries/entries.test.ts
// holds the fixture-parity test that proves it.

export type LabourSpendInput = {
  peopleCount?: number | null;
  wagePerHead?: string | number | null;
  salaryAmount?: string | number | null;
  masonCount?: number | null;
  masonSalaryAmount?: string | number | null;
  helperCount?: number | null;
  helperSalaryAmount?: string | number | null;
  otTotalAmount?: string | number | null;
};

export function calculateOtAmount(
  people: number | null | undefined,
  hours: number | null | undefined,
  rate: number | string | null | undefined,
): number {
  const p = Number(people ?? 0);
  const h = Number(hours ?? 0);
  const r = Number(rate ?? 0);

  if (!Number.isFinite(p) || !Number.isFinite(h) || !Number.isFinite(r)) return 0;
  if (p <= 0 || h <= 0 || r <= 0) return 0;

  return Number((p * h * r).toFixed(2));
}

function finiteNumber(value: string | number | null | undefined) {
  const next = Number(value ?? 0);
  return Number.isFinite(next) ? next : 0;
}

export function labourSpend(
  rowOrPeople: LabourSpendInput | number | null | undefined,
  wage?: string | number | null,
) {
  if (typeof rowOrPeople === "number" || rowOrPeople == null) {
    const people = Number(rowOrPeople ?? 0);
    const wageValue = finiteNumber(wage);
    return Number.isFinite(people) && Number.isFinite(wageValue) ? people * wageValue : 0;
  }

  let regularCost = 0;
  const splitTotal =
    finiteNumber(rowOrPeople.masonCount) * finiteNumber(rowOrPeople.masonSalaryAmount) +
    finiteNumber(rowOrPeople.helperCount) * finiteNumber(rowOrPeople.helperSalaryAmount);

  if (splitTotal > 0) {
    regularCost = splitTotal;
  } else {
    const stored = finiteNumber(rowOrPeople.salaryAmount);
    if (stored > 0) {
      regularCost = stored;
    } else {
      const people = Number(rowOrPeople.peopleCount ?? 0);
      const wageValue = finiteNumber(rowOrPeople.wagePerHead);
      regularCost = Number.isFinite(people) && Number.isFinite(wageValue) ? people * wageValue : 0;
    }
  }

  const otCost = finiteNumber(rowOrPeople.otTotalAmount);

  return regularCost + otCost;
}

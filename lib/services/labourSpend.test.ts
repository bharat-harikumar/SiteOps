import { describe, expect, it } from "vitest";

import { calculateOtAmount, labourSpend } from "./labourSpend";

describe("calculateOtAmount", () => {
  it("calculates people × hours × rate correctly", () => {
    expect(calculateOtAmount(2, 2, 100)).toBe(400);
    expect(calculateOtAmount(3, 1.5, 100)).toBe(450);
    expect(calculateOtAmount(4, 2.5, 150.5)).toBe(1505);
  });

  it("rounds to 2 decimal places", () => {
    // 1 person * 1.33 hours * 100 rate = 133
    expect(calculateOtAmount(1, 1.33, 100)).toBe(133);
    // 3 * 2.33 * 50 = 349.5
    expect(calculateOtAmount(3, 2.33, 50)).toBe(349.5);
  });

  it("returns 0 for missing, null, or undefined inputs", () => {
    expect(calculateOtAmount(null, 2, 100)).toBe(0);
    expect(calculateOtAmount(2, null, 100)).toBe(0);
    expect(calculateOtAmount(2, 2, null)).toBe(0);
    expect(calculateOtAmount(undefined, undefined, undefined)).toBe(0);
  });

  it("returns 0 for zero or negative values", () => {
    expect(calculateOtAmount(0, 2, 100)).toBe(0);
    expect(calculateOtAmount(2, 0, 100)).toBe(0);
    expect(calculateOtAmount(2, 2, 0)).toBe(0);
    expect(calculateOtAmount(-1, 2, 100)).toBe(0);
    expect(calculateOtAmount(2, -1, 100)).toBe(0);
    expect(calculateOtAmount(2, 2, -100)).toBe(0);
  });

  it("returns 0 for non-finite inputs", () => {
    expect(calculateOtAmount(NaN, 2, 100)).toBe(0);
    expect(calculateOtAmount(2, Infinity, 100)).toBe(0);
  });
});

describe("labourSpend", () => {
  it("multiplies each split role's head count by its per-person wage", () => {
    // The reported bug: 2 masons at ₹1,300 and 2 helpers at ₹1,100 cost ₹4,800,
    // not the ₹2,400 that summing the two wages produces.
    expect(labourSpend({
      masonCount: 2,
      masonSalaryAmount: "1300",
      helperCount: 2,
      helperSalaryAmount: "1100",
    })).toBe(4800);
  });

  it("prefers the mason+helper split when either role has a positive cost", () => {
    expect(labourSpend({ masonCount: 2, masonSalaryAmount: "5000", helperCount: 3, helperSalaryAmount: "3000", salaryAmount: "999", peopleCount: 10, wagePerHead: "1000" })).toBe(19000);
    expect(labourSpend({ masonCount: 1, masonSalaryAmount: "5000", helperCount: null, helperSalaryAmount: null, salaryAmount: "999", peopleCount: 10, wagePerHead: "1000" })).toBe(5000);
    expect(labourSpend({ masonCount: null, masonSalaryAmount: null, helperCount: 3, helperSalaryAmount: "3000", salaryAmount: "999", peopleCount: 10, wagePerHead: "1000" })).toBe(9000);
  });

  it("costs a role with no people at zero, however large its per-person wage", () => {
    // A wage without a head count buys nothing. Validation now rejects this
    // pairing on write; rows already stored this way must read as 0, not as the
    // bare wage.
    expect(labourSpend({ masonCount: 0, masonSalaryAmount: "1300" })).toBe(0);
    expect(labourSpend({ masonCount: null, masonSalaryAmount: "1300" })).toBe(0);
  });

  it("falls back to the stored salaryAmount when the split is zero/absent", () => {
    expect(labourSpend({ salaryAmount: "12345", peopleCount: 10, wagePerHead: "1000" })).toBe(12345);
  });

  it("falls back to peopleCount × wagePerHead when nothing is stored", () => {
    expect(labourSpend({ peopleCount: 10, wagePerHead: "1000.00" })).toBe(10000);
  });

  it("returns 0 when there is nothing to compute from", () => {
    expect(labourSpend({})).toBe(0);
    expect(labourSpend({ peopleCount: 10, wagePerHead: null })).toBe(0);
    expect(labourSpend({ peopleCount: null, wagePerHead: "1000" })).toBe(0);
  });

  it("treats a zero split as absent, not as a spend of 0", () => {
    // A row with explicit zeros in both split columns must fall through to the
    // stored salary — otherwise editing a split entry to zeros would zero the
    // reported spend while the salary column still holds a value.
    expect(labourSpend({ masonCount: 0, masonSalaryAmount: "0", helperCount: 0, helperSalaryAmount: "0", salaryAmount: "7000" })).toBe(7000);
  });

  it("handles string decimals from drizzle without precision loss on money-sized values", () => {
    expect(labourSpend({ salaryAmount: "1234567.89" })).toBe(1234567.89);
    expect(labourSpend({ masonCount: 3, masonSalaryAmount: "1234.56" })).toBeCloseTo(3703.68, 2);
  });

  // --- Overtime (OT) tests ---

  it("calculates regular labour without OT correctly", () => {
    expect(labourSpend({
      peopleCount: 3,
      wagePerHead: "1300.00",
      salaryAmount: "3900.00",
      otTotalAmount: null,
    })).toBe(3900);
  });

  it("adds OT cost to regular labour (fallback people × wage)", () => {
    expect(labourSpend({
      peopleCount: 3,
      wagePerHead: "1300.00",
      otTotalAmount: "400.00",
    })).toBe(4300);
  });

  it("adds OT cost to stored regular salary", () => {
    expect(labourSpend({
      peopleCount: 3,
      wagePerHead: "1300.00",
      salaryAmount: "3900.00",
      otTotalAmount: "400.00",
    })).toBe(4300);
  });

  it("adds OT cost to split labour without modifying split precedence", () => {
    expect(labourSpend({
      masonCount: 2,
      masonSalaryAmount: "1300.00",
      helperCount: 2,
      helperSalaryAmount: "1100.00",
      otTotalAmount: "450.00",
    })).toBe(5250);
  });

  it("handles fractional OT amounts from fractional hours", () => {
    // e.g. 2 people * 1.5 hours * 100 rate = 300
    expect(labourSpend({
      salaryAmount: "3900.00",
      otTotalAmount: "300.00",
    })).toBe(4200);
  });

  it("keeps historical NULL OT fields identical to regular cost", () => {
    expect(labourSpend({
      peopleCount: 5,
      wagePerHead: "500.00",
      otTotalAmount: null,
    })).toBe(2500);

    expect(labourSpend({
      peopleCount: 5,
      wagePerHead: "500.00",
      otTotalAmount: undefined,
    })).toBe(2500);
  });

  it("does not mutate or alter regular headcount logic when OT is present", () => {
    const row = {
      peopleCount: 3,
      wagePerHead: "1000.00",
      salaryAmount: "3000.00",
      otTotalAmount: "400.00",
    };
    // Headcount is derived exclusively from peopleCount:
    expect(row.peopleCount).toBe(3);
    expect(labourSpend(row)).toBe(3400);
  });
});

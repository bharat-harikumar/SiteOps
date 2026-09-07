import { describe, expect, it } from "vitest";

import type { StageSummaryRow } from "@/lib/catalog/stageSummaryView";
import {
  computeManpowerSummary,
  type LabourEntryItem,
} from "./StageSummaryClient";

const stageRow = (key: string, kind: StageSummaryRow["kind"] = "stage"): StageSummaryRow => ({
  key,
  label: key,
  kind,
  entryCount: 1,
  firstDate: "2026-09-01",
  lastDate: "2026-09-05",
  total: 10700,
  byType: { labour: 10700, material: 0, machinery: 0, expense: 0 },
});

describe("computeManpowerSummary", () => {
  it("TEST 1: aggregates Mason and Helper count and salary for BLOCKWORK/BRICKWORK -> Brick work", () => {
    const row = stageRow("BLOCKWORK/BRICKWORK");
    const entries: LabourEntryItem[] = [
      {
        id: 1,
        workType: "Brick work",
        workStage: "BLOCKWORK/BRICKWORK",
        masonCount: 2,
        masonSalaryAmount: "1300.00",
        helperCount: 3,
        helperSalaryAmount: "1100.00",
        createdAt: "2026-09-03T10:00:00Z",
      },
      {
        id: 2,
        workType: "Brick work",
        workStage: "BLOCKWORK/BRICKWORK",
        masonCount: 2,
        masonSalaryAmount: "1300.00",
        helperCount: 2,
        helperSalaryAmount: "1100.00",
        createdAt: "2026-09-04T10:00:00Z",
      },
    ];

    const result = computeManpowerSummary(row, "Brick work", entries);
    expect(result).not.toBeNull();
    // Mason: 2 + 2 = 4 people, ₹2,600 + ₹2,600 = ₹5,200
    expect(result?.masonCount).toBe(4);
    expect(result?.masonSalary).toBe(5200);
    // Helper: 3 + 2 = 5 people, ₹3,300 + ₹2,200 = ₹5,500
    expect(result?.helperCount).toBe(5);
    expect(result?.helperSalary).toBe(5500);
  });

  it("TEST 2: adding a new Brick work entry dynamically updates Mason and Helper totals", () => {
    const row = stageRow("BLOCKWORK/BRICKWORK");
    const entries: LabourEntryItem[] = [
      {
        id: 1,
        workType: "Brick work",
        workStage: "BLOCKWORK/BRICKWORK",
        masonCount: 2,
        masonSalaryAmount: "1300.00",
        helperCount: 3,
        helperSalaryAmount: "1100.00",
        createdAt: "2026-09-03T10:00:00Z",
      },
      {
        id: 2,
        workType: "Brick work",
        workStage: "BLOCKWORK/BRICKWORK",
        masonCount: 2,
        masonSalaryAmount: "1300.00",
        helperCount: 2,
        helperSalaryAmount: "1100.00",
        createdAt: "2026-09-04T10:00:00Z",
      },
      {
        id: 3,
        workType: "Brick work",
        workStage: "BLOCKWORK/BRICKWORK",
        masonCount: 1,
        masonSalaryAmount: "1300.00",
        helperCount: 1,
        helperSalaryAmount: "1100.00",
        createdAt: "2026-09-05T10:00:00Z",
      },
    ];

    const result = computeManpowerSummary(row, "Brick work", entries);
    expect(result).not.toBeNull();
    // Mason: 4 + 1 = 5 people, ₹5,200 + ₹1,300 = ₹6,500
    expect(result?.masonCount).toBe(5);
    expect(result?.masonSalary).toBe(6500);
    // Helper: 5 + 1 = 6 people, ₹5,500 + ₹1,100 = ₹6,600
    expect(result?.helperCount).toBe(6);
    expect(result?.helperSalary).toBe(6600);
  });

  it("TEST 3: entries belonging to other Work Stages do not affect Brick work totals", () => {
    const brickworkRow = stageRow("BLOCKWORK/BRICKWORK");
    const plasteringRow = stageRow("PLASTERING");

    const entries: LabourEntryItem[] = [
      {
        id: 1,
        workType: "Brick work",
        workStage: "BLOCKWORK/BRICKWORK",
        masonCount: 2,
        masonSalaryAmount: "1300.00",
        helperCount: 3,
        helperSalaryAmount: "1100.00",
      },
      {
        id: 2,
        workType: "Brick work",
        workStage: "BLOCKWORK/BRICKWORK",
        masonCount: 2,
        masonSalaryAmount: "1300.00",
        helperCount: 2,
        helperSalaryAmount: "1100.00",
      },
      {
        id: 3,
        workType: "Plastering",
        workStage: "PLASTERING",
        masonCount: 3,
        masonSalaryAmount: "1300.00",
        helperCount: 2,
        helperSalaryAmount: "1100.00",
      },
    ];

    // BLOCKWORK/BRICKWORK Brick work is isolated
    const brickResult = computeManpowerSummary(brickworkRow, "Brick work", entries);
    expect(brickResult?.masonCount).toBe(4);
    expect(brickResult?.masonSalary).toBe(5200);
    expect(brickResult?.helperCount).toBe(5);
    expect(brickResult?.helperSalary).toBe(5500);

    // PLASTERING Plastering is also independently calculated
    const plasterResult = computeManpowerSummary(plasteringRow, "Plastering", entries);
    expect(plasterResult?.masonCount).toBe(3);
    expect(plasterResult?.masonSalary).toBe(3900);
    expect(plasterResult?.helperCount).toBe(2);
    expect(plasterResult?.helperSalary).toBe(2200);
  });

  it("TEST 4: deleting a Labour entry dynamically decreases the summary", () => {
    const row = stageRow("BLOCKWORK/BRICKWORK");
    // Initial: 2 entries = 4 masons (5200), 5 helpers (5500)
    // After deletion of Entry 2 (2 masons 2600, 2 helpers 2200):
    const remainingEntries: LabourEntryItem[] = [
      {
        id: 1,
        workType: "Brick work",
        workStage: "BLOCKWORK/BRICKWORK",
        masonCount: 2,
        masonSalaryAmount: "1300.00",
        helperCount: 3,
        helperSalaryAmount: "1100.00",
      },
    ];

    const result = computeManpowerSummary(row, "Brick work", remainingEntries);
    expect(result?.masonCount).toBe(2);
    expect(result?.masonSalary).toBe(2600);
    expect(result?.helperCount).toBe(3);
    expect(result?.helperSalary).toBe(3300);
  });

  it("TEST 5: editing a Labour entry dynamically updates the summary values", () => {
    const row = stageRow("BLOCKWORK/BRICKWORK");
    // Entry 1 Mason edited from 2 to 3
    const editedEntries: LabourEntryItem[] = [
      {
        id: 1,
        workType: "Brick work",
        workStage: "BLOCKWORK/BRICKWORK",
        masonCount: 3, // edited from 2 to 3
        masonSalaryAmount: "1300.00",
        helperCount: 3,
        helperSalaryAmount: "1100.00",
      },
      {
        id: 2,
        workType: "Brick work",
        workStage: "BLOCKWORK/BRICKWORK",
        masonCount: 2,
        masonSalaryAmount: "1300.00",
        helperCount: 2,
        helperSalaryAmount: "1100.00",
      },
    ];

    const result = computeManpowerSummary(row, "Brick work", editedEntries);
    expect(result?.masonCount).toBe(5); // 3 + 2 = 5
    expect(result?.masonSalary).toBe(6500); // 3900 + 2600 = 6500
    expect(result?.helperCount).toBe(5);
    expect(result?.helperSalary).toBe(5500);
  });

  it("returns null when no mason or helper data exists for the work item", () => {
    const row = stageRow("BLOCKWORK/BRICKWORK");
    const entries: LabourEntryItem[] = [
      {
        id: 1,
        workType: "General Labour",
        workStage: "BLOCKWORK/BRICKWORK",
        masonCount: 0,
        masonSalaryAmount: null,
        helperCount: 0,
        helperSalaryAmount: null,
      },
    ];

    expect(computeManpowerSummary(row, "General Labour", entries)).toBeNull();
    expect(computeManpowerSummary(row, "Brick work", entries)).toBeNull();
    expect(computeManpowerSummary(row, "Doors and windows", entries)).toBeNull();
  });

  it("handles whitespace and case-insensitive matching cleanly", () => {
    const row = stageRow("Blockwork/Brickwork");
    const entries: LabourEntryItem[] = [
      {
        id: 1,
        workType: "  brick work  ",
        workStage: "  blockwork/brickwork  ",
        masonCount: 1,
        masonSalaryAmount: "1500.00",
        helperCount: 1,
        helperSalaryAmount: "1200.00",
      },
    ];

    const result = computeManpowerSummary(row, "Brick Work", entries);
    expect(result?.masonCount).toBe(1);
    expect(result?.masonSalary).toBe(1500);
    expect(result?.helperCount).toBe(1);
    expect(result?.helperSalary).toBe(1200);
  });
});

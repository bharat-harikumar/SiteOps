import { beforeEach, describe, expect, it, vi } from "vitest";

const { lock, insertSpy, updateSpy, transaction } = vi.hoisted(() => ({
  lock: vi.fn(),
  insertSpy: vi.fn(),
  updateSpy: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/lib/catalog/lockCatalogMembers", () => ({ lockCatalogMembers: lock }));
vi.mock("@/lib/db/client", () => ({ db: { transaction } }));

import {
  insertExpenseEntry,
  insertIncidentReport,
  insertLabourEntry,
  insertMachineryEntry,
  insertMaterialEntry,
  updateEntryById,
} from "./entries";

// The catalog lock must run on the SAME transaction handle as the write, before
// it: that is what makes "validated, then renamed, then saved with the old name"
// impossible. Real concurrency is proven separately against Postgres.
describe("entry writes lock their catalog values in the writing transaction", () => {
  const tx = {
    insert: () => ({ values: (v: unknown) => ({ returning: () => insertSpy(v) }) }),
    update: () => ({ set: (v: unknown) => ({ where: () => ({ returning: () => updateSpy(v) }) }) }),
  };

  beforeEach(() => {
    vi.resetAllMocks();
    lock.mockResolvedValue(undefined);
    insertSpy.mockResolvedValue([{ id: "row" }]);
    updateSpy.mockResolvedValue([{ id: "row" }]);
    transaction.mockImplementation(async (cb: (t: unknown) => unknown) => cb(tx));
  });

  const base = { siteId: "s", date: "2026-10-01", createdBy: "u" };

  it("material: locks Work Stage, then inserts", async () => {
    await insertMaterialEntry({
      ...base, materialType: "Cement", quantity: "1", unit: "Bag", workStage: "Lintel Level Ground", cost: null, remarks: null,
    });
    expect(lock).toHaveBeenCalledWith(tx, [["Work Stage", "Lintel Level Ground"]]);
    expect(lock.mock.invocationCallOrder[0]).toBeLessThan(insertSpy.mock.invocationCallOrder[0]);
  });

  it("labour: locks Work Stage (null when untagged)", async () => {
    await insertLabourEntry({ ...base, workType: "Mason", peopleCount: 1, wagePerHead: "1", remarks: null, workStage: null });
    expect(lock).toHaveBeenCalledWith(tx, [["Work Stage", null]]);
  });

  it("machinery: locks Work Stage", async () => {
    await insertMachineryEntry({
      ...base, equipmentType: "Hitachi", count: 1, hoursActive: null, totalCost: "1", remarks: null, workStage: "Basement Level",
    });
    expect(lock).toHaveBeenCalledWith(tx, [["Work Stage", "Basement Level"]]);
  });

  it("expense: locks Expense Category and Work Stage", async () => {
    await insertExpenseEntry({ ...base, description: "d", amount: "1", category: "Misc", workStage: "Basement Level" });
    expect(lock).toHaveBeenCalledWith(tx, [["Expense Category", "Misc"], ["Work Stage", "Basement Level"]]);
  });

  it("incident: locks Incident Type and Severity", async () => {
    await insertIncidentReport({
      siteId: "s", incidentType: "Fall", severity: "High", description: "d", durationEstimate: null, reportedBy: "u",
    });
    expect(lock).toHaveBeenCalledWith(tx, [["Incident Type", "Fall"], ["Incident Severity", "High"]]);
  });

  it("does not insert when the catalog value changed", async () => {
    lock.mockRejectedValue(new Error("changed"));
    await expect(
      insertMaterialEntry({ ...base, materialType: "Cement", quantity: "1", unit: "Bag", workStage: "Old", cost: null, remarks: null }),
    ).rejects.toThrow("changed");
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it("update: locks only the catalog fields being changed, then updates", async () => {
    await updateEntryById("e1", "expense", { category: "Misc", amount: 5 });
    expect(lock).toHaveBeenCalledWith(tx, [["Work Stage", undefined], ["Expense Category", "Misc"]]);
    expect(lock.mock.invocationCallOrder[0]).toBeLessThan(updateSpy.mock.invocationCallOrder[0]);
  });

  it("update: an un-tag (null) is passed through and skipped by the lock", async () => {
    await updateEntryById("e1", "labour", { workStage: null });
    expect(lock).toHaveBeenCalledWith(tx, [["Work Stage", null]]);
  });
});

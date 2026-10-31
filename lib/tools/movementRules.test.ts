import { describe, expect, it } from "vitest";
import { validateMovement } from "./movementRules";
const state = { toolId: "t", version: 0, totalQuantity: 10, assignments: [{ siteId: "a", qty: 4 }, { siteId: "b", qty: 3 }] };
describe("movement source rules", () => {
  it("rejects excessive and missing-site returns and transfers before translation", () => {
    for (const kind of ["return_to_godown", "transfer_site"] as const) {
      expect(validateMovement(state, { kind, fromSiteId: "a", targetSiteId: "c", quantity: 5 })).toEqual({ ok: false, reason: "insufficient_source", available: 4 });
      expect(validateMovement(state, { kind, fromSiteId: "missing", targetSiteId: "c", quantity: 1 })).toEqual({ ok: false, reason: "insufficient_source", available: 0 });
    }
  });
  it("uses all allocations for godown availability", () => {
    expect(validateMovement(state, { kind: "send_to_site", targetSiteId: "c", quantity: 4 })).toEqual({ ok: false, reason: "insufficient_source", available: 3 });
    expect(validateMovement(state, { kind: "remove_stock", quantity: 4 })).toEqual({ ok: false, reason: "insufficient_source", available: 3 });
  });
  it("rejects invalid quantities, same site and excessive total", () => {
    for (const quantity of [0, -1, 1.2, NaN, Infinity, 1000001])
      expect(validateMovement(state, { kind: "add_stock", quantity })).toEqual({ ok: false, reason: "invalid_quantity" });
    expect(validateMovement(state, { kind: "transfer_site", fromSiteId: "a", targetSiteId: "a", quantity: 1 })).toEqual({ ok: false, reason: "same_site" });
    expect(validateMovement({ ...state, totalQuantity: 1000000 }, { kind: "add_stock", quantity: 1 })).toEqual({ ok: false, reason: "total_limit" });
  });
  it("allows exactly the source quantity", () => {
    expect(validateMovement(state, { kind: "return_to_godown", fromSiteId: "a", quantity: 4 })).toEqual({ ok: true });
    expect(validateMovement(state, { kind: "send_to_site", targetSiteId: "c", quantity: 3 })).toEqual({ ok: true });
  });
});

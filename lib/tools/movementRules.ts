import type { MovementAction } from "./contracts";
import type { BaseToolState } from "./translate";
export type MovementValidation = {
  ok: true;
} | {
  ok: false;
  reason: "insufficient_source" | "same_site" | "invalid_quantity" | "total_limit";
  available?: number;
};
export function validateMovement(state: BaseToolState, action: MovementAction): MovementValidation {
  if (!Number.isSafeInteger(action.quantity) || action.quantity < 1 || action.quantity > 1_000_000)
    return { ok: false, reason: "invalid_quantity" };
  if (action.kind === "transfer_site" && action.fromSiteId === action.targetSiteId)
    return { ok: false, reason: "same_site" };
  if (action.kind === "add_stock")
    return state.totalQuantity + action.quantity > 1_000_000 ? { ok: false, reason: "total_limit" } : { ok: true };
  const available = action.kind === "return_to_godown" || action.kind === "transfer_site"
    ? state.assignments.find(a => a.siteId === action.fromSiteId)?.qty ?? 0
    : state.totalQuantity - state.assignments.reduce((sum, a) => sum + a.qty, 0);
  return action.quantity > available ? { ok: false, reason: "insufficient_source", available } : { ok: true };
}

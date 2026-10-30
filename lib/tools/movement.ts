import { inArray } from "drizzle-orm";
import { can } from "@/lib/auth/capabilities";
import { checkOwnership } from "@/lib/auth/ownership";
import type { Role } from "@/lib/auth/roles";
import { db } from "@/lib/db/client";
import { sites } from "@/lib/db/schema";
import { applyLockedTool, loadToolForUpdate, ToolNotFound, type FreshTool } from "./applyBatch";
import type { MovementAction } from "./contracts";
import { validateMovement } from "./movementRules";
import { translateToPayload } from "./translate";
export type MovementErrorReason = "stale_version" | "insufficient_source" | "same_site" | "invalid_quantity" | "total_limit" | "forbidden_site" | "site_unavailable" | "tool_not_found";
export class MovementError extends Error {
  constructor(public readonly reason: MovementErrorReason, public readonly available?: number) { super(reason); this.name = "MovementError"; }
}
export type ToolActor = {
  id: string;
  role: Role;
};
export async function executeMovement(input: {
  toolId: string;
  expectedVersion: number;
  action: MovementAction;
  actor: ToolActor;
}): Promise<FreshTool> {
  const { toolId, expectedVersion, action, actor } = input;
  const stock = action.kind === "add_stock" || action.kind === "remove_stock";
  if (!can(actor.role, stock ? "tool:manage" : "site_tool:move"))
    throw new MovementError("forbidden_site");
  return db.transaction(async (tx) => {
    const siteIds = [...new Set([
        ...("fromSiteId" in action ? [action.fromSiteId] : []),
        ...("targetSiteId" in action ? [action.targetSiteId] : []),
      ])].sort();
    const lockedSites = siteIds.length ? await tx.select().from(sites).where(inArray(sites.siteId, siteIds)).orderBy(sites.siteId).for("share") : [];
    if (lockedSites.length !== siteIds.length || lockedSites.some(s => s.isDeleted || s.archivedAt))
      throw new MovementError("site_unavailable");
    if (lockedSites.some(s => !checkOwnership(actor, s.supervisorId)))
      throw new MovementError("forbidden_site");
    let locked;
    try {
      locked = await loadToolForUpdate(tx, toolId);
    }
    catch (e) {
      if (e instanceof ToolNotFound)
        throw new MovementError("tool_not_found");
      throw e;
    }
    if (locked.tool.version !== expectedVersion)
      throw new MovementError("stale_version");
    const state = { toolId, version: locked.tool.version, totalQuantity: locked.tool.totalQuantity, assignments: locked.current };
    const valid = validateMovement(state, action);
    if (!valid.ok)
      throw new MovementError(valid.reason, valid.available);
    const ledger = action.kind === "transfer_site" ? { kind: "transfer", fromLocation: action.fromSiteId, toLocation: action.targetSiteId, quantity: action.quantity } : undefined;
    const result = await applyLockedTool(tx, locked, translateToPayload(state, action), actor.id, ledger);
    if (result.status === "conflict")
      throw new MovementError("stale_version");
    if (result.status === "invalid")
      throw new MovementError(result.reason === "site_unavailable" ? "site_unavailable" : "invalid_quantity");
    return result.tool;
  });
}

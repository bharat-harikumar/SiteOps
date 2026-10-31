import { successResponse } from "@/lib/errors/response";
import { parseJsonBody, validateBody } from "@/lib/http/request";
import type { MovementAction, SiteToolMoveResult } from "@/lib/tools/contracts";
import { withSiteToolRoute } from "@/lib/tools/http";
import { executeMovement } from "@/lib/tools/movement";
import { getSiteTools } from "@/lib/tools/siteQuery";
import { siteToolMovementSchema } from "@/lib/validation/toolSchemas";
export const GET = withSiteToolRoute("site_tool:read", async ({ siteId, actor, requestId }) => successResponse(await getSiteTools(siteId, actor), 200, requestId));
export const POST = withSiteToolRoute("site_tool:move", async ({ siteId, actor, request, requestId }) => {
  const parsed = await parseJsonBody(request, requestId);
  if (!parsed.ok)
    return parsed.response;
  const validation = validateBody(siteToolMovementSchema, parsed.data, requestId);
  if (!validation.ok)
    return validation.response;
  const body = validation.data;
  const common = { quantity: body.quantity, note: body.note };
  const action: MovementAction = body.kind === "receive" ? { ...common, kind: "send_to_site", targetSiteId: siteId } : body.kind === "return" ? { ...common, kind: "return_to_godown", fromSiteId: siteId } : { ...common, kind: "transfer_site", fromSiteId: siteId, targetSiteId: body.targetSiteId };
  const tool = await executeMovement({ toolId: body.toolId, expectedVersion: body.expectedVersion, action, actor });
  const result: SiteToolMoveResult = { status: "ok", toolId: tool.toolId, version: tool.version, quantityHere: tool.assignments.find(a => a.siteId === siteId)?.qty ?? 0 };
  return successResponse(result, 200, requestId);
});

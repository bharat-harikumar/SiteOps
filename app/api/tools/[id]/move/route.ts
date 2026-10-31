import { z } from "zod";
import { requireCapability } from "@/lib/auth/guards";
import { errorResponse, successResponse } from "@/lib/errors/response";
import { parseJsonBody, validateBody } from "@/lib/http/request";
import { withApiRoute } from "@/lib/http/withApi";
import { movementErrorResponse } from "@/lib/tools/http";
import { executeMovement } from "@/lib/tools/movement";
import { toolMovementSchema } from "@/lib/validation/toolSchemas";
type RouteCtx = {
  params: Promise<{
    id: string;
  }>;
};
export const POST = withApiRoute<RouteCtx>(async ({ request, requestId }, context) => {
  const { id: toolId } = await context.params;
  const parsed = await parseJsonBody(request, requestId);
  if (!parsed.ok)
    return parsed.response;
  const validation = validateBody(toolMovementSchema, parsed.data, requestId);
  if (!validation.ok)
    return validation.response;
  const { expectedVersion, ...action } = validation.data;
  const auth = await requireCapability(request, action.kind === "add_stock" || action.kind === "remove_stock" ? "tool:manage" : "tool:assign");
  if (!("session" in auth))
    return errorResponse(auth.error, "Permission required", auth.status, undefined, requestId);
  if (!z.string().uuid().safeParse(toolId).success)
    return errorResponse("VALIDATION_ERROR", "Invalid tool ID", 400, undefined, requestId);
  try {
    const tool = await executeMovement({ toolId, expectedVersion, action, actor: { id: auth.session.user.id, role: auth.session.user.role } });
    return successResponse({ toolId, status: "ok", tool }, 200, requestId);
  }
  catch (error) {
    return movementErrorResponse(error, requestId);
  }
});

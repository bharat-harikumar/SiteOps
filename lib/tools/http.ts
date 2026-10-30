import { z } from "zod";
import type { NextRequest } from "next/server";
import { requireCapability } from "@/lib/auth/guards";
import { errorResponse } from "@/lib/errors/response";
import { withApiRoute } from "@/lib/http/withApi";
import { MovementError, type ToolActor } from "./movement";
export type ToolRouteCtx = {
  params: Promise<{
    id: string;
  }>;
};
export function movementErrorResponse(error: unknown, requestId: string): Response {
  if (!(error instanceof MovementError))
    throw error;
  const status = error.reason === "stale_version" ? 409 : error.reason === "forbidden_site" ? 403 : ["site_unavailable", "tool_not_found"].includes(error.reason) ? 404 : 400;
  const code = status === 409 ? "CONFLICT" : status === 403 ? "FORBIDDEN" : status === 404 ? "NOT_FOUND" : "VALIDATION_ERROR";
  return errorResponse(code, error.reason.replaceAll("_", " "), status, { reason: error.reason, ...(error.available === undefined ? {} : { available: error.available }) }, requestId);
}
export function withSiteToolRoute(capability: "site_tool:read" | "site_tool:move", handler: (args: {
  request: NextRequest;
  requestId: string;
  siteId: string;
  actor: ToolActor;
}) => Promise<Response>) {
  const route = withApiRoute<ToolRouteCtx>(async ({ request, requestId }, ctx) => {
    let response: Response;
    try {
      const auth = await requireCapability(request, capability);
      if (!("session" in auth))
        response = errorResponse(auth.error, "Authentication required", auth.status, undefined, requestId);
      else {
        const { id: siteId } = await ctx.params;
        if (!z.string().uuid().safeParse(siteId).success)
          response = errorResponse("VALIDATION_ERROR", "Invalid site ID", 400, undefined, requestId);
        else
          response = await handler({ request, requestId, siteId, actor: { id: auth.session.user.id, role: auth.session.user.role } });
      }
    }
    catch (error) {
      response = movementErrorResponse(error, requestId);
    }
    return response;
  });
  return async (request:NextRequest,ctx:ToolRouteCtx):Promise<Response> => {
    const response=await route(request,ctx);
    response.headers.set("cache-control","private, no-store");
    return response;
  };
}

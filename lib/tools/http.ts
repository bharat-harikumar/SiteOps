import { z } from "zod";
import type { NextRequest } from "next/server";
import { requireCapability } from "@/lib/auth/guards";
import { errorResponse } from "@/lib/errors/response";
import { withPrivateNoStore } from "@/lib/http/privateNoStore";
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
  const messages = {
    stale_version: "Stock changed. Review the latest quantity before saving.",
    insufficient_source: "The source does not have enough tools for this move.",
    same_site: "Choose a different destination site.",
    invalid_quantity: "Enter a whole quantity between 1 and 1,000,000.",
    total_limit: "Total stock cannot exceed 1,000,000.",
    forbidden_site: "You can only move tools between sites you supervise.",
    site_unavailable: "This site is unavailable. Refresh and choose an active site.",
    tool_not_found: "This tool is no longer available. Refresh the tools list.",
  };
  const available = error.reason === "insufficient_source"
    && error.available !== undefined && Number.isSafeInteger(error.available)
    && error.available >= 0 && error.available <= 1_000_000
    ? error.available : undefined;
  const message = available === undefined ? messages[error.reason] : `Only ${available} available at the source.`;
  return errorResponse(code, message, status, {
    reason: error.reason,
    ...(available === undefined ? {} : { available }),
  }, requestId);
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
  return withPrivateNoStore(route);
}

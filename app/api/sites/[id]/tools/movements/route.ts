import { successResponse } from "@/lib/errors/response";
import { validateBody } from "@/lib/http/request";
import { withSiteToolRoute } from "@/lib/tools/http";
import { listSiteToolMovements } from "@/lib/tools/siteQuery";
import { siteMovementsQuerySchema } from "@/lib/validation/toolSchemas";
export const GET = withSiteToolRoute("site_tool:read", async ({ siteId, actor, request, requestId }) => {
  const query = validateBody(siteMovementsQuerySchema, Object.fromEntries(new URL(request.url).searchParams), requestId);
  if (!query.ok)
    return query.response;
  const { limit, offset } = query.data;
  return successResponse({ movements: await listSiteToolMovements(siteId, actor, query.data), limit, offset }, 200, requestId);
});

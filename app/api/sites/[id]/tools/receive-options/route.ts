import { successResponse } from "@/lib/errors/response";
import { validateBody } from "@/lib/http/request";
import { withSiteToolRoute } from "@/lib/tools/http";
import { listReceiveOptions } from "@/lib/tools/siteQuery";
import { receiveOptionsQuerySchema } from "@/lib/validation/toolSchemas";
export const GET = withSiteToolRoute("site_tool:read", async ({ siteId, actor, request, requestId }) => {
  const query = validateBody(receiveOptionsQuerySchema, Object.fromEntries(new URL(request.url).searchParams), requestId);
  if (!query.ok)
    return query.response;
  return successResponse({ tools: await listReceiveOptions(siteId, actor, query.data.q) }, 200, requestId);
});

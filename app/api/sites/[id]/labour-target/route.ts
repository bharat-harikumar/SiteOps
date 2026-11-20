import { assertSiteWritable } from "@/lib/auth/siteWritable";
import { upsertLabourTarget } from "@/lib/db/queries/labourTargets";
import { handleDbError } from "@/lib/errors/db";
import { successResponse } from "@/lib/errors/response";
import { parseJsonBody, validateBody } from "@/lib/http/request";
import { withApiRoute } from "@/lib/http/withApi";
import { labourTargetSchema } from "@/lib/validation/schemas";

type RouteCtx = { params: Promise<{ id: string }> };

// Set the mason/helper target for one site + split-labour work type. Anyone who
// may log entries on the site (Admin, or its Supervisor) may set it.
export const PUT = withApiRoute<RouteCtx>(async ({ request, requestId }, context) => {
  const { id: siteId } = await context.params;

  const writable = await assertSiteWritable({
    request,
    siteId,
    requestId,
    forbiddenMessage: "You can only set targets for sites you supervise",
  });
  if (!writable.ok) return writable.response;

  const parsed = await parseJsonBody(request, requestId);
  if (!parsed.ok) return parsed.response;

  const validation = validateBody(labourTargetSchema, parsed.data, requestId);
  if (!validation.ok) return validation.response;

  try {
    const target = await upsertLabourTarget({
      siteId,
      workType: validation.data.workType,
      masonTarget: validation.data.masonTarget,
      helperTarget: validation.data.helperTarget,
      userId: writable.session.user.id,
    });
    return successResponse({ target }, 200, requestId);
  } catch (dbError) {
    const handled = handleDbError(dbError, requestId);
    if (handled) return handled;
    throw dbError;
  }
});

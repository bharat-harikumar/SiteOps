import { eq } from "drizzle-orm";
import { z } from "zod";

import { scheduleAudit } from "@/lib/audit/log";
import { getActorRoleFromDb } from "@/lib/auth/actorRole";
import { can } from "@/lib/auth/capabilities";
import { createSupabaseServiceClient } from "@/lib/auth/config";
import { requireCapability } from "@/lib/auth/guards";
import { passwordSchema } from "@/lib/auth/passwordPolicy";
import { invalidateUserClaims } from "@/lib/auth/refreshClaims";
import { revokeUserSessions } from "@/lib/auth/sessions";
import { invalidateUserProfileCache } from "@/lib/cache/invalidate";
import { db } from "@/lib/db/client";
import { userProfiles } from "@/lib/db/schema";
import { ERROR_CODES } from "@/lib/errors/codes";
import { errorResponse, successResponse } from "@/lib/errors/response";
import { withNoStore } from "@/lib/http/cacheHeaders";
import { parseJsonBody, validateBody } from "@/lib/http/request";
import { withApiRoute } from "@/lib/http/withApi";

type RouteCtx = { params: Promise<{ id: string }> };

const resetPasswordSchema = z.object({ tempPassword: passwordSchema }).strict();

// POST /api/admin/users/[id]/reset-password — an admin sets a temp password for
// another user. The user is signed out everywhere and must choose their own
// password at next sign-in (the existing must_change_password flow). The
// password is never logged, audited or returned.
export const POST = withApiRoute<RouteCtx>(async ({ request, requestId }, context) => {
  const auth = await requireCapability(request, "user:reset_password");
  if (!("session" in auth)) {
    return withNoStore(
      errorResponse(auth.error, "Admin access required", auth.status, undefined, requestId),
    );
  }

  // Stateful actor-role check (§8.7): authorize against the DB role, not the JWT.
  const actorId = auth.session.user.id;
  const actorRole = await getActorRoleFromDb(actorId);
  if (!actorRole || !can(actorRole, "user:reset_password")) {
    return withNoStore(
      errorResponse(ERROR_CODES.FORBIDDEN, "Admin access required", 403, undefined, requestId),
    );
  }

  const parsed = await parseJsonBody(request, requestId);
  if (!parsed.ok) return withNoStore(parsed.response);
  const validation = validateBody(resetPasswordSchema, parsed.data, requestId);
  if (!validation.ok) return withNoStore(validation.response);

  const { id } = await context.params;

  // Your own password goes through change-password, which proves the current one.
  if (id === actorId) {
    return withNoStore(
      errorResponse(
        ERROR_CODES.VALIDATION_ERROR,
        "Use Change password to update your own password",
        400,
        undefined,
        requestId,
      ),
    );
  }

  const target = await db
    .select({ userId: userProfiles.userId })
    .from(userProfiles)
    .where(eq(userProfiles.userId, id))
    .limit(1);
  if (target.length === 0) {
    return withNoStore(errorResponse(ERROR_CODES.NOT_FOUND, "User not found", 404, undefined, requestId));
  }

  // Password first, flag second: GoTrue and Postgres can't share a transaction.
  // If the flag write fails, the user holds a working temp password and the
  // admin can simply retry — the reverse order could force a change to a
  // password nobody knows.
  const supabase = createSupabaseServiceClient();
  const { error: updateError } = await supabase.auth.admin.updateUserById(id, {
    password: validation.data.tempPassword,
  });
  if (updateError) {
    const notFound = updateError.status === 404;
    return withNoStore(
      errorResponse(
        notFound ? ERROR_CODES.NOT_FOUND : ERROR_CODES.VALIDATION_ERROR,
        notFound ? "User not found" : updateError.message ?? "Failed to reset password",
        notFound ? 404 : 400,
        undefined,
        requestId,
      ),
    );
  }

  await db
    .update(userProfiles)
    .set({ mustChangePassword: true, updatedAt: new Date() })
    .where(eq(userProfiles.userId, id));

  // Re-mint so the must_change_password claim takes effect, drop the cached
  // profile, and end every live session so a stolen token can't survive.
  await invalidateUserClaims(id);
  await invalidateUserProfileCache(id, requestId);
  await revokeUserSessions(id);

  scheduleAudit({
    actorUserId: actorId,
    action: "user.password_reset",
    resourceType: "user",
    resourceId: id,
    allowed: true,
    role: actorRole,
    metadata: {},
  });

  return withNoStore(successResponse({ userId: id, mustChangePassword: true }, 200, requestId));
});

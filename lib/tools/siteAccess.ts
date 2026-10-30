import { and, eq, isNull, sql } from "drizzle-orm";
import { can } from "@/lib/auth/capabilities";
import { checkOwnership } from "@/lib/auth/ownership";
import { db } from "@/lib/db/client";
import { sites } from "@/lib/db/schema";
import { MovementError, type ToolActor } from "./movement";
export function siteAccessPredicate(siteId: string, actor: ToolActor) {
  return and(eq(sites.siteId, siteId), eq(sites.isDeleted, false), isNull(sites.archivedAt), can(actor.role, "resource:manage_all") ? sql`true` : eq(sites.supervisorId, actor.id));
}
export async function requireLiveSite(siteId: string, actor: ToolActor) {
  const [site] = await db.select({ siteId: sites.siteId, name: sites.name, supervisorId: sites.supervisorId, archivedAt: sites.archivedAt, isDeleted: sites.isDeleted }).from(sites).where(eq(sites.siteId, siteId)).limit(1);
  if (!site || site.isDeleted || site.archivedAt)
    throw new MovementError("site_unavailable");
  if (!can(actor.role, "site_tool:read") || !checkOwnership(actor, site.supervisorId))
    throw new MovementError("forbidden_site");
  return { siteId: site.siteId, name: site.name };
}

import { sql } from "drizzle-orm";
import { can } from "@/lib/auth/capabilities";
import { db } from "@/lib/db/client";
import { receiveOptionsQuerySchema, siteMovementsQuerySchema } from "@/lib/validation/toolSchemas";
import type { ReceiveToolOption, SiteToolMovement, SiteToolsData } from "./contracts";
import { MovementError, type ToolActor } from "./movement";
import { requireLiveSite, siteAccessPredicate } from "./siteAccess";
// Every statement repeats the live ownership predicate; the initial fresh guard only distinguishes 403/404.
export async function getSiteTools(siteId: string, actor: ToolActor): Promise<SiteToolsData> {
  await requireLiveSite(siteId, actor);
  const rows = await db.execute<{
    siteId: string;
    siteName: string;
    toolId: string | null;
    name: string | null;
    categoryName: string | null;
    quantityHere: number | null;
    version: number | null;
  }>(sql`
 select sites.site_id as "siteId", sites.name as "siteName", t.tool_id as "toolId",t.name,c.name as "categoryName",a.quantity as "quantityHere",t.version
 from sites left join tool_assignments a on a.site_id=sites.site_id
 left join tools t on t.tool_id=a.tool_id and t.is_deleted=false
 left join tool_categories c on c.category_id=t.category_id
 where ${siteAccessPredicate(siteId, actor)} order by t.name,t.tool_id`);
  if (!rows.length) {
    await requireLiveSite(siteId, actor);
    throw new MovementError("site_unavailable");
  }
  const items = rows.filter(r => r.toolId !== null).map(r => ({ toolId: r.toolId!, name: r.name!, categoryName: r.categoryName!, quantityHere: r.quantityHere!, version: r.version! }));
  return { site: { siteId: rows[0].siteId, name: rows[0].siteName }, items, itemCount: items.reduce((s, i) => s + i.quantityHere, 0), toolTypeCount: items.length };
}
export async function listReceiveOptions(siteId: string, actor: ToolActor, q?: string): Promise<ReceiveToolOption[]> {
  const query = receiveOptionsQuerySchema.parse({ q });
  await requireLiveSite(siteId, actor);
  const rows = await db.execute<ReceiveToolOption>(sql`
 select t.tool_id as "toolId",t.name,c.name as "categoryName",t.version,
 (t.total_quantity-coalesce(a.quantity,0))::int as "availableInGodown"
 from tools t join tool_categories c on c.category_id=t.category_id
 left join (select tool_id,sum(quantity) as quantity from tool_assignments group by tool_id) a on a.tool_id=t.tool_id
 where t.is_deleted=false and exists(select 1 from sites where ${siteAccessPredicate(siteId, actor)})
 and (${query.q ?? ""}='' or t.name ilike ${`%${query.q ?? ""}%`})
 and t.total_quantity>coalesce(a.quantity,0)
 order by t.name,t.tool_id`);
  if (!rows.length) await requireLiveSite(siteId, actor);
  return rows;
}
export async function listSiteToolMovements(siteId: string, actor: ToolActor, input: {
  toolId?: string;
  limit: number;
  offset: number;
}): Promise<SiteToolMovement[]> {
  const query = siteMovementsQuerySchema.parse(input);
  await requireLiveSite(siteId, actor);
  const admin = can(actor.role, "resource:manage_all");
  const rows = await db.execute<SiteToolMovement & {
    createdAt: string | Date;
  }>(sql`
 select m.movement_id as "movementId",t.name as "toolName",m.kind,m.quantity,m.note,m.created_at as "createdAt",
 coalesce(u.full_name,'Former user') as "actorName",
 json_build_object('label',case when m.from_location='WAREHOUSE' then 'Godown' when m.from_location='EXTERNAL' then 'External' when fs.site_id is not null then fs.name else 'Another site' end,'href',case when fs.site_id is not null then '/app/sites/'||fs.site_id::text||'/tools' else null end) as "from",
 json_build_object('label',case when m.to_location='WAREHOUSE' then 'Godown' when m.to_location='EXTERNAL' then 'External' when ts.site_id is not null then ts.name else 'Another site' end,'href',case when ts.site_id is not null then '/app/sites/'||ts.site_id::text||'/tools' else null end) as "to"
 from tool_movements m join tools t on t.tool_id=m.tool_id
 left join user_profiles u on u.user_id=m.actor_user_id
 left join sites fs on fs.site_id::text=m.from_location and fs.is_deleted=false and fs.archived_at is null and (${admin} or fs.supervisor_id=${actor.id})
 left join sites ts on ts.site_id::text=m.to_location and ts.is_deleted=false and ts.archived_at is null and (${admin} or ts.supervisor_id=${actor.id})
 where (m.from_location=${siteId} or m.to_location=${siteId})
 and exists(select 1 from sites where ${siteAccessPredicate(siteId, actor)})
 ${query.toolId ? sql`and m.tool_id=${query.toolId}` : sql``}
 order by m.created_at desc,m.movement_id desc limit ${query.limit} offset ${query.offset}`);
  if (!rows.length) await requireLiveSite(siteId, actor);
  return rows.map(r => ({ ...r, createdAt: new Date(r.createdAt).toISOString() }));
}

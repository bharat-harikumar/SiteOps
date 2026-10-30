import { and, desc, eq, getTableColumns, or, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { toolMovements, userProfiles } from "@/lib/db/schema";
import type { FreshTool } from "./applyBatch";
type Executor = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];
function toolSnapshot() {
  return sql`select t.tool_id as "toolId",t.name,t.code,t.category_id as "categoryId",t.total_quantity as "totalQuantity",t.icon,t.version,
 (t.total_quantity-coalesce(sum(a.quantity),0))::int as free,
 coalesce(json_agg(json_build_object('siteId',a.site_id,'qty',a.quantity) order by a.id) filter(where a.tool_id is not null),'[]'::json) as assignments
 from tools t left join tool_assignments a on a.tool_id=t.tool_id`;
}
export async function listTools(q?: string, executor: Executor = db): Promise<FreshTool[]> {
  const trimmed = q?.trim();
  return executor.execute<FreshTool>(sql`${toolSnapshot()} where t.is_deleted=false
 ${trimmed ? sql`and (t.name ilike ${`%${trimmed}%`} or t.code ilike ${`%${trimmed}%`})` : sql``}
 group by t.id order by t.created_at desc`);
}
export async function getTool(toolId: string, executor: Executor = db): Promise<FreshTool | null> {
  const rows = await executor.execute<FreshTool>(sql`${toolSnapshot()} where t.is_deleted=false and t.tool_id=${toolId} group by t.id limit 1`);
  return rows[0] ?? null;
}
export type MovementRow = typeof toolMovements.$inferSelect & {
  actorName: string;
};
// Per-tool ledger timeline, newest first, paginated.
export async function listToolMovements(toolId: string, limit: number, offset: number): Promise<MovementRow[]> {
  return db
    .select({ ...getTableColumns(toolMovements), actorName: sql<string>`coalesce(${userProfiles.fullName}, 'Former user')` })
    .from(toolMovements)
    .leftJoin(userProfiles, eq(userProfiles.userId, toolMovements.actorUserId))
    .where(eq(toolMovements.toolId, toolId))
    .orderBy(desc(toolMovements.createdAt), desc(toolMovements.movementId))
    .limit(limit)
    .offset(offset);
}
// Delete all movement history for a tool. Returns the number of rows deleted.
export async function clearToolMovements(toolId: string): Promise<number> {
  const result = await db
    .delete(toolMovements)
    .where(eq(toolMovements.toolId, toolId))
    .returning({ id: toolMovements.movementId });
  return result.length;
}
// Global ledger feed with optional filters (tool, site → from/to location, kind).
export async function listGlobalMovements(filters: {
  toolId?: string;
  siteId?: string;
  kind?: string;
}, limit: number, offset: number): Promise<MovementRow[]> {
  const conds = [];
  if (filters.toolId)
    conds.push(eq(toolMovements.toolId, filters.toolId));
  if (filters.kind)
    conds.push(eq(toolMovements.kind, filters.kind));
  if (filters.siteId) {
    conds.push(or(eq(toolMovements.fromLocation, filters.siteId), eq(toolMovements.toLocation, filters.siteId))!);
  }
  const where = conds.length ? and(...conds) : undefined;
  return db
    .select({ ...getTableColumns(toolMovements), actorName: sql<string>`coalesce(${userProfiles.fullName}, 'Former user')` })
    .from(toolMovements)
    .leftJoin(userProfiles, eq(userProfiles.userId, toolMovements.actorUserId))
    .where(where)
    .orderBy(desc(toolMovements.createdAt), desc(toolMovements.movementId))
    .limit(limit)
    .offset(offset);
}
export type ToolDashboard = {
  totalTools: number;
  totalQuantity: number;
  deployed: number;
  free: number;
  perCategory: {
    categoryId: string;
    name: string;
    codePrefix: string;
    toolCount: number;
    totalQuantity: number;
  }[];
  perSite: {
    siteId: string;
    toolTypes: number;
    totalQuantity: number;
  }[];
};
// All dashboard buckets share one PostgreSQL statement snapshot.
export async function dashboardAggregates(executor: Executor = db): Promise<ToolDashboard> {
  const [row] = await executor.execute<ToolDashboard>(sql`
 with live as (select * from tools where is_deleted=false),
 allocations as (select a.* from tool_assignments a join live t on t.tool_id=a.tool_id),
 totals as (select count(*)::int as count,coalesce(sum(total_quantity),0)::int as quantity from live),
 deployed as (select coalesce(sum(quantity),0)::int as quantity from allocations)
 select totals.count as "totalTools",totals.quantity as "totalQuantity",deployed.quantity as deployed,totals.quantity-deployed.quantity as free,
 coalesce((select json_agg(c order by sort_order) from (select c.category_id as "categoryId",c.name,c.code_prefix as "codePrefix",count(t.tool_id)::int as "toolCount",coalesce(sum(t.total_quantity),0)::int as "totalQuantity",c.sort_order
 from tool_categories c left join live t on t.category_id=c.category_id group by c.category_id,c.name,c.code_prefix,c.sort_order) c),'[]'::json) as "perCategory",
 coalesce((select json_agg(a) from (select site_id as "siteId",count(distinct tool_id)::int as "toolTypes",sum(quantity)::int as "totalQuantity" from allocations group by site_id) a),'[]'::json) as "perSite"
 from totals cross join deployed`);
  return { ...row, perCategory: row.perCategory.map(({ categoryId, name, codePrefix, toolCount, totalQuantity }) => ({ categoryId, name, codePrefix, toolCount, totalQuantity })) };
}

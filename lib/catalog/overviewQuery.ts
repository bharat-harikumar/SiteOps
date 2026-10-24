// Single-round-trip usage counts for the admin catalog overview. Replaces the
// per-source fan-out (7 separate group-by queries fired in parallel) with one
// UNION ALL, so a catalog load consumes one pool slot instead of ~7.
import { getTableName, sql } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";

import { notOnDeletedSiteSql, USAGE_SOURCES, usageSourcesForCategory } from "@/lib/catalog/usageSources";

// Accepts any drizzle handle (the shared db or a transaction), so callers can run
// it under withStatementTimeout.
type Executor = { execute: (query: ReturnType<typeof sql.raw>) => Promise<unknown> };

// Map of categoryName -> (value -> count). Mirrors the legacy usageByName shape so
// the route's mapping to subcategory ids is unchanged.
export async function fetchUsageCounts(
  db: Executor,
): Promise<Map<string, Map<string, number>>> {
  // Identifiers (table/column names) come from our own schema metadata — never
  // user input — so building the UNION ALL text directly is safe. categoryName
  // values are likewise trusted constants from USAGE_SOURCES.
  const branches = USAGE_SOURCES.map(({ categoryName, table, column }) => {
    const tbl = getTableName(table);
    const col = (column as PgColumn).name;
    return `select '${categoryName}'::text as category_name, "${col}"::text as value, count(*)::int as n from "${tbl}" where "${col}" is not null and ${notOnDeletedSiteSql(tbl)} group by "${col}"`;
  });
  const rows = (await db.execute(sql.raw(branches.join(" union all ")))) as Array<{
    category_name: string;
    value: string;
    n: number;
  }>;

  const out = new Map<string, Map<string, number>>();
  // Ensure every source key exists even with zero rows (stable shape for callers).
  for (const { categoryName } of USAGE_SOURCES) out.set(categoryName, new Map());
  for (const r of rows) {
    const catMap = out.get(r.category_name);
    if (!catMap) continue;
    const value = String(r.value);
    catMap.set(value, (catMap.get(value) ?? 0) + Number(r.n));
  }
  return out;
}

// Live usage of ONE catalog item (the delete guard). Same eligibility as the
// overview counts — soft-deleted sites excluded — so "0 uses" in the admin list
// and "can I delete this?" never disagree. One round trip across all sources.
export async function countCatalogUsage(
  db: Executor,
  categoryName: string,
  itemName: string,
): Promise<number> {
  const sources = usageSourcesForCategory(categoryName);
  if (sources.length === 0) return 0;
  const branches = sources.map(({ table, column }) => {
    const tbl = getTableName(table);
    return sql`select count(*)::int as n from ${sql.raw(`"${tbl}"`)} where ${sql.raw(`"${(column as PgColumn).name}"`)} = ${itemName} and ${sql.raw(notOnDeletedSiteSql(tbl))}`;
  });
  const rows = (await db.execute(sql.join(branches, sql` union all `))) as Array<{ n: number }>;
  return rows.reduce((sum, r) => sum + Number(r.n), 0);
}

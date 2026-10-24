import { eq, sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";

import { usageSourcesForCategory } from "@/lib/catalog/usageSources";
import { subcategories } from "@/lib/db/schema";

// Accepts the shared db or a transaction handle.
type Executor = Pick<PgDatabase<PgQueryResultHKT, Record<string, unknown>>, "select" | "execute">;

// Entries store a catalog item's NAME as free text (no FK), so renaming or
// merging an item must rewrite the entries that carry the old name or they fall
// out of every report that groups by the catalog name. Shared by rename and
// merge so there is one implementation of "what does this name touch".
//
// Rewrites every usage source of the category (Work Stage spans four entry
// tables) across ALL sites, including archived and soft-deleted ones: the name
// is global, and a partial rewrite would leave the same stage under two names.
// Returns how many entry rows changed.
export async function rewriteEntryNames(
  tx: Executor,
  categoryName: string,
  from: string,
  to: string,
): Promise<number> {
  let rewritten = 0;
  for (const usageSource of usageSourcesForCategory(categoryName)) {
    // SET takes an unqualified column name; interpolating the PgColumn renders it
    // table-qualified, which Postgres rejects (42703).
    const setColumn = sql.identifier(usageSource.column.name);
    const rows = (await tx.execute(
      sql`with u as (update ${usageSource.table} set ${setColumn} = ${to} where ${usageSource.column} = ${from} returning 1) select count(*)::int as n from u`,
    )) as Array<{ n: number }>;
    rewritten += Number(rows[0]?.n ?? 0);
  }
  return rewritten;
}

// Row-locks every item of the category (FOR UPDATE) and returns them. Rename,
// merge and (de)activation call this first so two admins cannot rewrite the same
// category at once, and so an entry being saved against one of these items
// (which takes a FOR SHARE lock on its row — see lockCatalogMembers) either
// finishes before the rewrite or sees the new name after it.
export async function lockCategoryItems(tx: Executor, categoryId: string) {
  return tx
    .select({
      subcategoryId: subcategories.subcategoryId,
      name: subcategories.name,
      isActive: subcategories.isActive,
    })
    .from(subcategories)
    .where(eq(subcategories.categoryId, categoryId))
    .for("update");
}

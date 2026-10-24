import { and, eq } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";

import { categories, subcategories } from "@/lib/db/schema";

type Executor = Pick<PgDatabase<PgQueryResultHKT, Record<string, unknown>>, "select">;

// The catalog item an entry was validated against was renamed, deactivated or
// deleted before the entry could be written. Mapped to a 409 by handleDbError.
export class CatalogChangedError extends Error {
  constructor(
    readonly listKey: string,
    readonly value: string,
  ) {
    super(`${listKey} "${value}" was just renamed or removed — please pick it again`);
    this.name = "CatalogChangedError";
  }
}

// Called INSIDE the transaction that writes an entry, after the route has
// validated the values and resolved their canonical catalog casing. Takes a
// FOR SHARE lock on each item's row and requires it to still be active under
// that exact name. A rename/merge/deactivate holds FOR UPDATE on the category
// (lockCategoryItems), so the two serialise: either the entry commits first and
// the rename's rewrite then covers it, or the rename commits first and this
// check fails. Without it an entry validated just before a rename keeps the old
// name and is stranded. Null/empty values (an optional, un-tagged field) are skipped.
export async function lockCatalogMembers(
  tx: Executor,
  pairs: ReadonlyArray<readonly [listKey: string, value: string | null | undefined]>,
): Promise<void> {
  for (const [listKey, value] of pairs) {
    if (typeof value !== "string" || value === "") continue;
    const rows = await tx
      .select({ id: subcategories.subcategoryId })
      .from(subcategories)
      .innerJoin(categories, eq(categories.categoryId, subcategories.categoryId))
      .where(
        and(
          eq(categories.name, listKey),
          eq(subcategories.name, value),
          eq(subcategories.isActive, true),
        ),
      )
      .for("share", { of: subcategories });
    if (rows.length === 0) throw new CatalogChangedError(listKey, value);
  }
}

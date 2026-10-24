import { eq } from "drizzle-orm";
import { z } from "zod";

import { requireCapability } from "@/lib/auth/guards";
import { countCatalogUsage } from "@/lib/catalog/overviewQuery";
import { lockCategoryItems, rewriteEntryNames } from "@/lib/catalog/rewriteEntryNames";
import { invalidateCatalogOverviewCache, invalidateCategoryTreeCache } from "@/lib/cache/invalidate";
import { db } from "@/lib/db/client";
import { categories, subcategories } from "@/lib/db/schema";
import { ERROR_CODES } from "@/lib/errors/codes";
import { handleDbError } from "@/lib/errors/db";
import { errorResponse, successResponse } from "@/lib/errors/response";
import { parseJsonBody, validateBody } from "@/lib/http/request";
import { withApiRoute } from "@/lib/http/withApi";
import { runNonCritical } from "@/lib/services/nonCritical";
import { normalizeLabel } from "@/lib/utils/stringSimilarity";

type RouteCtx = { params: Promise<{ id: string }> };

// Admin catalog management: rename, (de)activate, reorder. At least one field.
const patchSchema = z
  .object({
    name: z.string().min(1).max(100).optional(),
    isActive: z.boolean().optional(),
    sortOrder: z.number().int().min(0).optional(),
  })
  .strict()
  .refine((v) => v.name !== undefined || v.isActive !== undefined || v.sortOrder !== undefined, {
    message: "At least one field is required",
  });

export const PATCH = withApiRoute<RouteCtx>(async ({ request, requestId }, context) => {
  const auth = await requireCapability(request, "form_subcategory:update");
  if (!("session" in auth)) {
    return errorResponse(auth.error, "Admin access required", auth.status, undefined, requestId);
  }

  const { id } = await context.params;
  const parsed = await parseJsonBody(request, requestId);
  if (!parsed.ok) return parsed.response;
  const validation = validateBody(patchSchema, parsed.data, requestId);
  if (!validation.ok) return validation.response;

  const existing = await db
    .select({ categoryId: subcategories.categoryId })
    .from(subcategories)
    .where(eq(subcategories.subcategoryId, id))
    .limit(1);
  const row = existing[0];
  if (!row) {
    return errorResponse(ERROR_CODES.NOT_FOUND, "Subcategory not found", 404, undefined, requestId);
  }

  const catRows = await db
    .select({ name: categories.name })
    .from(categories)
    .where(eq(categories.categoryId, row.categoryId))
    .limit(1);
  const categoryName = catRows[0]?.name;

  const requestedName = validation.data.name?.trim();
  const normalized = requestedName === undefined ? undefined : normalizeLabel(requestedName);
  if (requestedName !== undefined && !normalized) {
    return errorResponse(ERROR_CODES.VALIDATION_ERROR, "Name is invalid", 400, undefined, requestId);
  }

  try {
    // One transaction: lock the category's items, change the item, and — on a
    // rename — rewrite the entries that carry the old name. Entries store the
    // name as text, so a catalog-only rename strands every historical entry
    // under a name the catalog no longer has. The lock also makes the sibling
    // collision check race-free against a concurrent rename or merge.
    const outcome = await db.transaction(async (tx) => {
      const items = await lockCategoryItems(tx, row.categoryId);
      const current = items.find((i) => i.subcategoryId === id);
      if (!current) return { kind: "not_found" as const };

      const updates: Partial<typeof subcategories.$inferInsert> = {};
      if (validation.data.isActive !== undefined) updates.isActive = validation.data.isActive;
      if (validation.data.sortOrder !== undefined) updates.sortOrder = validation.data.sortOrder;
      if (requestedName !== undefined) {
        // Reject a rename that collides with another item in the same category.
        if (items.some((i) => i.subcategoryId !== id && normalizeLabel(i.name) === normalized)) {
          return { kind: "conflict" as const };
        }
        updates.name = requestedName;
      }

      const updated = await tx
        .update(subcategories)
        .set(updates)
        .where(eq(subcategories.subcategoryId, id))
        .returning();

      if (categoryName && requestedName !== undefined && requestedName !== current.name) {
        await rewriteEntryNames(tx, categoryName, current.name, requestedName);
      }
      return { kind: "ok" as const, updated: updated[0] };
    });

    if (outcome.kind === "not_found") {
      return errorResponse(ERROR_CODES.NOT_FOUND, "Subcategory not found", 404, undefined, requestId);
    }
    if (outcome.kind === "conflict") {
      return errorResponse(ERROR_CODES.CONFLICT, "Another item with this name already exists", 409, undefined, requestId);
    }

    runNonCritical(
      requestId,
      "category_tree_cache_invalidation_failed",
      invalidateCategoryTreeCache(row.categoryId, requestId),
    );
    runNonCritical(
      requestId,
      "catalog_overview_cache_invalidation_failed",
      invalidateCatalogOverviewCache(requestId),
    );

    return successResponse(outcome.updated, 200, requestId);
  } catch (dbError) {
    const handled = handleDbError(dbError, requestId);
    if (handled) return handled;
    throw dbError;
  }
});

export const GET = withApiRoute<RouteCtx>(async ({ request, requestId }, context) => {
  const auth = await requireCapability(request, "form_subcategory:read");
  if (!("session" in auth)) {
    return errorResponse(auth.error, "Authentication required", auth.status, undefined, requestId);
  }

  const { id } = await context.params;
  const rows = await db
    .select()
    .from(subcategories)
    .where(eq(subcategories.subcategoryId, id))
    .limit(1);

  const row = rows[0] ?? null;
  if (!row) {
    return errorResponse(ERROR_CODES.NOT_FOUND, "Subcategory not found", 404, undefined, requestId);
  }

  return successResponse(row, 200, requestId);
});

export const DELETE = withApiRoute<RouteCtx>(async ({ request, requestId }, context) => {
  const auth = await requireCapability(request, "form_subcategory:delete");
  if (!("session" in auth)) {
    return errorResponse(auth.error, "Admin access required", auth.status, undefined, requestId);
  }

  const { id } = await context.params;
  const rows = await db
    .select({ categoryId: subcategories.categoryId, name: subcategories.name })
    .from(subcategories)
    .where(eq(subcategories.subcategoryId, id))
    .limit(1);

  const row = rows[0] ?? null;
  if (!row) {
    return errorResponse(ERROR_CODES.NOT_FOUND, "Subcategory not found", 404, undefined, requestId);
  }

  // Block deletion while entries still reference this option (design §4.2):
  // deactivate instead so historical entries stay readable.
  const catRows = await db
    .select({ name: categories.name })
    .from(categories)
    .where(eq(categories.categoryId, row.categoryId))
    .limit(1);
  // Live usage only: entries on soft-deleted sites are invisible in the app, so
  // they must not pin an item the admin can see is unused.
  const usage = catRows[0] ? await countCatalogUsage(db, catRows[0].name, row.name) : 0;
  if (usage > 0) {
    return errorResponse(
      ERROR_CODES.CONFLICT,
      "This item is still in use — deactivate it instead of deleting",
      409,
      undefined,
      requestId,
    );
  }

  await db.delete(subcategories).where(eq(subcategories.subcategoryId, id));

  runNonCritical(
    requestId,
    "category_tree_cache_invalidation_failed",
    invalidateCategoryTreeCache(row.categoryId, requestId),
  );
  runNonCritical(
    requestId,
    "catalog_overview_cache_invalidation_failed",
    invalidateCatalogOverviewCache(requestId),
  );

  return successResponse(null, 200, requestId);
});

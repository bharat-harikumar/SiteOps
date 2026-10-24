import { logWarn } from "@/lib/logging/log";

import {
  analyticsCacheKey,
  catalogListNamesCacheKey,
  catalogOverviewCacheKey,
  categoryListCacheKey,
  categoryTreeCacheKey,
  siteCacheKey,
  userProfileCacheKey,
} from "@/lib/cache/keys";
import { redis } from "@/lib/cache/redis";
import { CATALOG_OPERATIONS } from "@/lib/catalog/overview";

const analyticsPeriods = ["7d", "30d", "90d"];

export async function invalidateAdminAnalyticsCache(requestId: string) {
  const r = redis;
  if (!r) return;

  try {
    await Promise.all(analyticsPeriods.map((p) => r.del(analyticsCacheKey(p))));
  } catch (error) {
    logWarn(requestId, "cache_invalidate_error", { error: String(error) });
  }
}

export async function invalidateSiteCache(siteId: string, requestId: string) {
  const r = redis;
  if (!r) return;

  try {
    await r.del(siteCacheKey(siteId));
  } catch (error) {
    logWarn(requestId, "cache_invalidate_error", { key: siteCacheKey(siteId), error: String(error) });
  }
}

export async function invalidateUserProfileCache(userId: string, requestId: string) {
  const r = redis;
  if (!r) return;

  try {
    await r.del(userProfileCacheKey(userId));
  } catch (error) {
    logWarn(requestId, "cache_invalidate_error", { key: userProfileCacheKey(userId), error: String(error) });
  }
}

export async function invalidateCategoryListCache(requestId: string) {
  const r = redis;
  if (!r) return;

  try {
    await r.del(categoryListCacheKey());
  } catch (error) {
    logWarn(requestId, "cache_invalidate_error", { key: categoryListCacheKey(), error: String(error) });
  }
}

// The one hook every catalog write already calls. Besides the admin overview it
// clears each managed list's cached active names (loadActiveCatalogNames, 10 min
// TTL), which entry validation and the stage summary read — left cached, a rename
// keeps the old name valid and rejects the new one until the TTL expires.
const catalogListNameKeys = CATALOG_OPERATIONS.flatMap((op) =>
  op.lists.map((list) => catalogListNamesCacheKey(list.categoryName)),
);

export async function invalidateCatalogOverviewCache(requestId: string) {
  const r = redis;
  if (!r) return;

  try {
    await r.del(catalogOverviewCacheKey(), ...catalogListNameKeys);
  } catch (error) {
    logWarn(requestId, "cache_invalidate_error", {
      key: catalogOverviewCacheKey(),
      error: String(error),
    });
  }
}

export async function invalidateCategoryTreeCache(categoryId: string, requestId: string) {
  const r = redis;
  if (!r) return;

  try {
    await Promise.all([
      r.del(categoryTreeCacheKey(categoryId)),
      r.del(categoryListCacheKey()),
    ]);
  } catch (error) {
    logWarn(requestId, "cache_invalidate_error", {
      key: categoryTreeCacheKey(categoryId),
      error: String(error),
    });
  }
}

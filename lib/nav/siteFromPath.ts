// Segments under /app/sites that are pages, not site ids.
const NON_SITE_SEGMENTS = new Set(["new"]);

// The site the user is currently inside, from any /app/sites/<id>/… path.
export function siteIdFromPath(pathname: string): string | null {
  const match = /^\/app\/sites\/([^/?#]+)/.exec(pathname);
  if (!match || NON_SITE_SEGMENTS.has(match[1])) return null;
  return decodeURIComponent(match[1]);
}

// The "+" button: inside a site, skip straight past site selection.
export function newLogHref(pathname: string): string {
  const siteId = siteIdFromPath(pathname);
  return siteId ? `/app/logs/new?siteId=${encodeURIComponent(siteId)}` : "/app/logs/new";
}

// A preselected site is honoured only if the user can log for it; otherwise
// the normal site picker shows.
export function allowedSiteId(
  siteId: string | undefined,
  sites: ReadonlyArray<{ siteId: string }>,
): string | undefined {
  return siteId && sites.some((site) => site.siteId === siteId) ? siteId : undefined;
}

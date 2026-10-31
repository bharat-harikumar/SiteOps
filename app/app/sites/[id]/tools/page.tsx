import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { can } from "@/lib/auth/capabilities";
import { checkOwnership } from "@/lib/auth/ownership";
import { safeGetSessionFromHeaders } from "@/lib/auth/session";
import { getSiteById } from "@/lib/db/queries/sites";
import { SiteTools } from "@/components/tools/SiteTools";

export const dynamic = "force-dynamic";
export default async function SiteToolsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = safeGetSessionFromHeaders(await headers());
  if (!session) redirect("/auth/sign-in");
  if (!can(session.user.role, "site_tool:read")) notFound();
  const { id } = await params;
  const site = await getSiteById(id);
  if (
    !site ||
    site.archivedAt ||
    site.isDeleted ||
    !checkOwnership(session.user, site.supervisorId)
  )
    notFound();
  return <SiteTools siteId={id} siteName={site.name} />;
}

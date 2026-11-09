import { can } from "@/lib/auth/capabilities";

// What the "Reporting from" card on an entry form may show. The form page gets
// its siteId from the URL, so a supervisor must only ever see their own site's
// name here — mirrors the site list the picker (/app/logs/new) offers them.
export function reportingSiteFor(
  site: { name: string; location: string; supervisorId: string | null } | null,
  user: { id: string; role: "Admin" | "Supervisor" },
): { name: string; location: string } | null {
  if (!site) return null;
  if (!can(user.role, "site:read_all") && site.supervisorId !== user.id) return null;
  return { name: site.name, location: site.location };
}

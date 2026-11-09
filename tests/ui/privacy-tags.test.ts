import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

// "Hide values" coverage fence. Every screen that renders site names, people,
// amounts, quantities or notes must tag them with `data-private` so the
// admin's demo mode blurs them. New screens showing such data belong here too.
const repoRoot = path.resolve(__dirname, "..", "..");

function codeLines(rel: string): string[] {
  return readFileSync(path.join(repoRoot, rel), "utf8")
    .split("\n")
    .filter((line) => !line.trim().startsWith("//") && !line.trim().startsWith("*"));
}

const PRIVATE_SURFACES = [
  // Dashboard, sites, log flow
  "app/app/dashboard/SiteRow.tsx",
  "app/app/dashboard/SitesCard.tsx",
  "app/app/dashboard/ArchivedSites.tsx",
  "app/app/sites/[id]/SiteDetailPageClient.tsx",
  "app/app/logs/new/LogsNewPageClient.tsx",
  "components/logs/ReportingFromCard.tsx",
  "app/app/profile/ProfilePageClient.tsx",
  // Operations, stages, entries
  "components/operations/EntryLogList.tsx",
  "components/operations/CategoryGrid.tsx",
  "components/operations/entryFormat.tsx",
  "app/app/sites/[id]/operations/[type]/AllOperationsPageClient.tsx",
  "app/app/sites/[id]/operations/[type]/OperationDetailPageClient.tsx",
  "app/app/sites/[id]/operations/[type]/[category]/CategoryDetailPageClient.tsx",
  "app/app/sites/[id]/stages/StageSummaryClient.tsx",
  // (app/app/logs/[entryId] is the edit form only — form controls stay readable.)
  // Search, notifications, header
  "components/search/SearchHitRow.tsx",
  "app/app/notifications/page.tsx",
  "components/app-shell/AppHeader.tsx",
  // Admin
  "app/app/admin/expenses/AdminExpensesPageClient.tsx",
  "app/app/admin/analytics/AdminAnalyticsPageClient.tsx",
  "app/app/admin/approvals/TransferApprovals.tsx",
  "app/app/admin/approvals/ResourceRequests.tsx",
  "app/app/admin/approvals/FieldRequests.tsx",
  "components/admin-users/UserRow.tsx",
  "app/app/admin/live-feed/page.tsx",
  // Requests
  "app/app/requests/field/FieldRequestsPageClient.tsx",
  "app/app/requests/resource/ResourceRequestsPageClient.tsx",
  // Tools
  "components/tools/ToolsHub.tsx",
  "components/tools/SiteTools.tsx",
  "components/tools/SiteToolsCard.tsx",
  "components/tools/ToolRow.tsx",
  "components/tools/ToolHistory.tsx",
  "components/tools/ToolLedgerDrawer.tsx",
  "components/tools/ToolSummaryTile.tsx",
  "components/tools/ToolDashboardStrip.tsx",
  "components/tools/AssignmentPanel.tsx",
  "components/tools/ToolMovementForm.tsx",
];

function tsxFiles(dir: string): string[] {
  return readdirSync(path.join(repoRoot, dir)).flatMap((name) => {
    const rel = path.join(dir, name);
    if (statSync(path.join(repoRoot, rel)).isDirectory()) return tsxFiles(rel);
    return rel.endsWith(".tsx") ? [rel] : [];
  });
}

describe("hide-values coverage", () => {
  test.each(PRIVATE_SURFACES)("%s tags its sensitive values", (rel) => {
    expect(codeLines(rel).some((line) => line.includes("data-private"))).toBe(true);
  });

  test("form controls are never blurred, so the admin can read what they type", () => {
    const offenders = [...tsxFiles("app"), ...tsxFiles("components")].flatMap((rel) =>
      codeLines(rel)
        .filter((line) => /<(input|select|textarea|button)\b[^>]*data-private/.test(line))
        .map((line) => `${rel}: ${line.trim()}`),
    );
    expect(offenders).toEqual([]);
  });
});

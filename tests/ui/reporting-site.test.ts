import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

// Users got confused about which site they were logging for once they left the
// category picker. Both steps of the log flow must show the same card.
const repoRoot = path.resolve(__dirname, "..", "..");
const read = (rel: string) => readFileSync(path.join(repoRoot, rel), "utf8");
const CARD = "components/logs/ReportingFromCard.tsx";
const FORM_PAGE = "app/app/logs/new/[categoryId]/page.tsx";

describe("Reporting from card", () => {
  test("is one shared component", () => {
    expect(existsSync(path.join(repoRoot, CARD))).toBe(true);
    const card = read(CARD);
    expect(card).toContain("Reporting From");
    expect(card).toContain("No site selected");
    // Site names stay visible: the client only hides amounts.
    expect(card).not.toContain("data-private");
  });

  test("the category picker and the entry form both render it", () => {
    expect(read("app/app/logs/new/LogsNewPageClient.tsx")).toContain("<ReportingFromCard");
    expect(read(FORM_PAGE)).toContain("<ReportingFromCard");
  });

  test("the entry form resolves the site with the ownership check and links back to the picker", () => {
    const page = read(FORM_PAGE);
    expect(page).toContain("reportingSiteFor(");
    expect(page).toContain("getSiteById(");
    expect(page).toMatch(/href="\/app\/logs\/new"/);
    expect(page).toContain("Choose site");
  });
});

// Every page under a site shows which site it belongs to, under its title.
describe("site sub-pages name their site", () => {
  const pages = [
    "app/app/sites/[id]/operations/[type]/AllOperationsPageClient.tsx",
    "app/app/sites/[id]/operations/[type]/OperationDetailPageClient.tsx",
    "app/app/sites/[id]/operations/[type]/[category]/CategoryDetailPageClient.tsx",
  ];
  test.each(pages)("%s renders site.name", (rel) => {
    const src = read(rel);
    expect(src).toContain("{site.name}");
    expect(src).not.toContain("site: _site");
  });
});

describe("transfer remarks", () => {
  test("is a multi-line box", () => {
    const form = read("components/transfers/TransferForm.tsx");
    expect(form).toMatch(/<textarea[^>]*id="transfer-remarks"/s);
  });
});

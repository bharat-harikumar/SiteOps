import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

// "Hide amounts" coverage fence. Every rupee figure rendered on screen must go
// through <Amount> so the admin's demo mode can mask it. Forms are exempt: the
// admin must be able to read what they type (and the totals computed from it).
const repoRoot = path.resolve(__dirname, "..", "..");
const read = (rel: string) => readFileSync(path.join(repoRoot, rel), "utf8");

const FORM_DIRS = ["components/logs/"];

function tsxFiles(dir: string): string[] {
  return readdirSync(path.join(repoRoot, dir)).flatMap((name) => {
    const rel = path.join(dir, name);
    if (statSync(path.join(repoRoot, rel)).isDirectory()) return tsxFiles(rel);
    return rel.endsWith(".tsx") ? [rel] : [];
  });
}

// A currency value rendered as a JSX child: `{formatCurrency(…)}`,
// `{formatCompactCurrency(…)}`, `{formatBudgetPair(…)}` or a literal `₹{…}`.
const CURRENCY_CHILD = /(?<![$\w])\{(?:formatCurrency|formatCompactCurrency|formatBudgetPair)\(|₹\{/g;
const AMOUNT_OPEN = /<Amount(?:\s[^>]*)?>\s*$/;

function unmaskedCurrency(rel: string): string[] {
  const src = read(rel);
  return [...src.matchAll(CURRENCY_CHILD)]
    .filter((m) => !AMOUNT_OPEN.test(src.slice(0, m.index)))
    .map((m) => `${rel}:${src.slice(0, m.index).split("\n").length}`);
}

// Amounts held in variables (`{todaySpend}`, `{stat.val}`, notification text)
// can't be found by the scan above, so these files must use <Amount> directly.
const VARIABLE_AMOUNT_SURFACES = [
  "app/app/sites/[id]/SiteDetailPageClient.tsx",
  "app/app/notifications/page.tsx",
];

describe("hide-amounts coverage", () => {
  test("every rendered currency value is wrapped in <Amount>", () => {
    const files = [...tsxFiles("app"), ...tsxFiles("components")].filter(
      (rel) => !FORM_DIRS.some((dir) => rel.startsWith(dir)),
    );
    expect(files.flatMap(unmaskedCurrency)).toEqual([]);
  });

  test.each(VARIABLE_AMOUNT_SURFACES)("%s masks its variable amounts", (rel) => {
    expect(read(rel)).toContain("<Amount");
  });

  test("the blur tagging is gone everywhere", () => {
    const tagged = [...tsxFiles("app"), ...tsxFiles("components")].filter((rel) =>
      read(rel).includes("data-private"),
    );
    expect(tagged).toEqual([]);
  });
});

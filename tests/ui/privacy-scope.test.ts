import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

// "Hide amounts" wiring fences. Masking must only ever apply inside an Admin's
// AppShell (a supervisor on a device where an admin enabled it sees real
// amounts) and must be applied before first paint.
const repoRoot = path.resolve(__dirname, "..", "..");
const read = (rel: string) => readFileSync(path.join(repoRoot, rel), "utf8");

const SCOPE = 'html[data-privacy="on"] [data-privacy-scope]';

// Selector → declarations, for every rule in the stylesheet.
function rules(css: string): Array<[string, string]> {
  const noComments = css.replace(/\/\*[\s\S]*?\*\//g, "");
  return [...noComments.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => [m[1].trim(), m[2].trim()]);
}

describe("hide-amounts CSS", () => {
  const css = read("app/globals.css");
  const all = rules(css);
  const rulesFor = (attr: string) => all.filter(([sel]) => sel.includes(attr));

  test("the mask is hidden by default and the real amount shows", () => {
    expect(rulesFor("[data-amount-mask]")).toContainEqual(["[data-amount-mask]", "display: none;"]);
    expect(rulesFor("[data-amount-value]").filter(([sel]) => !sel.startsWith(SCOPE))).toEqual([]);
  });

  test("amounts swap to the mask only inside an admin scope with the setting on", () => {
    expect(rulesFor("[data-amount-value]")).toEqual([[`${SCOPE} [data-amount-value]`, "display: none;"]]);
    expect(rulesFor("[data-amount-mask]")).toContainEqual([`${SCOPE} [data-amount-mask]`, "display: inline;"]);
    expect(rulesFor("[data-amount-mask]")).toHaveLength(2);
  });

  test("the old blur treatment is gone", () => {
    expect(css).not.toContain("data-private");
    // (backdrop-filter glass on cards is unrelated and stays.)
    expect(css).not.toMatch(/(?<!backdrop-)filter:\s*blur\(/);
  });
});

describe("hide-values wiring", () => {
  test("AppShell renders the privacy scope only for Admin", () => {
    expect(read("components/app-shell/AppShell.tsx")).toMatch(
      /data-privacy-scope=\{role === ['"]Admin['"]/,
    );
  });

  test("root layout applies the preference before paint without a hydration warning", () => {
    const layout = read("app/layout.tsx");
    expect(layout).toContain("HIDE_VALUES_BOOT_SCRIPT");
    expect(layout).toMatch(/<html[^>]*suppressHydrationWarning/);
  });
});

describe("hide-values toggle", () => {
  const profile = read("app/app/profile/ProfilePageClient.tsx");

  test("Profile shows the Hide amounts toggle only to admins", () => {
    const guarded = profile.match(/isAdmin \? \(\s*<section[\s\S]*?<\/section>\s*\) : null/);
    expect(guarded?.[0]).toContain('label="Hide amounts"');
    expect(guarded?.[0]).toContain("<Toggle");
    expect(profile.match(/Hide amounts/g)).toHaveLength(1);
    expect(profile).not.toContain("data-private");
    expect(profile).toMatch(/const isAdmin = initialProfile\.user\.role === ['"]Admin['"]/);
  });
});

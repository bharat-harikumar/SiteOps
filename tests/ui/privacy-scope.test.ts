import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

// "Hide values" wiring fences. Blur must only ever apply inside an Admin's
// AppShell (a supervisor on a device where an admin enabled it sees real
// values), must be applied before first paint, and must never move layout.
const repoRoot = path.resolve(__dirname, "..", "..");
const read = (rel: string) => readFileSync(path.join(repoRoot, rel), "utf8");

const SCOPED_SELECTOR = 'html[data-privacy="on"] [data-privacy-scope] [data-private]';

function privacyRuleBody(css: string): string {
  const start = css.indexOf(SCOPED_SELECTOR);
  if (start === -1) return "";
  return css.slice(css.indexOf("{", start) + 1, css.indexOf("}", start));
}

describe("hide-values CSS", () => {
  const css = read("app/globals.css");

  test("blur is scoped to html[data-privacy=on] inside the admin scope", () => {
    expect(css).toContain(SCOPED_SELECTOR);
    expect(privacyRuleBody(css)).toMatch(/filter:\s*blur\(/);
  });

  test("no unscoped rule blurs [data-private]", () => {
    const blurSelectors = [...css.matchAll(/([^{}]+)\{[^}]*filter:\s*blur\([^}]*\}/g)]
      .map((m) => m[1].trim())
      .filter((sel) => sel.includes("[data-private]"));
    expect(blurSelectors).toEqual([SCOPED_SELECTOR]);
  });

  test("the privacy rule never touches layout or colour", () => {
    const body = privacyRuleBody(css);
    for (const prop of ["width", "height", "margin", "padding", "display", "font", "letter-spacing", "color"]) {
      expect(body, prop).not.toMatch(new RegExp(`(^|[;\\s])${prop}\\s*:`));
    }
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

  test("Profile shows the Hide values toggle only to admins", () => {
    const guarded = profile.match(/isAdmin \? \(\s*<section[\s\S]*?<\/section>\s*\) : null/);
    expect(guarded?.[0]).toContain('label="Hide values"');
    expect(guarded?.[0]).toContain("<Toggle");
    expect(profile.match(/Hide values/g)).toHaveLength(1);
    expect(profile).toMatch(/const isAdmin = initialProfile\.user\.role === ['"]Admin['"]/);
  });
});

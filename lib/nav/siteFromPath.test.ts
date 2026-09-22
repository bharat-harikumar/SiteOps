import { describe, expect, it } from "vitest";

import { allowedSiteId, newLogHref, siteIdFromPath } from "./siteFromPath";

describe("siteIdFromPath", () => {
  it("reads the site id from a site page", () => {
    expect(siteIdFromPath("/app/sites/abc-123")).toBe("abc-123");
  });

  it("reads the site id from a page deep inside a site", () => {
    expect(siteIdFromPath("/app/sites/abc-123/operations/labour/Mason")).toBe("abc-123");
  });

  it("returns null for the sites index", () => {
    expect(siteIdFromPath("/app/sites")).toBeNull();
  });

  it("returns null for the new-site page", () => {
    expect(siteIdFromPath("/app/sites/new")).toBeNull();
  });

  it("returns null outside the sites section", () => {
    expect(siteIdFromPath("/app/dashboard")).toBeNull();
  });
});

describe("newLogHref", () => {
  it("carries the current site into the new-log flow", () => {
    expect(newLogHref("/app/sites/abc-123/stages")).toBe("/app/logs/new?siteId=abc-123");
  });

  it("opens the plain new-log flow outside a site", () => {
    expect(newLogHref("/app/requests/resource")).toBe("/app/logs/new");
  });
});

describe("allowedSiteId", () => {
  const sites = [{ siteId: "s1" }, { siteId: "s2" }];

  it("keeps a site the user can log for", () => {
    expect(allowedSiteId("s2", sites)).toBe("s2");
  });

  it("drops a site the user cannot log for", () => {
    expect(allowedSiteId("someone-elses", sites)).toBeUndefined();
  });

  it("drops a missing site id", () => {
    expect(allowedSiteId(undefined, sites)).toBeUndefined();
  });
});

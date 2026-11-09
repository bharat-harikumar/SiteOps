import { describe, expect, it } from "vitest";

import { reportingSiteFor } from "./reportingSite";

const site = { name: "Anayara", location: "Trivandrum", supervisorId: "sup-1" };

describe("reportingSiteFor", () => {
  it("shows any site to an admin", () => {
    expect(reportingSiteFor(site, { id: "admin-9", role: "Admin" })).toEqual({
      name: "Anayara",
      location: "Trivandrum",
    });
  });

  it("shows a supervisor their own site", () => {
    expect(reportingSiteFor(site, { id: "sup-1", role: "Supervisor" })).toEqual({
      name: "Anayara",
      location: "Trivandrum",
    });
  });

  it("never reveals another supervisor's site name", () => {
    expect(reportingSiteFor(site, { id: "sup-2", role: "Supervisor" })).toBeNull();
    expect(reportingSiteFor({ ...site, supervisorId: null }, { id: "sup-1", role: "Supervisor" })).toBeNull();
  });

  it("returns null when there is no site", () => {
    expect(reportingSiteFor(null, { id: "admin-9", role: "Admin" })).toBeNull();
  });
});

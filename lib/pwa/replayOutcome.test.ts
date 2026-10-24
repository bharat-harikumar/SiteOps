import { describe, expect, it } from "vitest";

import { classifyReplayStatus, describeRejectedWrite } from "./replayOutcome";

describe("classifyReplayStatus", () => {
  it.each([200, 201, 204])("%i means the write was saved", (status) => {
    expect(classifyReplayStatus(status)).toBe("synced");
  });

  it.each([400, 404, 409, 422])("%i means the server refused it, so retrying cannot help", (status) => {
    // 400 = e.g. a Work Stage that was renamed while the entry sat offline;
    // 404 = site archived; 409 = site/catalog conflict. The payload is stale.
    expect(classifyReplayStatus(status)).toBe("rejected");
  });

  it.each([401, 408, 425, 429, 500, 502, 503, 504])(
    "%i is transient or fixable by signing in again, so keep the entry and retry",
    (status) => {
      expect(classifyReplayStatus(status)).toBe("retry");
    },
  );

  it("keeps the entry for an unexpected redirect rather than guessing it was saved", () => {
    expect(classifyReplayStatus(302)).toBe("retry");
  });
});

describe("describeRejectedWrite", () => {
  it("names the entry type, date and the server's reason, and tells the user to re-enter it", () => {
    const text = describeRejectedWrite({
      pathname: "/api/entries/material",
      body: { date: "2026-10-12", materialType: "Cement" },
      serverMessage: 'Invalid Work Stage: "Lintel Level"',
    });
    expect(text).toBe(
      'Offline Material entry for 2026-10-12 was not saved: Invalid Work Stage: "Lintel Level". Please enter it again.',
    );
  });

  it.each([
    ["/api/entries/labour", "Labour"],
    ["/api/entries/machinery", "Machinery"],
    ["/api/entries/expenses", "Expense"],
    ["/api/entries/incidents", "Incident"],
    ["/api/transfers", "Transfer"],
  ])("labels %s as %s", (pathname, label) => {
    expect(describeRejectedWrite({ pathname, body: {}, serverMessage: "x" })).toContain(`Offline ${label}`);
  });

  it("omits the date when the body has none and falls back to a generic reason", () => {
    const text = describeRejectedWrite({ pathname: "/api/entries/labour", body: null, serverMessage: null });
    expect(text).toBe("Offline Labour entry was not saved: the server rejected it. Please enter it again.");
  });

  it("uses a generic label for an unknown endpoint", () => {
    expect(describeRejectedWrite({ pathname: "/api/entries/other", body: null, serverMessage: null })).toContain(
      "Offline entry was not saved",
    );
  });
});
